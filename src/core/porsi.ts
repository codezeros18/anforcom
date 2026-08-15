/*
 * Aritmetika porsi yang eksak.
 *
 * CLAUDE.md aturan 3 melarang `float`/`double` di jalur perhitungan. Larangan
 * itu tidak berhenti di kolom basis data — kalau `/core` menghitung rata-rata
 * dengan aritmetika pecahan biner, angka yang muncul di layar bisa berbeda dari
 * angka yang tersimpan, dan selisihnya bergantung pada urutan penjumlahan.
 *
 * Cara berkas ini menyelesaikannya: porsi disimpan sebagai BILANGAN BULAT
 * perseratus porsi. `296.19` menjadi `29619`. Semua operasi adalah operasi
 * bilangan bulat; pembagian ditangani secara eksplisit dengan aturan pembulatan
 * yang disebutkan namanya, bukan dibiarkan pada perilaku bawaan.
 *
 * Tipe `Porsi` diberi merek supaya tidak bisa tertukar dengan `number` biasa.
 * Tanpa merek, `29619` (perseratus) dan `296` (porsi utuh) punya tipe yang sama
 * dan kompilator tidak akan menolong saat keduanya tertukar — itu jenis bug
 * yang lolos ke production dan baru terlihat sebagai angka yang 100 kali salah.
 */

import { GalatPorsiTidakSah } from "./galat.ts";

declare const merekPorsi: unique symbol;

/** Porsi dalam perseratus. Selalu bilangan bulat. Dibuat lewat fungsi di bawah. */
export type Porsi = number & { readonly [merekPorsi]: "Porsi" };

/** Berapa perseratus dalam satu porsi utuh. */
const SKALA = 100;

// ---------------------------------------------------------------------------
// Konstruksi
// ---------------------------------------------------------------------------

/** Membuat Porsi dari bilangan bulat perseratus. Dipakai internal dan di tes. */
export function porsiDariPerseratus(perseratus: number): Porsi {
  if (!Number.isSafeInteger(perseratus)) {
    throw new GalatPorsiTidakSah(
      `Porsi harus bilangan bulat perseratus, diterima: ${String(perseratus)}`,
    );
  }
  return perseratus as Porsi;
}

/** Membuat Porsi dari jumlah porsi utuh. `porsiDariUtuh(296)` = 296.00 porsi. */
export function porsiDariUtuh(utuh: number): Porsi {
  if (!Number.isSafeInteger(utuh)) {
    throw new GalatPorsiTidakSah(
      `Porsi utuh harus bilangan bulat, diterima: ${String(utuh)}`,
    );
  }
  return porsiDariPerseratus(utuh * SKALA);
}

/**
 * Mengurai Porsi dari teks desimal, misalnya "296.19".
 *
 * Sengaja TIDAK memakai `parseFloat` atau `Number()`. Keduanya melewatkan nilai
 * lewat pecahan biner, dan seluruh alasan berkas ini ada adalah menghindari itu.
 * Penguraian dilakukan pada digitnya langsung.
 *
 * Menerima paling banyak dua angka di belakang koma — sesuai DECIMAL(8,2).
 * Nilai dengan tiga desimal ditolak, bukan dibulatkan diam-diam: pembulatan
 * senyap adalah cara data kehilangan presisi tanpa ada yang menyadarinya.
 */
export function porsiDariString(teks: string | { toString(): string }): Porsi {
  const s = typeof teks === "string" ? teks.trim() : teks.toString().trim();

  const cocok = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(s);
  if (!cocok) {
    throw new GalatPorsiTidakSah(
      `Nilai porsi tidak sah: "${s}". Bentuk yang diterima: bilangan dengan paling banyak dua desimal.`,
    );
  }

  const tanda = cocok[1] === "-" ? -1 : 1;
  const bagianUtuh = Number(cocok[2]);
  // "5" berarti 50 perseratus, "05" berarti 5 perseratus.
  const bagianPecahan = cocok[3] ? Number(cocok[3].padEnd(2, "0")) : 0;

  return porsiDariPerseratus(tanda * (bagianUtuh * SKALA + bagianPecahan));
}

// ---------------------------------------------------------------------------
// Pembacaan
// ---------------------------------------------------------------------------

/** Mengubah ke teks desimal dua angka, misalnya "296.19". Cocok untuk DECIMAL(8,2). */
export function porsiKeString(porsi: Porsi): string {
  const negatif = porsi < 0;
  const n = Math.abs(porsi);
  const utuh = Math.floor(n / SKALA);
  const pecahan = n % SKALA;
  return `${negatif ? "-" : ""}${utuh}.${String(pecahan).padStart(2, "0")}`;
}

/**
 * Mengubah ke teks tanpa desimal bila nilainya memang bulat, misalnya "296".
 *
 * Dipakai di kalimat alasan. "Kami sarankan 296" jauh lebih mudah dibaca juru
 * masak yang sedang terburu-buru daripada "Kami sarankan 296.00".
 */
export function porsiKeStringRingkas(porsi: Porsi): string {
  return porsi % SKALA === 0 ? String(porsi / SKALA) : porsiKeString(porsi);
}

export function porsiKePerseratus(porsi: Porsi): number {
  return porsi;
}

// ---------------------------------------------------------------------------
// Operasi
// ---------------------------------------------------------------------------

export function porsiTambah(a: Porsi, b: Porsi): Porsi {
  return porsiDariPerseratus(a + b);
}

export function porsiKurang(a: Porsi, b: Porsi): Porsi {
  return porsiDariPerseratus(a - b);
}

export function porsiSelisihAbsolut(a: Porsi, b: Porsi): Porsi {
  return porsiDariPerseratus(Math.abs(a - b));
}

export function porsiMaks(nilai: readonly Porsi[]): Porsi {
  const pertama = nilai[0];
  if (pertama === undefined) {
    throw new GalatPorsiTidakSah("porsiMaks dipanggil dengan daftar kosong.");
  }
  let maks = pertama;
  for (const n of nilai) if (n > maks) maks = n;
  return maks;
}

/**
 * Membulatkan KE ATAS ke porsi utuh terdekat.
 *
 * Arah pembulatannya bukan selera. Rekomendasi adalah perintah memasak sekian
 * porsi, dan membulatkan ke bawah berarti menyarankan memasak lebih sedikit
 * daripada yang dihitung — pada angka lantai keras, itu artinya menyarankan
 * kekurangan makanan. Ke atas adalah satu-satunya arah yang aman.
 */
export function porsiCeilKeUtuh(porsi: Porsi): Porsi {
  return porsiDariPerseratus(Math.ceil(porsi / SKALA) * SKALA);
}

/**
 * Rata-rata, dibulatkan ke perseratus terdekat. UNTUK DITAMPILKAN saja.
 *
 * Keputusan rekomendasi TIDAK boleh memakai nilai ini — lihat `rataRataCeilUtuh`.
 */
export function porsiRataRataUntukTampilan(nilai: readonly Porsi[]): Porsi {
  if (nilai.length === 0) {
    throw new GalatPorsiTidakSah("Rata-rata dari daftar kosong tidak terdefinisi.");
  }
  const jumlah = nilai.reduce<number>((total, n) => total + n, 0);
  return porsiDariPerseratus(bagiBulatkan(jumlah, nilai.length));
}

/**
 * `ceil(rata-rata)` dalam porsi utuh, dihitung LANGSUNG dari jumlah dan cacah.
 *
 * Kenapa tidak `porsiCeilKeUtuh(porsiRataRataUntukTampilan(...))`: membulatkan
 * dulu ke perseratus lalu membulatkan lagi ke atas bisa menghasilkan angka yang
 * berbeda satu porsi. Contoh: rata-rata sebenarnya 291.005 dibulatkan menjadi
 * 291.00, lalu ceil memberi 291 — padahal ceil dari nilai sebenarnya adalah 292.
 * Pembulatan bertingkat adalah cara klasik kehilangan satu porsi, dan pada angka
 * yang menentukan cukup-tidaknya makanan, satu porsi itu berarti.
 */
export function rataRataCeilUtuh(nilai: readonly Porsi[]): Porsi {
  if (nilai.length === 0) {
    throw new GalatPorsiTidakSah("Rata-rata dari daftar kosong tidak terdefinisi.");
  }
  const jumlah = nilai.reduce<number>((total, n) => total + n, 0);
  const penyebut = nilai.length * SKALA;
  return porsiDariUtuh(ceilBagi(jumlah, penyebut));
}

// ---------------------------------------------------------------------------
// Pembagian bilangan bulat — aturan pembulatan disebut namanya, bukan tersirat
// ---------------------------------------------------------------------------

/** Pembagian dengan pembulatan ke bilangan bulat terdekat, setengah menjauhi nol. */
function bagiBulatkan(pembilang: number, penyebut: number): number {
  const tanda = pembilang < 0 ? -1 : 1;
  const n = Math.abs(pembilang);
  return tanda * Math.floor((n * 2 + penyebut) / (penyebut * 2));
}

/** Pembagian dengan pembulatan ke atas, benar untuk pembilang negatif juga. */
function ceilBagi(pembilang: number, penyebut: number): number {
  if (pembilang >= 0) return Math.floor((pembilang + penyebut - 1) / penyebut);
  return -Math.floor(-pembilang / penyebut);
}

/**
 * Persentase `bagian / keseluruhan`, dikembalikan sebagai perseratus persen.
 *
 * `1234` berarti 12.34%. Tetap bilangan bulat sepanjang perhitungan.
 */
export function persenPerseratus(bagian: number, keseluruhan: number): number {
  if (keseluruhan === 0) {
    throw new GalatPorsiTidakSah("Persentase dengan penyebut nol tidak terdefinisi.");
  }
  return bagiBulatkan(bagian * 10000, keseluruhan);
}

/** Memformat perseratus persen menjadi teks, misalnya `1234` -> "12.34". */
export function persenKeString(perseratusPersen: number): string {
  const negatif = perseratusPersen < 0;
  const n = Math.abs(perseratusPersen);
  return `${negatif ? "-" : ""}${Math.floor(n / SKALA)}.${String(n % SKALA).padStart(2, "0")}`;
}
