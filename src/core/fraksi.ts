/*
 * Fraksi keterisian — seberapa penuh sebuah wadah, 0 sampai 1.
 *
 * REFRAMING YANG MENYELAMATKAN SELURUH PENDEKATAN INI:
 * kita tidak sedang mengukur makanan. Kita sedang mengukur seberapa penuh
 * sebuah wadah yang sudah dikenal. Pertanyaan "berapa kilogram makanan ini?"
 * mustahil dijawab dari sebuah foto; pertanyaan "panci ini terisi berapa
 * persen?" mudah, terbatas, dan bisa dikoreksi manusia dalam satu geseran.
 *
 * Fraksi adalah besaran yang menjawab pertanyaan kedua. Ia tanpa satuan, dan
 * baru menjadi porsi setelah dikalikan konstanta kalibrasi.
 *
 * Disimpan sebagai BILANGAN BULAT persepuluh ribu — `0.6250` menjadi `6250`,
 * sesuai DECIMAL(5,4) di skema. Alasannya sama seperti `porsi.ts`: aturan
 * "tidak pernah float" (CLAUDE.md 3) berlaku di seluruh jalur perhitungan.
 *
 * Skalanya SENGAJA BERBEDA dari porsi (10000 vs 100), dan justru karena itu
 * keduanya diberi merek tipe masing-masing di berkas terpisah. Tanpa pemisahan
 * itu, menukar keduanya adalah kesalahan yang menghasilkan angka 100 kali
 * meleset dan tidak akan ditolak kompilator.
 */

import { GalatFraksiTidakSah } from "./galat.ts";

declare const merekFraksi: unique symbol;

/** Fraksi keterisian dalam persepuluh ribu. Selalu bilangan bulat 0..10000. */
export type Fraksi = number & { readonly [merekFraksi]: "Fraksi" };

const SKALA = 10_000;

/** Wadah kosong. */
export const FRAKSI_KOSONG = 0 as Fraksi;
/** Wadah penuh. */
export const FRAKSI_PENUH = SKALA as Fraksi;

// ---------------------------------------------------------------------------
// Konstruksi
// ---------------------------------------------------------------------------

/**
 * Membuat Fraksi dari bilangan bulat persepuluh ribu.
 *
 * Rentang 0..1 ditegakkan di sini, bukan diperiksa di setiap pemanggil. Fraksi
 * di luar rentang itu tidak punya arti fisik — wadah tidak bisa terisi 130%,
 * dan angka semacam itu biasanya berarti fraksi tertukar dengan persen.
 */
export function fraksiDariPersepuluhRibu(persepuluhRibu: number): Fraksi {
  if (!Number.isSafeInteger(persepuluhRibu)) {
    throw new GalatFraksiTidakSah(
      `Fraksi harus bilangan bulat persepuluh ribu, diterima: ${String(persepuluhRibu)}`,
    );
  }
  if (persepuluhRibu < 0 || persepuluhRibu > SKALA) {
    throw new GalatFraksiTidakSah(
      `Fraksi keterisian harus antara 0 dan 1, diterima: ${fraksiKeString(persepuluhRibu as Fraksi)}`,
    );
  }
  return persepuluhRibu as Fraksi;
}

/**
 * Mengurai Fraksi dari teks desimal, misalnya "0.6250".
 *
 * Sengaja tidak memakai `parseFloat` — lihat alasan yang sama di `porsi.ts`.
 * Menerima paling banyak empat angka di belakang koma, sesuai DECIMAL(5,4).
 */
export function fraksiDariString(teks: string | { toString(): string }): Fraksi {
  const s = typeof teks === "string" ? teks.trim() : teks.toString().trim();

  const cocok = /^(\d+)(?:\.(\d{1,4}))?$/.exec(s);
  if (!cocok) {
    throw new GalatFraksiTidakSah(
      `Nilai fraksi tidak sah: "${s}". Bentuk yang diterima: bilangan dengan paling banyak empat desimal.`,
    );
  }

  const bagianUtuh = Number(cocok[1]);
  // "5" berarti 5000 persepuluh ribu, "05" berarti 500, "0005" berarti 5.
  const bagianPecahan = cocok[2] ? Number(cocok[2].padEnd(4, "0")) : 0;

  return fraksiDariPersepuluhRibu(bagianUtuh * SKALA + bagianPecahan);
}

/** Membuat Fraksi dari persen bulat. `fraksiDariPersen(62)` = 0.6200. */
export function fraksiDariPersen(persen: number): Fraksi {
  return fraksiDariPersepuluhRibu(persen * 100);
}

// ---------------------------------------------------------------------------
// Pembacaan
// ---------------------------------------------------------------------------

/** Mengubah ke teks empat desimal, misalnya "0.6250". Cocok untuk DECIMAL(5,4). */
export function fraksiKeString(fraksi: Fraksi): string {
  const negatif = fraksi < 0;
  const n = Math.abs(fraksi);
  const utuh = Math.floor(n / SKALA);
  const pecahan = n % SKALA;
  return `${negatif ? "-" : ""}${utuh}.${String(pecahan).padStart(4, "0")}`;
}

/**
 * Mengubah ke teks persen untuk dibaca manusia, misalnya "62%".
 *
 * Layar menampilkan "terisi sekitar 62%", bukan "0.6250" — juru masak membaca
 * persen, bukan pecahan desimal.
 */
export function fraksiKePersenRingkas(fraksi: Fraksi): string {
  return `${Math.round(fraksi / 100)}%`;
}

export function fraksiKePersepuluhRibu(fraksi: Fraksi): number {
  return fraksi;
}
