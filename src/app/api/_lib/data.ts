import { cookies } from "next/headers";
import { db } from "@/lib/db";
import type { KonteksKalibrasi } from "@/core/kalibrasi";
import { porsiDariString } from "@/core/porsi";
import { dapurDariToken } from "@/app/api/publik/_lib/sesi-coba";

/**
 * Nama cookie pembawa token sesi coba.
 *
 * Cookie, bukan parameter di setiap pemanggilan, karena ia ikut secara otomatis
 * ke server component MAUPUN route handler. Kalau token harus dioper manual,
 * satu jalur yang lupa mengopernya akan diam-diam melayani dapur nyata — dan
 * itulah kebocoran yang aturan keras 8 larang.
 */
export const COOKIE_SESI_COBA = "sisa_sesi_coba";

/*
 * Jembatan Prisma -> bentuk `/core`.
 *
 * `/core` sengaja tidak mengenal Prisma (lihat catatan di `src/core/tipe.ts`),
 * jadi pemetaannya harus terjadi di suatu tempat. Tempat itu di sini, di
 * lapisan `/app` — satu berkas, bukan tersebar di tujuh route handler.
 *
 * Berkas ini MENYENTUH BASIS DATA. Helper murni ada di `hitung.ts` supaya bisa
 * diuji tanpa Postgres.
 */

/**
 * Dapur yang sedang aktif.
 *
 * UTANG TEKNIS YANG DISENGAJA: belum ada autentikasi, jadi dapur ditentukan
 * lewat `DAPUR_AKTIF_ID` atau — bila tidak diisi — satu-satunya dapur yang ada.
 * Pengelolaan profil dan izin dapur adalah tugas 11.4, dan Sprint 11 terkunci
 * di belakang gerbang Sprint 10.
 *
 * Ini aman selama sistem melayani satu dapur, dan berbahaya begitu ada dua.
 * Dicatat di PROGRESS.md bagian "utang teknis".
 */
export async function ambilDapurAktif() {
  /*
   * MODE COBA DIPERIKSA LEBIH DULU — ATURAN KERAS 8.
   *
   * Ini titik tunggal tempat seluruh alur pencatatan menentukan dapur mana yang
   * ditulis. Dengan pemeriksaan sesi coba di sini, setiap route handler yang
   * sudah ada dan setiap route yang akan ditambah ikut terisolasi tanpa
   * mengubah satu baris pun di dalamnya.
   *
   * `dapurDariToken()` secara konstruksi hanya mengembalikan dapur `isContoh`,
   * jadi jalur ini TIDAK BISA mengembalikan dapur nyata walau tokennya dipalsu.
   */
  const token = (await cookies()).get(COOKIE_SESI_COBA)?.value;
  const dapurCoba = await dapurDariToken(token);
  if (dapurCoba) return dapurCoba;

  const idDariEnv = process.env.DAPUR_AKTIF_ID;
  if (idDariEnv) return db.dapur.findUnique({ where: { id: idDariEnv } });

  return db.dapur.findFirst({ orderBy: { dibuatPada: "asc" } });
}

/** Seluruh kalibrasi dan jenis masakan satu dapur, dalam bentuk yang dimengerti `/core`. */
export async function ambilKonteksKalibrasi(dapurId: string): Promise<KonteksKalibrasi> {
  const [kalibrasi, jenisMasakan] = await Promise.all([
    db.kalibrasi.findMany({ where: { wadah: { dapurId } } }),
    db.jenisMasakan.findMany({ where: { dapurId } }),
  ]);

  return {
    kalibrasi: kalibrasi.map((k) => ({
      wadahId: k.wadahId,
      jenisMasakanId: k.jenisMasakanId,
      porsiPenuh: porsiDariString(k.porsiPenuh.toString()),
      sumber: k.sumber,
      jumlahKoreksi: k.jumlahKoreksi,
    })),
    jenisMasakan: jenisMasakan.map((j) => ({
      id: j.id,
      kategoriFisik: j.kategoriFisik,
    })),
  };
}
