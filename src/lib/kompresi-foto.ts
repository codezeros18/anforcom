/*
 * Kompresi foto di sisi klien.
 *
 * KENAPA DI KLIEN, bukan di server: operator berdiri di dapur dengan sinyal
 * yang tidak dijamin. Foto HP mentah berukuran 3–8 MB; mengirimnya lewat
 * jaringan lambat memakan puluhan detik dan sering gagal di tengah. Mengecilkan
 * sebelum mengirim mengubah unggahan dari "menunggu lama sambil berharap"
 * menjadi "selesai".
 *
 * Batas mengikat dari BLUEPRINT bagian 8: <= 600 KB, sisi terpanjang <= 1280 px.
 *
 * Kenapa 1280 px cukup: yang dibaca model adalah SEBERAPA PENUH sebuah wadah,
 * bukan detail halus makanannya. Bibir wadah dan permukaan isi terbaca jelas
 * pada 1280 px. Resolusi lebih tinggi menambah byte yang dibayar operator di
 * jaringan dapur, tanpa menambah apa pun pada jawaban.
 *
 * BENTUK BERKAS INI DISENGAJA: seluruh keputusan angka ada di fungsi murni di
 * bagian atas, dan hanya bagian bawah yang menyentuh Canvas. Bagian atas diuji
 * penuh di Node tanpa DOM; bagian bawah adalah lapisan tipis di atasnya. Tanpa
 * pemisahan ini, aritmetika ukuran hanya bisa diuji di peramban — dan yang
 * tidak diuji akan salah.
 */

/** Sisi terpanjang maksimum, dalam piksel. */
export const SISI_TERPANJANG_MAKS = 1280;

/** Ukuran berkas maksimum, dalam byte. */
export const UKURAN_MAKS_BYTE = 600 * 1024;

/**
 * Mutu JPEG yang dicoba, dari yang terbaik ke yang paling hemat.
 *
 * Turun bertahap, bukan langsung ke mutu rendah: sebagian besar foto sudah
 * memenuhi batas pada 0.82, dan menurunkan mutu lebih jauh daripada perlu
 * membuang detail permukaan yang justru dibaca model.
 */
export const TANGGA_MUTU = [0.82, 0.72, 0.62, 0.5, 0.4] as const;

export interface Dimensi {
  lebar: number;
  tinggi: number;
}

/**
 * Menghitung dimensi target dengan mempertahankan rasio aspek.
 *
 * Foto yang sudah lebih kecil dari batas TIDAK diperbesar — memperbesar hanya
 * menambah byte tanpa menambah informasi.
 */
export function hitungDimensiTarget(
  asli: Dimensi,
  sisiTerpanjangMaks: number = SISI_TERPANJANG_MAKS,
): Dimensi {
  const { lebar, tinggi } = asli;

  if (!Number.isFinite(lebar) || !Number.isFinite(tinggi) || lebar <= 0 || tinggi <= 0) {
    throw new Error(
      `Dimensi foto tidak sah: ${String(lebar)}x${String(tinggi)}. Foto mungkin gagal dimuat.`,
    );
  }

  const terpanjang = Math.max(lebar, tinggi);
  if (terpanjang <= sisiTerpanjangMaks) {
    return { lebar: Math.round(lebar), tinggi: Math.round(tinggi) };
  }

  // Sisi terpanjang dipatok tepat ke batas, sisi pendek dihitung dari rasio.
  // Menghitung keduanya dari satu faktor skala bisa membuat sisi terpanjang
  // meleset satu piksel di atas batas karena pembulatan.
  const kecil = Math.max(
    1,
    Math.round((Math.min(lebar, tinggi) * sisiTerpanjangMaks) / terpanjang),
  );

  return lebar >= tinggi
    ? { lebar: sisiTerpanjangMaks, tinggi: kecil }
    : { lebar: kecil, tinggi: sisiTerpanjangMaks };
}

/** Apakah hasil sudah memenuhi kedua batas yang mengikat. */
export function memenuhiBatas(
  ukuranByte: number,
  dimensi: Dimensi,
  batasByte: number = UKURAN_MAKS_BYTE,
  batasSisi: number = SISI_TERPANJANG_MAKS,
): boolean {
  return ukuranByte <= batasByte && Math.max(dimensi.lebar, dimensi.tinggi) <= batasSisi;
}

// ---------------------------------------------------------------------------
// Lapisan peramban
// ---------------------------------------------------------------------------

export interface HasilKompresi {
  berkas: Blob;
  dimensi: Dimensi;
  ukuranByte: number;
  mutuDipakai: number;
  /** Ukuran sebelum kompresi. Dicatat untuk verifikasi lapangan. */
  ukuranAsliByte: number;
}

/**
 * Mengecilkan foto sampai memenuhi kedua batas.
 *
 * Hanya bisa dijalankan di peramban — memakai `createImageBitmap` dan `canvas`.
 * Logika angkanya ada di fungsi murni di atas, yang diuji terpisah.
 */
export async function kompresFoto(
  berkas: Blob,
  batasByte: number = UKURAN_MAKS_BYTE,
  batasSisi: number = SISI_TERPANJANG_MAKS,
): Promise<HasilKompresi> {
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") {
    throw new Error("kompresFoto hanya bisa dijalankan di peramban.");
  }

  const gambar = await createImageBitmap(berkas);
  const dimensi = hitungDimensiTarget(
    { lebar: gambar.width, tinggi: gambar.height },
    batasSisi,
  );

  const kanvas = document.createElement("canvas");
  kanvas.width = dimensi.lebar;
  kanvas.height = dimensi.tinggi;

  const konteks = kanvas.getContext("2d");
  if (!konteks) throw new Error("Kanvas tidak tersedia untuk mengecilkan foto.");

  konteks.drawImage(gambar, 0, 0, dimensi.lebar, dimensi.tinggi);
  gambar.close();

  let terakhir: Blob | null = null;
  let mutuDipakai = TANGGA_MUTU[TANGGA_MUTU.length - 1]!;

  for (const mutu of TANGGA_MUTU) {
    const hasil = await keBlob(kanvas, mutu);
    terakhir = hasil;
    mutuDipakai = mutu;
    if (hasil.size <= batasByte) break;
  }

  if (!terakhir) throw new Error("Foto gagal dikecilkan.");

  return {
    berkas: terakhir,
    dimensi,
    ukuranByte: terakhir.size,
    mutuDipakai,
    ukuranAsliByte: berkas.size,
  };
}

function keBlob(kanvas: HTMLCanvasElement, mutu: number): Promise<Blob> {
  return new Promise((selesai, gagal) => {
    kanvas.toBlob(
      (blob) => {
        if (blob) selesai(blob);
        else gagal(new Error("Kanvas gagal menghasilkan berkas foto."));
      },
      "image/jpeg",
      mutu,
    );
  });
}
