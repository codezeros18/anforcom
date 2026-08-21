import { db } from "@/lib/db";
import {
  agregasiAkurasi,
  type EstimasiUntukAudit,
  type HasilAgregasiAkurasi,
} from "@/core/audit";
import { porsiDariString } from "@/core/porsi";
import type { KategoriFisik } from "@/core/tipe";

/*
 * Data halaman Akurasi — layar 8.
 *
 * KENAPA HALAMAN INI ADA. Pertanyaan juri yang paling sering muncul adalah
 * "kalau AI-nya salah bagaimana?" (BLUEPRINT P3). Jawaban terbaik untuk
 * pertanyaan itu bukan penjelasan, melainkan halaman yang bisa dibuka orang
 * lain dan diperiksa sendiri. Sistem yang tidak bisa menunjukkan kesalahannya
 * sendiri tidak bisa dipercaya soal keberhasilannya.
 *
 * KONSEKUENSINYA UNTUK BERKAS INI: tidak ada satu pun angka yang di-hardcode,
 * dan tidak ada satu pun yang diperhalus. Seluruhnya dihitung dari jejak audit
 * lewat `core/audit.ts` — berkas yang sama yang dipakai mesin kalibrasi, jadi
 * angka yang tampil di layar adalah angka yang sungguh dipakai sistem.
 *
 * Berkas ini SENGAJA tidak menghitung apa pun sendiri. Ia memetakan baris
 * Prisma ke bentuk `/core`, memanggil `agregasiAkurasi()`, dan menyerahkan
 * hasilnya. Satu-satunya penyusunan yang terjadi di sini adalah TREN, dan
 * caranya pun memanggil `agregasiAkurasi()` dua kali — bukan rumus baru.
 */

export interface TrenAkurasi {
  /** Simpangan pada paruh AWAL koreksi, sebagai teks dua desimal. */
  simpanganAwal: string;
  /** Simpangan pada paruh AKHIR koreksi. */
  simpanganAkhir: string;
  jumlahKoreksiAwal: number;
  jumlahKoreksiAkhir: number;
  /** `true` bila simpangan akhir lebih kecil daripada simpangan awal. */
  membaik: boolean;
}

export interface DataAkurasi extends HasilAgregasiAkurasi {
  /** `null` bila koreksi belum cukup untuk membelah dua paruh yang bermakna. */
  tren: TrenAkurasi | null;
  /** Alasan estimasi dikecualikan, apa adanya dari catatan hariannya. */
  alasanDikecualikan: string[];
}

/**
 * Koreksi minimum sebelum tren ditampilkan.
 *
 * Di bawah ini, "membaik" atau "memburuk" hanyalah derau dua titik data yang
 * kebetulan berbeda. Menampilkannya sebagai tren akan mengklaim sesuatu yang
 * datanya belum bisa dukung — persis kesalahan yang halaman ini dibuat untuk
 * tidak melakukannya.
 */
const MINIMUM_KOREKSI_UNTUK_TREN = 6;

interface BarisEstimasi {
  id: string;
  porsiEstimasi: { toString(): string };
  jenisMasakan: { kategoriFisik: KategoriFisik };
  catatanHarian: { isAnomali: boolean; alasanAnomali: string | null };
  koreksi: { porsiSesudah: { toString(): string }; dibuatPada: Date }[];
}

function keBentukAudit(baris: BarisEstimasi): EstimasiUntukAudit {
  return {
    id: baris.id,
    kategoriFisik: baris.jenisMasakan.kategoriFisik,
    porsiEstimasi: porsiDariString(baris.porsiEstimasi.toString()),
    isAnomali: baris.catatanHarian.isAnomali,
    koreksi: baris.koreksi.map((k) => ({
      porsiSesudah: porsiDariString(k.porsiSesudah.toString()),
      dibuatPada: k.dibuatPada,
    })),
  };
}

/**
 * Tren simpangan: apakah sistem membaik seiring bertambahnya koreksi.
 *
 * Caranya: estimasi yang punya koreksi diurutkan berdasarkan waktu koreksi
 * PERTAMA-nya, lalu dibelah dua. Masing-masing paruh dihitung dengan
 * `agregasiAkurasi()` yang sama persis — jadi tidak ada rumus simpangan kedua
 * di dalam repositori ini yang bisa menyimpang dari yang pertama.
 */
function hitungTren(estimasi: readonly EstimasiUntukAudit[]): TrenAkurasi | null {
  const dikoreksi = estimasi
    .filter((e) => !e.isAnomali && e.koreksi.length > 0)
    .map((e) => ({
      estimasi: e,
      pertama: Math.min(...e.koreksi.map((k) => k.dibuatPada.getTime())),
    }))
    .sort((a, b) => a.pertama - b.pertama)
    .map((x) => x.estimasi);

  if (dikoreksi.length < MINIMUM_KOREKSI_UNTUK_TREN) return null;

  const tengah = Math.floor(dikoreksi.length / 2);
  const awal = agregasiAkurasi(dikoreksi.slice(0, tengah));
  const akhir = agregasiAkurasi(dikoreksi.slice(tengah));

  // Bila salah satu paruh tidak punya simpangan terukur — misalnya seluruh
  // koreksinya menjadi nol porsi — tidak ada yang bisa dibandingkan.
  if (awal.simpanganRataPersen === null || akhir.simpanganRataPersen === null) {
    return null;
  }

  return {
    simpanganAwal: awal.simpanganRataPersen,
    simpanganAkhir: akhir.simpanganRataPersen,
    jumlahKoreksiAwal: awal.jumlahDikoreksi,
    jumlahKoreksiAkhir: akhir.jumlahDikoreksi,
    membaik: Number(akhir.simpanganRataPersen) < Number(awal.simpanganRataPersen),
  };
}

export async function ambilDataAkurasi(dapurId: string): Promise<DataAkurasi> {
  const baris = await db.estimasi.findMany({
    where: { catatanHarian: { dapurId } },
    include: {
      jenisMasakan: { select: { kategoriFisik: true } },
      catatanHarian: { select: { isAnomali: true, alasanAnomali: true } },
      koreksi: { orderBy: { dibuatPada: "asc" } },
    },
  });

  const untukAudit = baris.map(keBentukAudit);

  const alasanDikecualikan = [
    ...new Set(
      baris
        .filter((b) => b.catatanHarian.isAnomali)
        .map((b) => b.catatanHarian.alasanAnomali)
        .filter((a): a is string => a !== null && a.trim() !== ""),
    ),
  ];

  return {
    ...agregasiAkurasi(untukAudit),
    tren: hitungTren(untukAudit),
    alasanDikecualikan,
  };
}
