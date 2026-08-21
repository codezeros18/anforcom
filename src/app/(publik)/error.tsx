"use client";

import Link from "next/link";

/*
 * State error — 7.8.
 *
 * ATURAN YANG DIJAGA DI SINI: tidak ada stack trace yang sampai ke layar
 * (CLAUDE.md bagian 5). Objek galat diterima sebagai prop dan SENGAJA tidak
 * dirender — ia dicatat ke log server, tempat ia berguna.
 *
 * Layar publik adalah layar yang dibuka orang asing tanpa konteks apa pun.
 * Pesan teknis di sini tidak memberi tahu dia apa-apa, dan sekaligus
 * membocorkan bentuk dalam sistem ke siapa pun yang membuka tautannya.
 *
 * CATATAN TENTANG "DATA CACHE TERAKHIR" pada spesifikasi 7.8: halaman ini
 * dirender di server, jadi ia tidak punya salinan klien untuk ditampilkan saat
 * pengambilan data gagal. Yang bisa dijanjikan jujur adalah bahwa angka
 * terakhir masih tersimpan dan akan muncul lagi begitu sambungan pulih —
 * bukan menampilkan angka lama tanpa memberi tahu bahwa ia lama. Dicatat di
 * PROGRESS.md.
 */

export default function Galat({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 p-6">
      <h1 className="text-badan font-semibold text-netral-900">
        Angkanya belum bisa ditampilkan.
      </h1>
      <p className="text-badan text-netral-700">
        Datanya aman — yang bermasalah hanya sambungan saat memuat halaman ini.
      </p>

      <button
        type="button"
        onClick={reset}
        className="text-badan h-14 rounded-xl bg-aksen-500 font-semibold text-white"
      >
        Muat ulang
      </button>

      <Link href="/catat" className="text-konteks text-center text-netral-600 underline">
        Lanjut mencatat
      </Link>
    </main>
  );
}
