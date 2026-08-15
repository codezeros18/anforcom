/*
 * Tipe domain bersama untuk `/core`.
 *
 * Sengaja TIDAK mengimpor tipe dari Prisma. `/core` adalah logika domain murni;
 * kalau ia bergantung pada tipe hasil generate ORM, maka menjalankan tesnya
 * memerlukan `prisma generate` lebih dulu, dan CI menjalankan tes tanpa basis
 * data sama sekali. Tipe di bawah adalah bentuk yang sama, dinyatakan sendiri,
 * dan lapisan `/app` yang memetakan hasil kueri Prisma ke bentuk ini.
 *
 * Nilai-nilainya sengaja identik dengan enum di `prisma/schema.prisma`. Kalau
 * skema berubah, berkas ini ikut berubah — dan itu memang perubahan yang layak
 * disadari, bukan disembunyikan di balik tipe otomatis.
 */

/** Menentukan lebar rentang keyakinan. Dipakai kalibrasi (Sprint 2) dan audit akurasi. */
export type KategoriFisik = "padat_rata" | "padat_menggunung" | "berkuah";

/**
 * Atribusi yang diizinkan sistem: PERAN, bukan orang.
 *
 * Lihat CLAUDE.md aturan 1. Tidak ada tipe untuk "siapa" karena tidak ada
 * kolomnya, dan tidak ada kolomnya karena ketakutan terbesar operator adalah
 * datanya dipakai untuk memarahi dia.
 */
export type Peran = "operator" | "pengelola";

export type MetodeEstimasi = "model" | "slider" | "manual";

/**
 * Asal konstanta kalibrasi.
 *
 * `deklarasi` — konstanta berasal dari jawaban operator saat pendaftaran wadah
 * ("kalau wadah ini penuh berisi nasi, kira-kira berapa porsi?"). Angka awal
 * datang dari pengetahuan dapur itu sendiri, bukan asumsi kita. Selama masih
 * `deklarasi`, rentang keyakinan dilebarkan karena belum teruji koreksi.
 *
 * `terkalibrasi` — konstanta sudah diperbarui dari riwayat koreksi operator
 * sebanyak ambang yang ditetapkan.
 *
 * Transisinya satu arah. Konstanta yang sudah terkalibrasi tidak pernah kembali
 * menjadi deklarasi.
 */
export type SumberKalibrasi = "deklarasi" | "terkalibrasi";

export const SEMUA_KATEGORI_FISIK: readonly KategoriFisik[] = [
  "padat_rata",
  "padat_menggunung",
  "berkuah",
];
