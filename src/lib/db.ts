import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

/*
 * Client Prisma tunggal — satu-satunya tempat koneksi basis data dibuat.
 *
 * Prisma 7 mewajibkan driver adapter; koneksi tidak lagi dibuka oleh engine
 * bawaan. `PrismaPg` adalah adapter resmi Prisma untuk PostgreSQL, jadi ia
 * bagian dari ORM yang sudah dikunci di CLAUDE.md bagian 4, bukan pustaka baru.
 *
 * Di pengembangan, Next.js memuat ulang modul setiap kali berkas berubah. Tanpa
 * pola di bawah, setiap muat ulang membuat PrismaClient baru dan koneksi lama
 * tidak dilepas — beberapa menit mengedit berkas cukup untuk menghabiskan batas
 * koneksi basis data, dan gejalanya muncul sebagai error yang tidak ada
 * hubungannya dengan perubahan yang sedang dikerjakan.
 *
 * Di production modul hanya dimuat sekali, jadi variabel global tidak dipakai.
 */

const globalUntukPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function buatClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    // Gagal keras dan jelas. Tanpa ini, kesalahan muncul jauh di hilir sebagai
    // error koneksi yang tidak menyebut penyebab sebenarnya.
    throw new Error(
      "DATABASE_URL belum diisi. Salin .env.example menjadi .env.local lalu isi connection string-nya.",
    );
  }

  const adapter = new PrismaPg({ connectionString });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const db = globalUntukPrisma.prisma ?? buatClient();

if (process.env.NODE_ENV !== "production") {
  globalUntukPrisma.prisma = db;
}
