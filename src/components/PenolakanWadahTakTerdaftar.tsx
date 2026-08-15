"use client";

import Link from "next/link";

/*
 * Penolakan wadah tak terdaftar — tugas 6.5.
 *
 * INI BUKAN LAYAR GALAT. Ia salah satu bagian produk yang paling penting untuk
 * dipahami, dan paling mudah dirusak dengan niat baik.
 *
 * BLUEPRINT 9.1: "Ini bukan keterbatasan yang disembunyikan — ini demonstrasi
 * bahwa sistem tahu batas dirinya sendiri."
 *
 * Godaan yang harus ditolak: menebak konstanta dari bentuk wadah. Panci
 * berukuran "sedang" bisa menampung 80 porsi nasi atau 150 porsi sayur berkuah;
 * menebaknya akan menghasilkan angka yang terlihat berwibawa dan salah secara
 * sistematis. Kesalahan sistematis tidak bisa ditambal koreksi — ia hanya
 * membuat operator berhenti percaya pada angkanya.
 *
 * Kalimat kedua ("supaya angkanya bisa dipertanggungjawabkan") menjelaskan
 * KENAPA sistem menolak. Tanpa itu, penolakan terbaca sebagai kekurangan
 * produk; dengan itu, ia terbaca sebagai kehati-hatian yang menguntungkan
 * operator.
 *
 * DUA JALAN KELUAR, keduanya satu ketukan. Penolakan tanpa jalan keluar adalah
 * jalan buntu, dan jalan buntu di tengah pencatatan berarti hari itu tidak
 * tercatat sama sekali.
 */

export const PESAN_PENOLAKAN = "Wadah ini belum terdaftar di dapur ini.";
export const ALASAN_PENOLAKAN =
  "Sistem hanya membaca wadah yang sudah dikalibrasi, supaya angkanya bisa dipertanggungjawabkan.";

export interface PenolakanWadahTakTerdaftarProps {
  /** Kembali ke pencatatan sesudah wadahnya didaftarkan. */
  kembaliKe: string;
  /** Beralih ke jalur geser tanpa meninggalkan layar. */
  onMasukkanManual: () => void;
}

export function PenolakanWadahTakTerdaftar({
  kembaliKe,
  onMasukkanManual,
}: PenolakanWadahTakTerdaftarProps) {
  return (
    <section
      className="rounded-2xl border-2 border-perhatian-700/30 bg-perhatian-100 p-4"
      role="alert"
    >
      <p className="text-badan font-semibold text-perhatian-700">
        <span aria-hidden>⚠️ </span>
        {PESAN_PENOLAKAN}
      </p>
      <p className="text-konteks mt-2 text-perhatian-700">{ALASAN_PENOLAKAN}</p>

      <div className="mt-4 grid gap-3">
        <Link
          href={`/wadah/baru?kembali=${encodeURIComponent(kembaliKe)}`}
          className="text-badan flex h-14 items-center justify-center rounded-xl bg-aksen-500 font-semibold text-white"
        >
          Daftarkan wadah — 1 menit
        </Link>
        <button
          type="button"
          onClick={onMasukkanManual}
          className="text-badan h-14 rounded-xl border-2 border-netral-400 font-medium text-netral-800"
        >
          Masukkan manual
        </button>
      </div>
    </section>
  );
}
