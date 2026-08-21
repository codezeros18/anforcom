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
  .refine((s) => s !== "", "Angkanya belum diisi.")
  /*
   * 9.9 / 9.11 / 9.15 — PESAN MENYEBUT MASALAH YANG SEBENARNYA.
   *
   * Satu regex untuk semua bentuk salah menghasilkan pesan yang menyesatkan:
   * "-5" dan "abc" bukan masalah jumlah desimal, tapi itulah yang akan dibaca
   * operator. Ia lalu menghapus desimalnya, gagal lagi, dan tidak tahu kenapa.
   *
   * Jadi bentuk salah dipisah menurut penyebabnya, dan tiap penyebab menyebut
   * jalan keluarnya sendiri.
   */
  .refine((s) => !s.startsWith("-"), "Angkanya tidak bisa minus.")
  .refine((s) => /^\d+([.,]\d*)?$/.test(s), "Isi angkanya saja, tanpa huruf.")
  .refine((s) => /^\d+(\.\d{1,2})?$/.test(s), "Angka porsi paling banyak dua desimal.")
  .refine((s) => Number(s) <= PORSI_MAKS, "Angkanya terlalu besar.")
  .refine((s) => Number(s) > 0, "Angkanya belum diisi.");

/** Sama seperti `porsiTeks`, tapi nol diperbolehkan — "ternyata habis" itu sah. */
export const porsiTeksBolehNol = z
  .string()
  .trim()
  .refine((s) => s !== "", "Angkanya belum diisi.")
  // 9.15 — koreksi ke angka negatif ditolak, dengan sebab yang benar.
  .refine((s) => !s.startsWith("-"), "Angkanya tidak bisa minus.")
  .refine((s) => /^\d+([.,]\d*)?$/.test(s), "Isi angkanya saja, tanpa huruf.")
  .refine((s) => /^\d+(\.\d{1,2})?$/.test(s), "Angka porsi paling banyak dua desimal.")
  .refine((s) => Number(s) <= PORSI_MAKS, "Angkanya terlalu besar.");

/** Fraksi keterisian 0..1 sebagai teks, paling banyak empat desimal. */
export const fraksiTeks = z
  .string()
  .trim()
  .regex(/^(0(\.\d{1,4})?|1(\.0{1,4})?)$/, "Keterisian harus antara 0 dan 1.");

/**
 * Batas atas porsi yang masih MASUK AKAL untuk satu hari dapur institusi.
 *
 * Berbeda dari `PORSI_MAKS`: angka di antara keduanya tetap DITERIMA, hanya
 * ditandai "di luar pola" (tugas 9.10). Bedanya penting — menolak 999.999
 * berarti menolak juga dapur yang memang sebesar itu, dan kita tidak tahu
 * dapur orang lain sebesar apa. Yang bisa kita katakan jujur hanyalah "angka
 * ini jauh di luar pola biasa", lalu membiarkan operator memutuskan.
 */
export const PORSI_WAJAR_MAKS = 5_000;

/** `true` bila angkanya sah tapi jauh di luar pola dapur institusi (9.10). */
export function diLuarPola(porsiTeksNilai: string): boolean {
  return Number(porsiTeksNilai) > PORSI_WAJAR_MAKS;
}

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
  }, "Tanggalnya terlalu jauh.")
  .refine((s) => {
    /*
     * 9.18 — TANGGAL MASA DEPAN DITOLAK.
     *
     * Pencatatan mundur diizinkan tanpa hukuman (5.17); pencatatan MAJU tidak,
     * karena porsi yang belum dimasak belum ada angkanya. Catatan bertanggal
     * besok akan masuk ke jendela rekomendasi sebagai hari yang sudah selesai,
     * dan menggeser lantai keras memakai data yang belum terjadi.
     *
     * Batasnya "hari ini di UTC", sama dengan kolom DATE-nya. Toleransi satu
     * hari sengaja TIDAK diberikan: dapur yang mencatat lewat tengah malam
     * memakai pemilih tanggal, bukan mengandalkan zona waktu server.
     */
    const hariIni = new Date();
    const batas = new Date(
      Date.UTC(hariIni.getUTCFullYear(), hariIni.getUTCMonth(), hariIni.getUTCDate()),
    );
    return new Date(`${s}T00:00:00.000Z`).getTime() <= batas.getTime();
  }, "Tanggalnya belum sampai. Catatan hanya untuk hari ini atau hari yang sudah lewat.");

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

// ---------------------------------------------------------------------------
// 9.4 — endpoint riset
// ---------------------------------------------------------------------------

/*
 * DUA ENDPOINT INI TIDAK PERNAH MUNCUL DI UI OPERATOR, dan tidak boleh.
 *
 * Keduanya adalah alat kerja lapangan tim: menimbang sisa dengan timbangan
 * gantung, dan mengumpulkan tebakan manusia sebelum penimbangan. Operator
 * tidak punya timbangan dan tidak punya alasan membuka layar ini.
 *
 * Alasannya bukan sekadar kerapian. `penimbangan_referensi` adalah SUMBER
 * TUNGGAL angka dampak (aturan keras 5). Kalau operator bisa mengisinya lewat
 * UI, angka klaim kita menjadi campuran timbangan tim dan tebakan lapangan —
 * dan seluruh Impact Projection berdiri di atas sesuatu yang tidak bisa kita
 * pertanggungjawabkan asalnya.
 */

/** Berat dalam GRAM BILANGAN BULAT (aturan keras 3). Bukan kilogram desimal. */
const beratGram = z
  .number()
  .int("Berat dicatat dalam gram bulat.")
  .min(0, "Berat tidak bisa minus.")
  .max(500_000, "Beratnya di luar batas timbangan.");

export const skemaPenimbangan = z.object({
  catatanHarianId: id,
  /** Null bila penimbangan mencakup beberapa wadah sekaligus. */
  wadahId: z.string().trim().min(1).nullable().optional(),
  beratGram,
  beratWadahKosongGram: beratGram,
  porsiSetara: porsiTeksBolehNol.nullable().optional(),
  /** Cara pengukuran, supaya angkanya bisa direplikasi orang lain. */
  metode: z
    .string()
    .trim()
    .min(1, "Tulis cara pengukurannya.")
    .max(120, "Keterangannya terlalu panjang."),
  tanggalUkur: tanggalTeks,
});

export const skemaTebakan = z.object({
  catatanHarianId: id,
  wadahId: id,
  /** PERAN, bukan orang (aturan keras 1). */
  peranPenebak: z.enum(["staf_dapur", "pengunjung_lokasi", "lainnya"]),
  tebakanPorsi: porsiTeksBolehNol,
  angkaSebenarnya: porsiTeksBolehNol,
  /** Kondisi saat menebak (pencahayaan, jarak, sudut pandang). */
  kondisi: z
    .string()
    .trim()
    .min(1, "Tulis kondisi saat menebak.")
    .max(160, "Keterangannya terlalu panjang."),
  tanggal: tanggalTeks,
});
