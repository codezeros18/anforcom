import { defineConfig } from "prisma/config";

/*
 * Konfigurasi CLI Prisma.
 *
 * Prisma 7 memisahkan konfigurasi CLI dari `schema.prisma`: sebagian perintah
 * (`db execute`, `db pull`) menolak jalan kalau `datasource.url` tidak juga
 * disebut di sini, walaupun blok `datasource` di skema sudah lengkap. Gejala
 * dan penyelesaiannya dicatat di PROGRESS.md bagian "jebakan lingkungan".
 *
 * Variabel lingkungan tidak dimuat otomatis oleh berkas ini. Perintah Prisma
 * dijalankan lewat skrip npm yang memakai `node --env-file-if-exists=.env.local`,
 * atau dengan `set -a; source .env.local` lebih dulu.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  /*
   * Hanya `url`. Prisma 7 menghapus `directUrl` — koneksi dibuka oleh driver
   * adapter (`@prisma/adapter-pg` di /src/lib/db.ts), bukan lagi oleh engine
   * bawaan, jadi tidak ada lagi kebutuhan menyebut koneksi langsung terpisah
   * dari koneksi ber-pooler.
   */
  datasource: {
    url: process.env.DATABASE_URL,
  },
  /*
   * `migrations.seed` sengaja TIDAK dipakai.
   *
   * Prisma 7.9 menerima kunci itu tanpa keluhan, tapi `prisma migrate reset`
   * tidak benar-benar menjalankannya — database berakhir kosong tanpa satu pun
   * pesan galat, yang jauh lebih membingungkan daripada gagal terang-terangan.
   * Bahwa flag `--skip-seed` juga sudah dihapus dari Prisma 7 mengonfirmasi
   * bahwa perintah reset memang tidak lagi pernah menyentuh seed.
   * Rantai reset + seed dibuat eksplisit di skrip npm `db:segar` supaya
   * urutannya terbaca dan kegagalannya terlihat. Gejalanya dicatat di
   * PROGRESS.md bagian "jebakan lingkungan".
   */
});
