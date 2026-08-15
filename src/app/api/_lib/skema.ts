import { z } from "zod";

/*
 * Validasi di batas sistem (CLAUDE.md bagian 5).
 *
 * `/core` mengasumsikan input sudah tervalidasi. Berkas inilah yang membuat
 * asumsi itu benar.
 *
 * ATURAN YANG MUDAH LUPUT: "Semua nilai numerik divalidasi RENTANGNYA, bukan
 * hanya tipenya." Angka yang bertipe benar tapi mustahil secara fisik —
 * 999.999 porsi, fraksi 4.2, tanggal tahun 1899 — akan lolos validasi tipe dan
 * merusak perhitungan di hilir tanpa ada yang tahu penyebabnya.
 */

/** Batas atas porsi dalam satu catatan. Dapur institusi terbesar pun jauh di bawah ini. */
const PORSI_MAKS = 100_000;

/**
 * Porsi sebagai TEKS desimal, bukan `number`.
 *
 * Aturan 3 melarang float di jalur perhitungan. Menerima `number` dari JSON
 * berarti angka sudah melewati pecahan biner sebelum sempat kita periksa.
 * Menerimanya sebagai teks membuat `porsiDariString` di `/core` bisa mengurai
 * digitnya langsung.
 */
export const porsiTeks = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/, "Angka porsi paling banyak dua desimal.")
  .refine((s) => Number(s) <= PORSI_MAKS, "Angkanya terlalu besar.")
  .refine((s) => Number(s) > 0, "Angkanya belum diisi.");

/** Sama seperti `porsiTeks`, tapi nol diperbolehkan — "ternyata habis" itu sah. */
export const porsiTeksBolehNol = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/, "Angka porsi paling banyak dua desimal.")
  .refine((s) => Number(s) <= PORSI_MAKS, "Angkanya terlalu besar.");

/** Fraksi keterisian 0..1 sebagai teks, paling banyak empat desimal. */
export const fraksiTeks = z
  .string()
  .trim()
  .regex(/^(0(\.\d{1,4})?|1(\.0{1,4})?)$/, "Keterisian harus antara 0 dan 1.");

/** Tanggal operasional `YYYY-MM-DD`. */
export const tanggalTeks = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggalnya belum dipilih.")
  .refine((s) => {
    const d = new Date(`${s}T00:00:00.000Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }, "Tanggalnya tidak ada di kalender.")
  .refine((s) => {
    // Batas bawah yang longgar tapi bukan tak terbatas: pencatatan mundur
    // diizinkan tanpa hukuman, tapi tahun 1899 berarti salah ketik.
    const tahun = Number(s.slice(0, 4));
    return tahun >= 2020 && tahun <= 2100;
  }, "Tanggalnya terlalu jauh.");

const id = z.string().trim().min(1, "Pilihannya belum dibuat.");

// ---------------------------------------------------------------------------
// 5.1 — POST /api/catatan
// ---------------------------------------------------------------------------

export const skemaCatatanBaru = z.object({
  tanggal: tanggalTeks,
  porsiDimasak: porsiTeks,
  /*
   * Pencatatan mundur ditandai, TIDAK dihukum (tugas 5.17).
   *
   * Penandaan ini hanya untuk menelusuri kualitas data — tidak ada peringatan,
   * tidak ada "streak hilang", tidak ada pembeda di UI. Operator yang lupa
   * mencatat kemarin sedang sibuk memasak, bukan sedang melalaikan tugas.
   */
  dicatatMundur: z.boolean().optional().default(false),
  peranPencatat: z.enum(["operator", "pengelola"]).optional().default("operator"),
});

// ---------------------------------------------------------------------------
// 5.2 / 5.3 — estimasi
// ---------------------------------------------------------------------------

export const skemaEstimasiManual = z.object({
  wadahId: id,
  jenisMasakanId: id,
  fraksiKeterisian: fraksiTeks,
  isCampuran: z.boolean().optional().default(false),
});

/** Bidang non-berkas pada permintaan multipart. */
export const skemaEstimasiFoto = z.object({
  wadahId: id,
  jenisMasakanId: id,
  isCampuran: z
    .union([z.boolean(), z.literal("true"), z.literal("false")])
    .optional()
    .transform((v) => v === true || v === "true"),
});

// ---------------------------------------------------------------------------
// 5.4 — koreksi
// ---------------------------------------------------------------------------

export const skemaKoreksi = z.object({
  porsiSesudah: porsiTeksBolehNol,
  peranPengoreksi: z.enum(["operator", "pengelola"]).optional().default("operator"),
});

// ---------------------------------------------------------------------------
// 5.6 — penyaluran
// ---------------------------------------------------------------------------

export const skemaPenyaluran = z.object({
  tujuan: z.enum(["ternak", "kompos", "tpa"]),
  catatan: z.string().trim().max(160).optional(),
});

// ---------------------------------------------------------------------------
// 5.7 — anomali
// ---------------------------------------------------------------------------

export const skemaAnomali = z.object({
  /*
   * Alasan wajib diisi, dan itu satu-satunya kewajiban di seluruh alur.
   *
   * Hari anomali dikecualikan dari basis DAN dari lantai keras rekomendasi —
   * pengaruhnya besar dan bertahan dua minggu. Pengecualian sebesar itu harus
   * bisa dijelaskan kembali kepada siapa pun yang membaca angkanya nanti,
   * termasuk kepada operator itu sendiri tiga minggu kemudian.
   */
  alasan: z.string().trim().min(1, "Tulis sebentar alasannya.").max(160),
});

// ---------------------------------------------------------------------------
// 6.1 — pendaftaran wadah, jenis masakan, dan kalibrasi
// ---------------------------------------------------------------------------

/*
 * PERHATIKAN APA YANG TIDAK DIMINTA DI SINI: tidak ada diameter, tidak ada
 * tinggi, tidak ada volume dalam liter atau sentimeter.
 *
 * Operator tidak tahu ukuran pancinya dan tidak akan mengukurnya — meminta
 * angka itu akan menghentikan pendaftaran di wadah pertama. Yang dia tahu
 * betul justru yang kita butuhkan: berapa porsi yang muat kalau panci itu
 * penuh. Angka konstanta datang dari pengetahuan dapur itu sendiri, bukan dari
 * asumsi kita tentang geometri.
 */

export const skemaWadahBaru = z.object({
  nama: z
    .string()
    .trim()
    .min(1, "Nama wadahnya belum diisi.")
    .max(80, "Namanya terlalu panjang."),
  bentuk: z.enum(["panci", "nampan", "baskom", "ompreng", "box", "lainnya"]),
  fotoAcuanUrl: z.string().trim().max(2000).optional().nullable(),
});

export const skemaJenisMasakanBaru = z.object({
  nama: z
    .string()
    .trim()
    .min(1, "Nama masakannya belum diisi.")
    .max(80, "Namanya terlalu panjang."),
  kategoriFisik: z.enum(["padat_rata", "padat_menggunung", "berkuah"]),
});

export const skemaKalibrasiBaru = z.object({
  wadahId: id,
  jenisMasakanId: id,
  /** Jawaban operator atas "kalau penuh, kira-kira berapa porsi?" */
  porsiPenuh: porsiTeks,
});

/**
 * Mengubah galat Zod menjadi satu kalimat untuk operator.
 *
 * Hanya pesan PERTAMA yang ditampilkan. Daftar berisi lima keluhan sekaligus
 * membuat orang yang sedang terburu-buru berhenti membaca — dan yang pertama
 * biasanya memang yang perlu dibetulkan lebih dulu.
 */
export function pesanDariZod(galat: z.ZodError): string {
  const pertama = galat.issues[0];
  if (!pertama) return "Isinya belum lengkap.";
  if (pertama.message && !pertama.message.startsWith("Invalid")) return pertama.message;
  return "Isinya belum lengkap.";
}
