import { createHmac, timingSafeEqual } from "node:crypto";

/*
 * URL foto bertanda tangan — 9.6.
 *
 * MASALAH YANG DIPECAHKAN. Foto sisa makanan diambil di dapur orang lain, atas
 * izin tertulis yang punya masa berlaku. URL object storage yang bisa ditebak
 * atau dibagikan selamanya berarti izin itu tidak punya arti teknis: siapa pun
 * yang pernah melihat tautannya bisa terus membukanya, termasuk sesudah izinnya
 * dicabut.
 *
 * Tanda tangan di sini mengikat tiga hal sekaligus: KUNCI OBJEK yang boleh
 * dibuka, WAKTU KEDALUWARSANYA, dan RAHASIA SERVER. Mengubah salah satunya
 * membatalkan tanda tangan — jadi tautan tidak bisa diperpanjang, dan tautan
 * untuk satu foto tidak bisa dipakai untuk foto lain.
 *
 * KENAPA HMAC SENDIRI, BUKAN SDK S3. Presigned URL bawaan SDK melakukan hal
 * yang sama, tapi menuntut `@aws-sdk/client-s3` plus `@aws-sdk/s3-request-
 * presigner` — puluhan megabyte dependensi untuk satu operasi HMAC, di proyek
 * yang anggaran muat halamannya diukur dalam kilobyte. Penyimpanan objek belum
 * dipasang (Sprint 12), jadi bentuk tanda tangannya ditetapkan di sini lebih
 * dulu supaya aturan 24 jam bisa diuji hari ini, bukan dijanjikan.
 *
 * CATATAN JUJUR TENTANG CAKUPANNYA: berkas ini membuat dan memverifikasi tanda
 * tangan. Ia BELUM tersambung ke penyimpanan objek mana pun, karena belum ada
 * yang dipasang dan `estimasi.fotoUrl` masih selalu `null`. Yang dijamin hari
 * ini adalah bahwa saat penyimpanan dipasang, aturan kedaluwarsanya sudah ada
 * dan sudah teruji — bukan ditambahkan belakangan saat sudah ada foto nyata di
 * dalamnya. Dicatat di PROGRESS.md bagian "utang teknis".
 */

/**
 * Umur tautan foto: 24 jam, sesuai tugas 9.6.
 *
 * Cukup panjang untuk satu siklus kerja lapangan penuh (memotret pagi,
 * meninjau malam), cukup pendek supaya tautan yang bocor ke grup pesan tidak
 * berumur panjang.
 */
export const UMUR_URL_JAM = 24;

export interface UrlBertandaTangan {
  /** Kunci objek di penyimpanan, misalnya `estimasi/2026-08-21/abc.jpg`. */
  kunci: string;
  /** Detik epoch saat tautan ini berhenti berlaku. */
  kedaluwarsa: number;
  tandaTangan: string;
}

function rahasia(env: NodeJS.ProcessEnv = process.env): string {
  const nilai = env.FOTO_URL_SECRET;
  /*
   * Dilempar, bukan dijatuhkan ke nilai bawaan. Rahasia bawaan berarti setiap
   * pemasangan memakai kunci yang sama, dan tanda tangan yang bisa dibuat siapa
   * pun bukan tanda tangan. Lebih baik fitur foto mati daripada menjaga dengan
   * kunci yang sudah diketahui umum.
   */
  if (!nilai) throw new Error("FOTO_URL_SECRET belum diisi.");
  return nilai;
}

function hitungTandaTangan(kunci: string, kedaluwarsa: number, kunciRahasia: string) {
  return createHmac("sha256", kunciRahasia)
    .update(`${kunci}:${String(kedaluwarsa)}`)
    .digest("hex");
}

/** Membuat tanda tangan untuk satu kunci objek, berlaku 24 jam. */
export function tandaTanganiUrlFoto(
  kunci: string,
  sekarang: Date = new Date(),
  env: NodeJS.ProcessEnv = process.env,
): UrlBertandaTangan {
  const kedaluwarsa = Math.floor(sekarang.getTime() / 1000) + UMUR_URL_JAM * 60 * 60;

  return {
    kunci,
    kedaluwarsa,
    tandaTangan: hitungTandaTangan(kunci, kedaluwarsa, rahasia(env)),
  };
}

/** Bentuk query string yang menyertai kunci objek. */
export function keQueryString(url: UrlBertandaTangan): string {
  return `kedaluwarsa=${String(url.kedaluwarsa)}&tanda=${url.tandaTangan}`;
}

export type HasilVerifikasi =
  { sah: true } | { sah: false; sebab: "kedaluwarsa" | "tanda_tangan_salah" };

/**
 * Memverifikasi tautan.
 *
 * URUTANNYA DISENGAJA: tanda tangan diperiksa LEBIH DULU, baru kedaluwarsa.
 * Kalau kedaluwarsa diperiksa duluan, penyerang bisa mengubah `kedaluwarsa`
 * menjadi tahun 2099 dan mengetahui dari pesan galat bahwa yang tersisa hanya
 * menebak tanda tangan. Memeriksa tanda tangan lebih dulu berarti nilai
 * kedaluwarsa yang dipakai SELALU yang ikut ditandatangani.
 */
export function verifikasiUrlFoto(
  kunci: string,
  kedaluwarsa: number,
  tandaTangan: string,
  sekarang: Date = new Date(),
  env: NodeJS.ProcessEnv = process.env,
): HasilVerifikasi {
  const diharapkan = hitungTandaTangan(kunci, kedaluwarsa, rahasia(env));

  const a = Buffer.from(diharapkan, "utf8");
  const b = Buffer.from(tandaTangan, "utf8");
  // Panjang berbeda tidak boleh masuk `timingSafeEqual` — ia melempar.
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { sah: false, sebab: "tanda_tangan_salah" };
  }

  if (Math.floor(sekarang.getTime() / 1000) > kedaluwarsa) {
    return { sah: false, sebab: "kedaluwarsa" };
  }

  return { sah: true };
}
