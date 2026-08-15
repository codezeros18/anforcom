import { describe, expect, it } from "vitest";
import { ambilPembacaFraksi } from "../vision/index.ts";
import type { HasilBaca, PembacaFraksi } from "../vision/provider.ts";
import {
  buatKalibrasiAwal,
  cariKonstanta,
  hitungPorsiTersisa,
  hitungRentang,
  type KonteksKalibrasi,
} from "../core/kalibrasi.ts";
import { catatKoreksi, hitungPorsiFinal } from "../core/audit.ts";
import { type CatatanUntukRekomendasi, hitungRekomendasi } from "../core/rekomendasi.ts";
import { fraksiDariString, type Fraksi } from "../core/fraksi.ts";
import {
  type Porsi,
  porsiDariString,
  porsiDariUtuh,
  porsiKeStringRingkas,
  porsiKurang,
} from "../core/porsi.ts";

/*
 * ===========================================================================
 * TES 4.11 — BUKTI TUNGGAL UNTUK KLAIM ARSITEKTUR TERPENTING PROYEK INI.
 * ===========================================================================
 *
 * Klaimnya: "model penglihatan bisa dicabut tanpa mematikan sistem."
 *
 * Kalau berkas ini merah, klaim itu bohong dan seluruh pitch teknis runtuh.
 * Karena itu ia dijalankan DUA KALI di CI: sekali biasa, sekali dengan
 * VISION_ENABLED=false.
 *
 * Yang diuji bukan satu fungsi, melainkan ALUR PENCATATAN PENUH dari awal
 * sampai akhir — pembacaan fraksi, kalibrasi, estimasi, rentang, koreksi,
 * finalisasi, sampai rekomendasi besok. Menguji provider saja tidak cukup:
 * provider bisa saja setara sementara ada sesuatu di hilir yang diam-diam
 * bergantung pada adanya foto.
 *
 * Berkas ini juga berfungsi sebagai spesifikasi hidup untuk route handler
 * Sprint 5 — urutan pemanggilannya persis seperti yang harus terjadi di sana,
 * termasuk kuantisasi fraksi di batas sistem.
 */

// ---------------------------------------------------------------------------
// Dapur uji
// ---------------------------------------------------------------------------

const WADAH = "nampan-nasi";
const JENIS = "nasi-putih";

const KONTEKS_KALIBRASI: KonteksKalibrasi = {
  kalibrasi: [buatKalibrasiAwal(WADAH, JENIS, porsiDariUtuh(120))],
  jenisMasakan: [{ id: JENIS, kategoriFisik: "padat_menggunung" }],
};

/**
 * Kuantisasi fraksi di batas sistem.
 *
 * INILAH SATU-SATUNYA TEMPAT angka `number` dari lapisan penglihatan berubah
 * menjadi desimal eksak. Sesudah baris ini tidak ada lagi float di jalur
 * perhitungan mana pun — persis yang diwajibkan CLAUDE.md aturan 3.
 *
 * `/src/vision` tidak bisa melakukannya sendiri karena dilarang mengimpor dari
 * `/src/core`, dan larangan itu justru yang membuat model bisa dicabut.
 */
function keFraksiEksak(dariPenglihatan: number): Fraksi {
  return fraksiDariString(dariPenglihatan.toFixed(4));
}

interface HasilPencatatan {
  namaProvider: string;
  fraksi: Fraksi;
  porsiEstimasi: Porsi;
  rentangBawah: Porsi;
  rentangAtas: Porsi;
  wajibManual: boolean;
  porsiFinal: Porsi;
  adaKoreksi: boolean;
}

/**
 * Satu pencatatan penuh, dari foto (atau geseran) sampai porsi final.
 *
 * Perhatikan bahwa fungsi ini tidak pernah menanyakan provider mana yang
 * dipakai. Ia hanya memeriksa `status` — dan itulah bentuk dari "model bisa
 * dicabut".
 */
async function catatSatuHari(
  pembaca: PembacaFraksi,
  foto: Uint8Array | null,
  fraksiGeseran: number | undefined,
  koreksiOperator: string | null,
): Promise<HasilPencatatan> {
  const bacaan: HasilBaca = await pembaca.baca(foto, {
    wadahId: WADAH,
    jenisMasakanId: JENIS,
    fraksiManual: fraksiGeseran,
  });

  /*
   * Jalur fallback. Bukan penanganan error — kalau model tidak menjawab,
   * angka geseran operator dipakai dan alur berjalan terus. Tidak ada error
   * yang naik ke pengguna.
   */
  const fraksiMentah = bacaan.status === "terbaca" ? bacaan.fraksi : (fraksiGeseran ?? 0);
  const fraksi = keFraksiEksak(fraksiMentah);

  const konstanta = cariKonstanta(KONTEKS_KALIBRASI, WADAH, JENIS);
  const porsiEstimasi = hitungPorsiTersisa(fraksi, konstanta.porsiPenuh);

  const rentang = hitungRentang({
    porsiEstimasi,
    kategoriFisik: "padat_menggunung",
    perkiraan: konstanta.perkiraan,
    isCampuran: false,
    sumber: konstanta.sumber,
  });

  const estimasi = { id: "estimasi-1", porsiEstimasi };
  const koreksi = koreksiOperator
    ? [
        {
          porsiSesudah: porsiDariString(koreksiOperator),
          dibuatPada: new Date("2026-08-14T10:00:00.000Z"),
        },
      ]
    : [];

  if (koreksiOperator) {
    // Koreksi selalu baris baru — tidak pernah menimpa estimasi.
    const baris = catatKoreksi({
      estimasi,
      koreksiSebelumnya: [],
      porsiSesudah: porsiDariString(koreksiOperator),
      peranPengoreksi: "operator",
    });
    expect(baris.estimasiId).toBe("estimasi-1");
  }

  return {
    namaProvider: pembaca.nama,
    fraksi,
    porsiEstimasi,
    rentangBawah: rentang.bawah,
    rentangAtas: rentang.atas,
    wajibManual: rentang.wajibManual,
    porsiFinal: hitungPorsiFinal(estimasi, koreksi),
    adaKoreksi: koreksi.length > 0,
  };
}

function catatanHarian(
  hariLalu: number,
  konsumsi: number,
  besok: Date,
): CatatanUntukRekomendasi {
  const tanggal = new Date(besok);
  tanggal.setUTCDate(tanggal.getUTCDate() - hariLalu);
  return {
    id: `hari-${hariLalu}`,
    tanggal,
    porsiDimasak: porsiDariUtuh(konsumsi + 20),
    porsiTersisaFinal: porsiDariUtuh(20),
    isAnomali: false,
    alasanAnomali: null,
  };
}

const BESOK = new Date("2026-08-19T00:00:00.000Z");

// ---------------------------------------------------------------------------
// 4.11 — alur penuh tanpa model
// ---------------------------------------------------------------------------

describe("VISION_ENABLED=false: alur pencatatan penuh tetap lulus (4.11)", () => {
  const ENV_MATI = { VISION_ENABLED: "false" };

  it("provider yang terpilih adalah jalur manual", () => {
    expect(ambilPembacaFraksi({ env: ENV_MATI }).nama).toBe("manual");
  });

  it("SELURUH ALUR selesai dari awal sampai akhir, tanpa foto sama sekali", async () => {
    const pembaca = ambilPembacaFraksi({ env: ENV_MATI });

    // Operator menggeser slider ke 45% — tidak ada foto yang diambil.
    const hasil = await catatSatuHari(pembaca, null, 0.45, null);

    expect(hasil.namaProvider).toBe("manual");
    // 0.45 x 120 = 54
    expect(porsiKeStringRingkas(hasil.porsiEstimasi)).toBe("54");
    expect(porsiKeStringRingkas(hasil.porsiFinal)).toBe("54");
    // Konstanta masih deklarasi: rentang padat_menggunung 35% dilebarkan 1.5x = 52.5%
    expect(porsiKeStringRingkas(hasil.rentangBawah)).toBe("25.65");
    expect(porsiKeStringRingkas(hasil.rentangAtas)).toBe("82.35");
    expect(hasil.wajibManual).toBe(false);
  });

  it("koreksi operator tetap berfungsi tanpa model", async () => {
    const pembaca = ambilPembacaFraksi({ env: ENV_MATI });
    const hasil = await catatSatuHari(pembaca, null, 0.45, "48.00");

    expect(hasil.adaKoreksi).toBe(true);
    expect(porsiKeStringRingkas(hasil.porsiEstimasi)).toBe("54"); // estimasi utuh
    expect(porsiKeStringRingkas(hasil.porsiFinal)).toBe("48"); // final dari koreksi
  });

  it("REKOMENDASI BESOK tetap keluar tanpa model", async () => {
    /*
     * Ujung alur. Kalau rekomendasi tidak keluar tanpa model, sistem yang
     * "tetap berfungsi" itu hanya berfungsi sampai setengah jalan.
     */
    const pembaca = ambilPembacaFraksi({ env: ENV_MATI });
    const hariIni = await catatSatuHari(pembaca, null, 0.45, null);

    const riwayat = [1, 2, 3, 4, 5].map((h) => catatanHarian(h, 280, BESOK));
    const rekomendasi = hitungRekomendasi(riwayat, BESOK);

    expect(rekomendasi.status).toBe("siap");
    if (rekomendasi.status !== "siap") throw new Error("harus siap");

    expect(porsiKeStringRingkas(rekomendasi.rekomendasi)).toBe("280");
    expect(rekomendasi.kalimatAlasan).toContain("Konsumsi tertinggi dalam 14 hari");
    expect(hariIni.porsiFinal).toBeGreaterThan(0);
  });

  it("konsumsi aktual bisa dihitung dari hasil jalur manual", async () => {
    const pembaca = ambilPembacaFraksi({ env: ENV_MATI });
    const hasil = await catatSatuHari(pembaca, null, 0.25, null);

    const dimasak = porsiDariUtuh(300);
    const konsumsi = porsiKurang(dimasak, hasil.porsiFinal);

    // 0.25 x 120 = 30 tersisa -> 300 - 30 = 270 terpakai
    expect(porsiKeStringRingkas(konsumsi)).toBe("270");
  });

  it("tidak ada error yang naik ke pengguna di jalur mana pun", async () => {
    const pembaca = ambilPembacaFraksi({ env: ENV_MATI });

    for (const fraksi of [0, 0.0001, 0.5, 0.9999, 1]) {
      await expect(catatSatuHari(pembaca, null, fraksi, null)).resolves.toBeDefined();
    }
  });

  it("wadah tidak terdaftar tetap DITOLAK terbuka, bukan ditebak", async () => {
    /*
     * Mematikan model tidak boleh melonggarkan integritas. Sistem yang menolak
     * menebak saat model aktif harus tetap menolak menebak saat model dicabut.
     */
    expect(() => cariKonstanta(KONTEKS_KALIBRASI, "wadah-asing", JENIS)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Kesetaraan kedua jalur
// ---------------------------------------------------------------------------

describe("hasil hilir identik, apa pun provider yang dipakai", () => {
  it("fraksi yang sama menghasilkan angka akhir yang sama persis", async () => {
    /*
     * Ini yang membuat slider SETARA, bukan cadangan. Kalau jalur manual
     * menghasilkan angka yang sedikit berbeda dari jalur foto untuk keterisian
     * yang sama, maka ia bukan jalur setara — ia jalur kelas dua, dan
     * operator akan merasakannya.
     */
    const manual = ambilPembacaFraksi({
      env: { VISION_ENABLED: "false" },
    });

    const lewatSlider = await catatSatuHari(manual, null, 0.45, null);

    // Jalur model yang menjawab 0.45 untuk foto yang sama.
    const modelPalsu: PembacaFraksi = {
      nama: "model",
      baca: () =>
        Promise.resolve({
          status: "terbaca",
          fraksi: 0.45,
          keyakinan: 0.88,
          latensiMs: 1200,
        }),
    };
    const lewatFoto = await catatSatuHari(
      modelPalsu,
      new Uint8Array([0xff, 0xd8, 0xff]),
      undefined,
      null,
    );

    expect(lewatSlider.porsiEstimasi).toBe(lewatFoto.porsiEstimasi);
    expect(lewatSlider.rentangBawah).toBe(lewatFoto.rentangBawah);
    expect(lewatSlider.rentangAtas).toBe(lewatFoto.rentangAtas);
    expect(lewatSlider.porsiFinal).toBe(lewatFoto.porsiFinal);
  });

  it("timeout model jatuh ke geseran operator tanpa memutus alur", async () => {
    const modelTimeout: PembacaFraksi = {
      nama: "model",
      baca: () =>
        Promise.resolve({ status: "perlu_manual", alasan: "timeout", latensiMs: 6000 }),
    };

    // Operator sudah menggeser sementara menunggu — jalur itu yang dipakai.
    const hasil = await catatSatuHari(
      modelTimeout,
      new Uint8Array([0xff, 0xd8, 0xff]),
      0.45,
      null,
    );

    expect(porsiKeStringRingkas(hasil.porsiEstimasi)).toBe("54");
  });
});

// ---------------------------------------------------------------------------
// Sakelar sungguhan
// ---------------------------------------------------------------------------

describe("sakelar VISION_ENABLED yang sedang berlaku di proses ini", () => {
  it("alur selesai pada nilai env apa pun yang sedang aktif", async () => {
    /*
     * Tes ini membaca process.env sungguhan, jadi ia menguji hal yang berbeda
     * pada dua perintah verifikasi:
     *   npm test                     -> jalur model terpilih
     *   VISION_ENABLED=false npm test -> jalur manual terpilih
     *
     * Keduanya harus menyelesaikan alur. Perintah keempat di CLAUDE.md bagian 7
     * bukan formalitas — inilah yang membuatnya bukan sekadar mengulang
     * perintah ketiga.
     */
    const pembaca = ambilPembacaFraksi();
    const aktif = (process.env.VISION_ENABLED ?? "true").toLowerCase() !== "false";

    expect(pembaca.nama).toBe(aktif ? "model" : "manual");

    // Jalur manual dipakai apa pun providernya: kalau model aktif, ia tidak
    // diberi foto sehingga jatuh ke geseran; kalau mati, ia memang manual.
    const hasil = await catatSatuHari(pembaca, null, 0.45, null);
    expect(porsiKeStringRingkas(hasil.porsiEstimasi)).toBe("54");
  });
});
