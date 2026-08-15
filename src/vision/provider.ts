/*
 * Kontrak tunggal lapisan penglihatan.
 *
 * INI BERKAS TERPENTING UNTUK KLAIM ARSITEKTUR PROYEK INI.
 *
 * Klaim itu berbunyi: "model penglihatan bisa dicabut tanpa mematikan sistem".
 * Yang membuatnya bisa dibuktikan bukan penjelasan, melainkan fakta bahwa
 * `model-provider` dan `manual-provider` sama-sama memenuhi antarmuka di bawah
 * dan mengembalikan BENTUK YANG IDENTIK. Pemanggil tidak bisa membedakan
 * keduanya, jadi mencabut model berarti menukar satu objek — bukan mengubah
 * alur.
 *
 * BLUEPRINT P4: "Slider setara, bukan darurat." Slider bukan penanganan
 * kegagalan; ia jalur pertama yang setara. Kalau slider baru muncul ketika foto
 * gagal, ia terasa seperti kerusakan. Kalau ia sudah ada sejak awal, peralihan
 * terasa seperti pilihan.
 *
 * Berkas di folder ini TIDAK mengimpor apa pun dari `/src/core` maupun
 * `/src/app` — dijaga aturan ESLint. Arah impor satu jalan: app -> vision,
 * vision -> tidak ke mana-mana.
 */

/** Batas waktu satu panggilan model, dalam milidetik. Mengikat di BLUEPRINT bagian 8. */
export const TIMEOUT_MODEL_MS = 6_000;

export interface KonteksPembacaan {
  wadahId: string;
  jenisMasakanId: string;
  /**
   * Fraksi dari geseran operator, 0..1.
   *
   * Diisi hanya pada jalur manual. `model-provider` mengabaikannya sepenuhnya —
   * ia ada di konteks bersama supaya kedua provider memenuhi satu tanda tangan
   * yang sama, yang justru inti dari berkas ini.
   */
  fraksiManual?: number;
}

/** Kenapa jalur manual harus dipakai. Bukan pesan untuk pengguna — kode untuk UI. */
export type AlasanPerluManual =
  /** Model tidak menjawab dalam batas waktu. */
  | "timeout"
  /** Model menjawab, tapi jawabannya tidak bisa dipakai. */
  | "jawaban_tidak_terbaca"
  /** Panggilan gagal (jaringan, kuota, kunci). */
  | "panggilan_gagal"
  /** Model sengaja dimatikan lewat VISION_ENABLED=false. */
  | "model_dimatikan";

export interface BacaanTerbaca {
  status: "terbaca";
  /**
   * Seberapa penuh wadah, 0..1.
   *
   * Bertipe `number` — satu-satunya tempat di sistem ini yang memakainya untuk
   * besaran domain. Ini disengaja dan aman: nilai ini adalah PENGUKURAN dari
   * luar, bukan hasil perhitungan kita.
   *
   * KEWAJIBAN PEMANGGIL: kuantisasi ke empat desimal dan ubah menjadi `Fraksi`
   * lewat `fraksiDariString(fraksi.toFixed(4))` SEBELUM angka ini menyentuh
   * perhitungan apa pun. Lapisan ini tidak bisa melakukannya sendiri — ia
   * dilarang mengimpor dari `/src/core`, dan larangan itu justru yang membuat
   * model bisa dicabut. Route handler Sprint 5 yang menjembataninya; contoh
   * lengkapnya ada di `src/__tests__/alur-tanpa-model.test.ts`.
   */
  fraksi: number;
  /** Keyakinan model, 0..1. Untuk ditampilkan dan dicatat — tidak pernah masuk hitungan. */
  keyakinan: number;
  latensiMs: number;
}

export interface BacaanPerluManual {
  status: "perlu_manual";
  alasan: AlasanPerluManual;
  latensiMs: number;
}

/**
 * Hasil satu pembacaan.
 *
 * CATATAN PENYIMPANGAN DARI SPESIFIKASI TUGAS.
 * Spesifikasi Sprint 4.1 menulis `baca(...) => Promise<{fraksi, keyakinan, latensiMs}>`.
 * Spesifikasi yang sama juga mewajibkan: "Setelah timeout, jangan lempar error
 * ke pengguna — KEMBALIKAN SINYAL bahwa jalur manual harus dipakai."
 *
 * Kedua hal itu tidak muat dalam satu bentuk kembalian tunggal, jadi bentuknya
 * dijadikan union: cabang `terbaca` memuat persis ketiga field yang diminta,
 * dan cabang `perlu_manual` adalah sinyal yang diminta kalimat kedua.
 *
 * Efek sampingnya menguntungkan: pemanggil TIDAK BISA membaca `fraksi` tanpa
 * memeriksa `status` lebih dulu — kompilator menolaknya. Jadi jalur fallback
 * mustahil terlupakan, dan itu justru jaminan yang dicari P4.
 */
export type HasilBaca = BacaanTerbaca | BacaanPerluManual;

export interface PembacaFraksi {
  /** Nama provider, untuk dicatat di log dan ditampilkan di halaman Akurasi. */
  readonly nama: "model" | "manual";

  baca(foto: Uint8Array | null, konteks: KonteksPembacaan): Promise<HasilBaca>;
}
