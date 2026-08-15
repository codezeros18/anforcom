"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BingkaiKamera } from "@/components/BingkaiKamera";
import { KartuEstimasi } from "@/components/KartuEstimasi";
import {
  DaftarJenisMasakan,
  DaftarWadah,
  type JenisMasakanPilihan,
  type WadahPilihan,
} from "@/components/PilihanWadah";
import {
  PesanTransisi,
  sliderAktifPada,
  usePesanTransisi,
} from "@/components/PesanTransisi";
import { SliderFraksi } from "@/components/SliderFraksi";

/*
 * LAYAR 3 — inti alur pencatatan. Di sinilah lima ketukan itu terjadi.
 *
 *   ketukan 1  pilih wadah          (~3 dtk)
 *   ketukan 2  pilih jenis masakan  (~2 dtk)
 *   ketukan 3  rana kamera          (~4 dtk)  -> estimasi muncul (~3 dtk)
 *   ketukan 4  "Benar", ATAU geser lalu "Simpan"  (~5 dtk)
 *   ketukan 5  "Selesai"            (~2 dtk)   -> di layar penyaluran
 *
 * DUA HAL YANG MENENTUKAN APAKAH ANGKA ITU TERCAPAI:
 *
 * 1. SLIDER SELALU ADA DI LAYAR INI. Bukan layar terpisah, bukan di balik
 *    menu, bukan muncul setelah foto gagal. Ia dirender di bawah kamera sejak
 *    awal dan menjadi aktif pada detik 1,5. Jalur geser karena itu memakan
 *    jumlah ketukan yang SAMA dengan jalur foto — tanpa navigasi tambahan.
 *
 * 2. TIDAK ADA LANGKAH KONFIRMASI. Memilih wadah langsung memilih. Menekan
 *    "Benar" langsung menyimpan. Setiap "Yakin?" menggandakan ketukan pada
 *    langkah yang dia jaga, demi mencegah kesalahan yang bisa dibetulkan
 *    dengan satu ketukan lagi kapan saja.
 */

export interface LayarPencatatanProps {
  catatanId: string;
  porsiDimasak: string;
  wadah: readonly WadahPilihan[];
  jenisMasakan: readonly JenisMasakanPilihan[];
  /** porsiPenuh per pasangan `wadahId|jenisMasakanId`, untuk pratinjau slider. */
  porsiPenuhPerPasangan: Readonly<Record<string, number>>;
  jumlahWadahTercatat: number;
}

interface EstimasiTersimpan {
  id: string;
  porsiEstimasi: string;
  rentangBawah: string;
  rentangAtas: string;
  wajibManual: boolean;
  catatanKalibrasi: string | null;
}

export function LayarPencatatan({
  catatanId,
  porsiDimasak,
  wadah,
  jenisMasakan,
  porsiPenuhPerPasangan,
  jumlahWadahTercatat,
}: LayarPencatatanProps) {
  const router = useRouter();

  const [wadahId, setWadahId] = useState<string | null>(null);
  const [jenisId, setJenisId] = useState<string | null>(null);
  const [isCampuran, setIsCampuran] = useState(false);

  const [membaca, setMembaca] = useState(false);
  const fase = usePesanTransisi(membaca);

  const [persen, setPersen] = useState(50);
  const [estimasi, setEstimasi] = useState<EstimasiTersimpan | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);
  const [menyimpan, setMenyimpan] = useState(false);
  const [tersimpan, setTersimpan] = useState(jumlahWadahTercatat);

  const siap = wadahId !== null && jenisId !== null;
  const porsiPenuh = siap
    ? (porsiPenuhPerPasangan[`${wadahId}|${jenisId}`] ?? null)
    : null;

  /*
   * Slider aktif sejak detik 1,5 saat foto sedang dibaca, DAN aktif sepanjang
   * waktu ketika tidak ada pembacaan berjalan. Ia tidak pernah menunggu
   * kegagalan.
   */
  const sliderAktif = siap && !menyimpan && (!membaca || sliderAktifPada(fase));

  function bacaJawaban(badan: unknown): EstimasiTersimpan | null {
    const isi = badan as {
      estimasi?: {
        id: string;
        porsiEstimasi: string;
        rentangBawah: string;
        rentangAtas: string;
        wajibManual: boolean;
        sumberKalibrasi: "deklarasi" | "terkalibrasi";
        konstantaPerkiraan: boolean;
      };
    };
    if (!isi.estimasi) return null;

    const e = isi.estimasi;
    const catatanKalibrasi =
      e.sumberKalibrasi === "deklarasi"
        ? "Belum terkalibrasi — angka akan membaik setelah beberapa koreksi."
        : e.konstantaPerkiraan
          ? "Angka ini perkiraan dari wadah sejenis."
          : null;

    return {
      id: e.id,
      porsiEstimasi: e.porsiEstimasi,
      rentangBawah: e.rentangBawah,
      rentangAtas: e.rentangAtas,
      wajibManual: e.wajibManual,
      catatanKalibrasi,
    };
  }

  async function kirimFoto(berkas: File) {
    if (!siap) return;

    setMembaca(true);
    setPesan(null);

    const formulir = new FormData();
    formulir.append("foto", berkas);
    formulir.append("wadahId", wadahId);
    formulir.append("jenisMasakanId", jenisId);
    formulir.append("isCampuran", String(isCampuran));

    try {
      const jawaban = await fetch(`/api/catatan/${catatanId}/estimasi`, {
        method: "POST",
        body: formulir,
      });
      const badan: unknown = await jawaban.json();

      if (!jawaban.ok) {
        /*
         * Pesan dari server sudah berbahasa manusia dan sudah menyebut jalan
         * keluarnya ("pakai geser saja, hasilnya sama"). Layar tidak
         * menambahkan apa pun — slider di bawah sudah aktif.
         */
        setPesan(
          (badan as { pesan?: string }).pesan ?? "Pakai geser saja, hasilnya sama.",
        );
        return;
      }

      setEstimasi(bacaJawaban(badan));
    } catch {
      setPesan("Sinyal lambat — pakai geser saja, hasilnya sama.");
    } finally {
      setMembaca(false);
    }
  }

  async function kirimGeseran() {
    if (!siap) return;

    setMenyimpan(true);
    setPesan(null);

    try {
      const jawaban = await fetch(`/api/catatan/${catatanId}/estimasi-manual`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          wadahId,
          jenisMasakanId: jenisId,
          // Persen bulat menjadi fraksi empat desimal — dikirim sebagai TEKS
          // supaya tidak melewati float sebelum sampai di server.
          fraksiKeterisian: (persen / 100).toFixed(4),
          isCampuran,
        }),
      });
      const badan: unknown = await jawaban.json();

      if (!jawaban.ok) {
        setPesan(
          (badan as { pesan?: string }).pesan ?? "Belum tersimpan. Coba sekali lagi.",
        );
        return;
      }

      selesaikanWadah();
    } catch {
      setPesan("Belum tersimpan. Coba sekali lagi.");
    } finally {
      setMenyimpan(false);
    }
  }

  function selesaikanWadah() {
    setTersimpan((n) => n + 1);
    setEstimasi(null);
    setWadahId(null);
    setJenisId(null);
    setIsCampuran(false);
    setPersen(50);
    setPesan(null);
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-5 p-4">
      <header>
        <h1 className="text-badan font-semibold text-netral-900">Potret sisa</h1>
        <p className="text-konteks text-netral-600">
          Dimasak {porsiDimasak} porsi
          {tersimpan > 0 && ` · ${String(tersimpan)} wadah tercatat`}
        </p>
      </header>

      {/* Ketukan 1 */}
      <section>
        <h2 className="text-konteks mb-2 text-netral-600">Wadah apa?</h2>
        <DaftarWadah wadah={wadah} terpilih={wadahId} onPilih={setWadahId} />
      </section>

      {/* Ketukan 2 */}
      <section>
        <h2 className="text-konteks mb-2 text-netral-600">Isinya apa?</h2>
        <DaftarJenisMasakan
          jenis={jenisMasakan}
          terpilih={jenisId}
          onPilih={setJenisId}
        />
      </section>

      <label className="text-badan flex items-center gap-3 text-netral-800">
        <input
          type="checkbox"
          checked={isCampuran}
          onChange={(e) => {
            setIsCampuran(e.target.checked);
          }}
          className="h-6 w-6 accent-aksen-500"
        />
        Isinya tercampur beberapa jenis
      </label>

      {estimasi === null ? (
        <>
          {/* Ketukan 3 */}
          <BingkaiKamera
            onFoto={(b) => void kirimFoto(b)}
            aktif={siap}
            sedangMembaca={membaca}
          />

          {membaca && <PesanTransisi fase={fase} />}

          {pesan && (
            <p
              className="text-badan rounded-xl bg-perhatian-100 px-4 py-3 text-perhatian-700"
              role="status"
            >
              {pesan}
            </p>
          )}

          {/*
           * SLIDER SELALU DI SINI. Dirender bersama kamera, bukan sesudahnya,
           * bukan menggantikannya. Inilah bentuk konkret P4.
           */}
          <SliderFraksi
            persen={persen}
            onUbah={setPersen}
            porsiPenuh={porsiPenuh}
            aktif={sliderAktif}
            onSimpan={() => void kirimGeseran()}
            menyimpan={menyimpan}
          />
        </>
      ) : (
        /* Ketukan 4 */
        <KartuEstimasi
          porsiEstimasi={estimasi.porsiEstimasi}
          rentangBawah={estimasi.rentangBawah}
          rentangAtas={estimasi.rentangAtas}
          catatanKalibrasi={estimasi.catatanKalibrasi}
          wajibManual={estimasi.wajibManual}
          menyimpan={menyimpan}
          onBenar={selesaikanWadah}
          onKoreksi={() => {
            // "Koreksi" mengembalikan ke slider dengan angka pembacaan sebagai
            // titik awal — operator menggeser dari angka yang sudah dekat,
            // bukan dari nol.
            setEstimasi(null);
            setPesan(null);
          }}
        />
      )}

      {/* Ketukan 5 */}
      <div className="mt-auto grid grid-cols-2 gap-3 pt-2">
        <button
          type="button"
          onClick={selesaikanWadah}
          disabled={estimasi === null && tersimpan === 0}
          className="text-badan h-14 rounded-xl border-2 border-netral-300 font-medium text-netral-800 disabled:opacity-40"
        >
          Tambah wadah
        </button>
        <button
          type="button"
          onClick={() => {
            router.push(`/catat/${catatanId}/penyaluran`);
          }}
          disabled={tersimpan === 0}
          className="text-badan h-14 rounded-xl bg-aksen-500 font-semibold text-white active:bg-aksen-600 disabled:opacity-40"
        >
          Selesai
        </button>
      </div>
    </main>
  );
}
