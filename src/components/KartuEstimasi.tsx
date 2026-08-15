"use client";

import { BadgeSumberKalibrasi } from "./BadgeSumberKalibrasi";

/*
 * Hasil estimasi — tugas 5.13.
 *
 * ATURAN YANG PALING MUDAH DILANGGAR TANPA SADAR: tombol "Benar" dan "Koreksi"
 * BERUKURAN SAMA.
 *
 * Membuat "Koreksi" lebih kecil, lebih pucat, atau menaruhnya sebagai tautan
 * teks di bawah akan menyampaikan pesan bahwa mengoreksi adalah tindakan
 * menyimpang — dan operator yang terburu-buru akan menekan "Benar" pada angka
 * yang dia tahu salah. Jejak koreksi itulah bahan mentah kalibrasi; kehilangan
 * satu koreksi berarti konstanta membaik lebih lambat untuk selamanya.
 *
 * Angka besar memakai `text-pahlawan` (72px) supaya terbaca dari jarak lengan
 * oleh orang yang sedang berdiri. Rentang ditampilkan di bawahnya karena angka
 * tunggal tanpa rentang terbaca lebih pasti daripada yang bisa
 * dipertanggungjawabkan.
 */

export interface KartuEstimasiProps {
  porsiEstimasi: string;
  rentangBawah: string;
  rentangAtas: string;
  /** Badge sumber kalibrasi — tugas 6.4. Hilang sendiri saat terkalibrasi. */
  sumberKalibrasi: "deklarasi" | "terkalibrasi";
  konstantaPerkiraan: boolean;
  wajibManual: boolean;
  onBenar: () => void;
  onKoreksi: () => void;
  menyimpan?: boolean;
}

function ringkas(angka: string): string {
  return angka.endsWith(".00") ? angka.slice(0, -3) : angka;
}

export function KartuEstimasi({
  porsiEstimasi,
  rentangBawah,
  rentangAtas,
  sumberKalibrasi,
  konstantaPerkiraan,
  wajibManual,
  onBenar,
  onKoreksi,
  menyimpan = false,
}: KartuEstimasiProps) {
  return (
    <section
      className="rounded-2xl border border-netral-200 p-4"
      aria-label="Hasil pembacaan"
    >
      <p className="text-konteks text-netral-600">Perkiraan sisa</p>

      {/* Tidak ada warna merah untuk angka sisa — CLAUDE.md bagian 5. */}
      <p className="text-pahlawan tabular-nums text-netral-900">
        {ringkas(porsiEstimasi)}
      </p>
      <p className="text-badan text-netral-600">
        porsi, antara {ringkas(rentangBawah)} dan {ringkas(rentangAtas)}
      </p>

      <div className="mt-3">
        <BadgeSumberKalibrasi sumber={sumberKalibrasi} perkiraan={konstantaPerkiraan} />
      </div>

      {wajibManual && (
        <p className="text-konteks mt-3 text-netral-700">
          Isinya campuran — geser sendiri di bawah supaya angkanya lebih pas.
        </p>
      )}

      {/* Dua tombol, lebar sama, tinggi sama. Lihat catatan di kepala berkas. */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={onBenar}
          disabled={menyimpan || wajibManual}
          className="text-badan h-14 rounded-xl bg-aksen-500 font-semibold text-white active:bg-aksen-600 disabled:opacity-40"
        >
          Benar
        </button>
        <button
          type="button"
          onClick={onKoreksi}
          disabled={menyimpan}
          className="text-badan h-14 rounded-xl border-2 border-aksen-500 font-semibold text-aksen-600 active:bg-aksen-500/10 disabled:opacity-40"
        >
          Koreksi
        </button>
      </div>
    </section>
  );
}
