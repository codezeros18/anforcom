import Anthropic from "@anthropic-ai/sdk";
import {
  type AlasanPerluManual,
  type HasilBaca,
  type KonteksPembacaan,
  type PembacaFraksi,
  TIMEOUT_MODEL_MS,
} from "./provider.ts";

/*
 * Pembacaan fraksi keterisian lewat model multimodal.
 *
 * SATU-SATUNYA berkas di seluruh basis kode yang memanggil API model. Kalau
 * suatu hari ada panggilan model di tempat lain, klaim "model bisa dicabut"
 * berhenti benar — karena mencabutnya tidak lagi cukup dengan menukar provider.
 *
 * YANG DITANYAKAN KE MODEL, dan kenapa pertanyaannya sesempit itu:
 * bukan "berapa kilogram makanan ini" — pertanyaan itu mustahil dijawab dari
 * sebuah foto. Yang ditanyakan adalah "wadah ini terisi berapa persen", yang
 * mudah, terbatas, dan bisa dikoreksi manusia dalam satu geseran. Konstanta
 * kalibrasi di /src/core yang mengubah jawaban itu menjadi porsi.
 *
 * Model tidak pernah diberi tahu berapa porsi yang diharapkan, dan tidak pernah
 * diminta menebak porsi. Memberinya angka porsi akan membuatnya menjangkar ke
 * angka itu, dan estimasi berhenti menjadi pembacaan foto.
 */

/** Model yang dipakai. Dipisahkan supaya bisa diganti tanpa menyentuh logika. */
const MODEL_BAWAAN = "claude-opus-5";

/**
 * Instruksi untuk model.
 *
 * Sengaja pendek dan tanpa penekanan berlebihan. Model saat ini mengikuti
 * instruksi dengan patuh; menuliskan "KRITIS: ANDA HARUS" justru membuatnya
 * terlalu sering memaksakan jawaban pada foto yang sebenarnya tidak terbaca —
 * dan foto yang tidak terbaca lebih baik jatuh ke slider daripada dijawab asal.
 */
const INSTRUKSI = `Kamu membaca satu foto wadah makanan yang difoto dari atas.

Tugasmu satu: perkirakan seberapa penuh wadah itu terisi, sebagai pecahan antara 0 dan 1.
0 berarti kosong, 1 berarti penuh sampai bibir wadah.

Kamu TIDAK diminta menebak berat, jumlah porsi, atau jenis makanannya.

Kalau foto buram, gelap, terpotong, atau bibir wadah tidak terlihat sehingga kamu
tidak bisa menilai keterisiannya, katakan begitu lewat keyakinan yang rendah.
Jangan memaksakan angka pada foto yang tidak terbaca.`;

/** Skema jawaban. Structured output membuat jawaban tak terduga menjadi mustahil, bukan sekadar jarang. */
const SKEMA_JAWABAN = {
  type: "object",
  properties: {
    fraksi: {
      type: "number",
      description: "Seberapa penuh wadah terisi, antara 0 dan 1.",
    },
    keyakinan: {
      type: "number",
      description:
        "Seberapa yakin kamu pada angka fraksi, antara 0 dan 1. Rendah bila foto sulit dibaca.",
    },
  },
  required: ["fraksi", "keyakinan"],
  additionalProperties: false,
} as const;

export interface OpsiModelProvider {
  apiKey?: string;
  model?: string;
  timeoutMs?: number;
  /** Disuntikkan di tes supaya tidak ada panggilan jaringan sungguhan. */
  client?: Pick<Anthropic["messages"], "create">;
}

/** Media type yang diterima model, ditebak dari angka ajaib berkas. */
function tebakMediaType(
  foto: Uint8Array,
): "image/jpeg" | "image/png" | "image/webp" | null {
  if (foto[0] === 0xff && foto[1] === 0xd8 && foto[2] === 0xff) return "image/jpeg";
  if (foto[0] === 0x89 && foto[1] === 0x50 && foto[2] === 0x4e && foto[3] === 0x47) {
    return "image/png";
  }
  if (
    foto[0] === 0x52 &&
    foto[1] === 0x49 &&
    foto[2] === 0x46 &&
    foto[3] === 0x46 &&
    foto[8] === 0x57 &&
    foto[9] === 0x45 &&
    foto[10] === 0x42 &&
    foto[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

function keBase64(foto: Uint8Array): string {
  return Buffer.from(foto).toString("base64");
}

/** Membaca angka 0..1 dari nilai tak dikenal. Menolak apa pun yang di luar rentang. */
function bacaPecahan(nilai: unknown): number | null {
  if (typeof nilai !== "number" || !Number.isFinite(nilai)) return null;
  if (nilai < 0 || nilai > 1) return null;
  return nilai;
}

export function buatModelProvider(opsi: OpsiModelProvider = {}): PembacaFraksi {
  const timeoutMs = opsi.timeoutMs ?? TIMEOUT_MODEL_MS;
  const model = opsi.model ?? process.env.VISION_MODEL ?? MODEL_BAWAAN;

  return {
    nama: "model",

    async baca(foto, konteks: KonteksPembacaan): Promise<HasilBaca> {
      const mulai = Date.now();
      const sejakMulai = () => Date.now() - mulai;
      const menyerah = (alasan: AlasanPerluManual): HasilBaca => ({
        status: "perlu_manual",
        alasan,
        latensiMs: sejakMulai(),
      });

      if (!foto || foto.length === 0) return menyerah("panggilan_gagal");

      const mediaType = tebakMediaType(foto);
      if (mediaType === null) return menyerah("panggilan_gagal");

      const client =
        opsi.client ??
        new Anthropic({ apiKey: opsi.apiKey ?? process.env.VISION_API_KEY }).messages;

      /*
       * Batas waktu 6 detik dengan pembatalan permintaan.
       *
       * `AbortController` penting, bukan hiasan: tanpa pembatalan, permintaan
       * yang lambat tetap berjalan di latar setelah operator beralih ke slider,
       * menghabiskan kuota dan koneksi untuk jawaban yang tidak akan dipakai.
       */
      const pembatal = new AbortController();
      const penghitung = setTimeout(() => pembatal.abort(), timeoutMs);

      try {
        const jawaban = await client.create(
          {
            model,
            max_tokens: 256,
            system: INSTRUKSI,
            output_config: { format: { type: "json_schema", schema: SKEMA_JAWABAN } },
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "image",
                    source: {
                      type: "base64",
                      media_type: mediaType,
                      data: keBase64(foto),
                    },
                  },
                  {
                    // Konteks wadah dikirim sebagai penanda, bukan sebagai
                    // petunjuk jawaban. Model tidak diberi tahu porsi yang
                    // diharapkan — lihat catatan di kepala berkas.
                    type: "text",
                    text: `Wadah: ${konteks.wadahId}. Jenis masakan: ${konteks.jenisMasakanId}.`,
                  },
                ],
              },
            ],
          },
          { signal: pembatal.signal },
        );

        const latensiMs = sejakMulai();

        // Penolakan keamanan bukan kegagalan sistem — ia jawaban yang sah dan
        // artinya sama seperti jawaban tak terbaca: pakai jalur manual.
        if (jawaban.stop_reason === "refusal") {
          return { status: "perlu_manual", alasan: "jawaban_tidak_terbaca", latensiMs };
        }

        const blokTeks = jawaban.content.find((b) => b.type === "text");
        if (!blokTeks || blokTeks.type !== "text") {
          return { status: "perlu_manual", alasan: "jawaban_tidak_terbaca", latensiMs };
        }

        let terurai: unknown;
        try {
          terurai = JSON.parse(blokTeks.text);
        } catch {
          return { status: "perlu_manual", alasan: "jawaban_tidak_terbaca", latensiMs };
        }

        const isi = terurai as { fraksi?: unknown; keyakinan?: unknown };
        const fraksi = bacaPecahan(isi.fraksi);
        const keyakinan = bacaPecahan(isi.keyakinan);

        if (fraksi === null || keyakinan === null) {
          return { status: "perlu_manual", alasan: "jawaban_tidak_terbaca", latensiMs };
        }

        return { status: "terbaca", fraksi, keyakinan, latensiMs };
      } catch (galat) {
        /*
         * Semua kegagalan berakhir di jalur manual, tidak satu pun naik ke
         * pengguna sebagai error. Operator yang tangannya basah dan sedang
         * terburu-buru tidak butuh tahu bahwa kuota API habis — ia butuh
         * slider yang sudah ada di layar.
         */
        const timeout =
          pembatal.signal.aborted ||
          (galat instanceof Error &&
            (galat.name === "AbortError" || galat.name === "APIUserAbortError"));

        return menyerah(timeout ? "timeout" : "panggilan_gagal");
      } finally {
        clearTimeout(penghitung);
      }
    },
  };
}
