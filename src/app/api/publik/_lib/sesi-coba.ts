import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";

/*
 * Isolasi mode coba — ATURAN KERAS 8.
 *
 * "Data dapur contoh tidak pernah bercampur dengan data dapur nyata."
 *
 * CARA ATURAN INI DITEGAKKAN DI SINI — dan kenapa caranya begitu:
 *
 * Cara yang MUDAH tapi rapuh adalah memeriksa "apakah ini mode coba?" di setiap
 * route handler yang menulis. Ada tujuh route seperti itu sekarang, dan akan
 * ada lebih. Satu route baru yang lupa memeriksa sudah cukup untuk menulis data
 * pengunjung booth ke dapur sungguhan, dan kebocoran itu tidak akan terlihat
 * sampai seseorang membuka riwayat dapur nyata dan menemukan hari yang tidak
 * pernah dimasak.
 *
 * Cara yang dipakai: `sesi_coba.dapur_contoh_id` SELALU menunjuk dapur dengan
 * `is_contoh = true`, dan itu diperiksa saat sesi DIBUAT — satu tempat, satu
 * kali. Sesudah itu, seluruh penulisan mode coba memakai dapur hasil
 * `dapurDariToken()`, yang secara konstruksi tidak bisa mengembalikan dapur
 * nyata. Route handler tidak perlu tahu ia sedang melayani mode coba; ia hanya
 * menulis ke dapur yang diberikan kepadanya.
 *
 * Dengan kata lain: isolasi bukan disiplin yang harus diingat setiap sprint,
 * melainkan bentuk yang membuat pelanggarannya sulit ditulis.
 */

/**
 * Umur sesi coba.
 *
 * 24 jam sesuai 8.6. Cukup panjang untuk satu hari pameran penuh, cukup pendek
 * supaya data coba tidak menumpuk tanpa batas di dapur contoh.
 */
export const UMUR_SESI_JAM = 24;

export class GalatDapurContohTidakAda extends Error {
  constructor() {
    super("Tidak ada dapur contoh untuk mode coba.");
    this.name = "GalatDapurContohTidakAda";
  }
}

export interface SesiCobaBaru {
  token: string;
  kedaluwarsa: string;
}

/**
 * Membuat sesi coba baru.
 *
 * Token 32 byte acak kriptografis. Ia bukan pengenal orang dan tidak terhubung
 * ke apa pun tentang pengunjung — ia hanya menunjuk dapur contoh mana yang
 * dipakai dan sampai kapan (aturan 1: tidak ada identitas orang).
 */
export async function buatSesiCoba(): Promise<SesiCobaBaru> {
  const dapurContoh = await db.dapur.findFirst({ where: { isContoh: true } });
  if (!dapurContoh) throw new GalatDapurContohTidakAda();

  const kedaluwarsaPada = new Date(Date.now() + UMUR_SESI_JAM * 60 * 60 * 1000);

  const sesi = await db.sesiCoba.create({
    data: {
      token: randomBytes(32).toString("hex"),
      // SATU-SATUNYA tempat dapur sesi coba ditentukan, dan ia sudah tersaring
      // `isContoh: true` di kueri di atas.
      dapurContohId: dapurContoh.id,
      kedaluwarsaPada,
    },
  });

  return { token: sesi.token, kedaluwarsa: sesi.kedaluwarsaPada.toISOString() };
}

/**
 * Dapur untuk sebuah token sesi coba.
 *
 * Mengembalikan `null` bila token tidak dikenal atau sudah kedaluwarsa — dan
 * pemanggilnya harus memperlakukan itu sebagai "tidak boleh menulis", bukan
 * jatuh kembali ke dapur aktif. Fallback ke dapur aktif persis adalah cara
 * data coba bocor ke dapur nyata.
 *
 * Penjaga terakhir ada di baris `isContoh`: walau sesi entah bagaimana menunjuk
 * dapur nyata, fungsi ini tetap menolaknya.
 */
export async function dapurDariToken(token: string | null | undefined) {
  if (!token) return null;

  const sesi = await db.sesiCoba.findUnique({
    where: { token },
    include: { dapurContoh: true },
  });
  if (!sesi) return null;
  if (sesi.kedaluwarsaPada.getTime() <= Date.now()) return null;

  // Sabuk kedua. Kalau baris ini pernah menyala, ada yang salah jauh di hulu —
  // dan lebih baik mode coba mati daripada menulis ke dapur sungguhan.
  if (!sesi.dapurContoh.isContoh) return null;

  return sesi.dapurContoh;
}
