import { NextResponse } from "next/server";

/*
 * Bentuk respons dan pesan ke pengguna — satu tempat.
 *
 * CLAUDE.md bagian 5 menetapkan dua hal yang sering dilanggar diam-diam:
 *
 * 1. Route handler mengembalikan bentuk KONSISTEN `{ ok: false, kode, pesan }`,
 *    dan `kode` adalah konstanta bertipe, bukan string bebas.
 * 2. Pesan ditulis dalam bahasa manusia. Penggunanya juru masak yang tangannya
 *    basah dan sedang terburu-buru — bukan orang yang akan membaca
 *    "Error 422: validation failed" lalu tahu harus berbuat apa.
 *
 * Dengan pesan terkumpul di satu berkas, aturan "tidak ada kata menghakimi"
 * bisa DIUJI, bukan sekadar diingat: satu tes menyapu seluruh tabel di bawah.
 * Kalau pesan tersebar di tujuh route handler, tes itu mustahil ditulis dan
 * kata "gagal" akan menyelinap masuk pada sprint keenam.
 */

export const KODE_GALAT = {
  VALIDASI_GAGAL: "VALIDASI_GAGAL",
  TANGGAL_SUDAH_ADA: "TANGGAL_SUDAH_ADA",
  CATATAN_TIDAK_DITEMUKAN: "CATATAN_TIDAK_DITEMUKAN",
  ESTIMASI_TIDAK_DITEMUKAN: "ESTIMASI_TIDAK_DITEMUKAN",
  WADAH_TIDAK_TERDAFTAR: "WADAH_TIDAK_TERDAFTAR",
  TIMEOUT_MODEL: "TIMEOUT_MODEL",
  FOTO_TIDAK_TERBACA: "FOTO_TIDAK_TERBACA",
  BELUM_ADA_ESTIMASI: "BELUM_ADA_ESTIMASI",
  KOREKSI_DI_LUAR_BATAS: "KOREKSI_DI_LUAR_BATAS",
  GALAT_TAK_TERDUGA: "GALAT_TAK_TERDUGA",
} as const;

export type KodeGalatApi = (typeof KODE_GALAT)[keyof typeof KODE_GALAT];

/**
 * Pesan bawaan per kode.
 *
 * Setiap kalimat di sini menjawab pertanyaan "lalu saya harus apa?", bukan
 * menerangkan apa yang salah di dalam sistem. Bandingkan:
 *
 *   ❌ "Request timeout"
 *   ✅ "Sinyal lambat — pakai geser saja, hasilnya sama."
 *
 * Yang kedua memberi tahu operator jalan keluarnya dalam satu kalimat, dan
 * sekaligus mengatakan bahwa jalan keluar itu tidak lebih rendah mutunya.
 */
export const PESAN_BAWAAN: Readonly<Record<KodeGalatApi, string>> = {
  VALIDASI_GAGAL: "Angkanya belum diisi.",
  TANGGAL_SUDAH_ADA:
    "Tanggal ini sudah pernah dicatat. Buka catatannya untuk menambah wadah.",
  CATATAN_TIDAK_DITEMUKAN: "Catatan hari ini belum dibuat.",
  ESTIMASI_TIDAK_DITEMUKAN: "Pembacaan ini sudah tidak ada.",
  WADAH_TIDAK_TERDAFTAR: "Wadah ini belum terdaftar di dapur ini.",
  TIMEOUT_MODEL: "Sinyal lambat — pakai geser saja, hasilnya sama.",
  FOTO_TIDAK_TERBACA: "Fotonya belum terbaca — pakai geser saja, hasilnya sama.",
  BELUM_ADA_ESTIMASI: "Belum ada wadah yang dicatat untuk hari ini.",
  KOREKSI_DI_LUAR_BATAS: "Angkanya lebih besar dari muatan wadah ini. Coba periksa lagi.",
  GALAT_TAK_TERDUGA: "Belum tersimpan. Coba sekali lagi.",
};

export interface BadanGalat {
  ok: false;
  kode: KodeGalatApi;
  pesan: string;
}

export function galat(
  kode: KodeGalatApi,
  status: number,
  pesan?: string,
): NextResponse<BadanGalat> {
  return NextResponse.json<BadanGalat>(
    { ok: false, kode, pesan: pesan ?? PESAN_BAWAAN[kode] },
    { status },
  );
}

export function sukses<T>(data: T, status = 200): NextResponse<{ ok: true } & T> {
  return NextResponse.json({ ok: true, ...data }, { status });
}

/**
 * Pembungkus yang memastikan kesalahan tak terduga TIDAK PERNAH sampai ke layar
 * sebagai stack trace.
 *
 * CLAUDE.md bagian 5: "Kesalahan tak terduga tidak menampilkan stack trace ke
 * pengguna." Detailnya tetap dicatat di log server — yang hilang hanya
 * kebocoran ke layar operator, bukan kemampuan kita mendiagnosisnya.
 */
export async function tangani(kerjakan: () => Promise<Response>): Promise<Response> {
  try {
    return await kerjakan();
  } catch (penyebab) {
    console.error("[api] galat tak terduga:", penyebab);
    return galat(KODE_GALAT.GALAT_TAK_TERDUGA, 500);
  }
}
