/*
 * Penjagaan berkas foto — 9.14.
 *
 * KENAPA INI BUKAN SEKADAR ATRIBUT `accept`. Atribut `accept="image/jpeg"` pada
 * `<input type="file">` hanyalah SARAN untuk dialog pemilih berkas. Ia menyaring
 * tampilan, tidak menolak apa pun: pengguna bisa mengetik "*.*" di dialog,
 * menyeret berkas ke halaman, atau memakai peramban yang mengabaikannya. Berkas
 * 20 MB atau PDF tetap bisa masuk.
 *
 * Jadi penolakannya dilakukan DI KODE, dan di dua tempat sekaligus:
 *
 *   - KLIEN (berkas ini, dipanggil `BingkaiKamera`): menolak SEBELUM unggah,
 *     supaya operator di jaringan dapur tidak menunggu 20 MB terkirim hanya
 *     untuk ditolak di ujung sana. Itu inti tugas 9.14 — "ditolak sebelum
 *     unggah".
 *   - SERVER (`route.ts` estimasi): tetap memeriksa ulang, karena klien bisa
 *     dilewati sepenuhnya oleh siapa pun yang memanggil endpoint langsung.
 *
 * Batas ukuran di sini SENGAJA lebih longgar daripada `UKURAN_MAKS_BYTE` di
 * `kompresi-foto.ts` (600 KB). Alurnya: berkas mentah dari kamera HP boleh
 * beberapa MB, lalu DIKOMPRES di klien sampai di bawah 600 KB sebelum dikirim.
 * Yang ditolak di sini adalah yang bahkan tidak layak dicoba kompres.
 */

/**
 * Batas berkas mentah dari kamera, sebelum kompresi.
 *
 * Foto 12 MP dari HP kelas menengah berkisar 3-5 MB. 12 MB memberi ruang untuk
 * HP beresolusi tinggi tanpa membuka pintu untuk video 20 MB yang tersamar
 * sebagai gambar.
 */
export const UKURAN_MENTAH_MAKS_BYTE = 12 * 1024 * 1024;

/** Format yang bisa kita bersihkan metadatanya. Di luar ini, foto tidak dipakai. */
export const TIPE_DITERIMA = ["image/jpeg", "image/png"] as const;

export type HasilPeriksaBerkas = { diterima: true } | { diterima: false; pesan: string };

/**
 * Memeriksa berkas sebelum diunggah.
 *
 * Pesannya menyebut jalan keluar, bukan menerangkan aturan. Operator yang
 * berkasnya ditolak sedang berdiri di depan wadah dan butuh tahu langkah
 * berikutnya — dan langkah itu selalu ada, karena slider setara dengan foto
 * (BLUEPRINT P4).
 */
export function periksaBerkasFoto(berkas: {
  size: number;
  type: string;
}): HasilPeriksaBerkas {
  if (berkas.size === 0) {
    return { diterima: false, pesan: "Fotonya belum terpilih — coba potret ulang." };
  }

  /*
   * Tipe diperiksa sebelum ukuran. Berkas 20 MB yang juga bukan gambar
   * sebaiknya dijelaskan sebagai "bukan gambar", karena itulah yang salah;
   * memberitahu operator untuk mengecilkan PDF-nya tidak menolong siapa pun.
   */
  if (!(TIPE_DITERIMA as readonly string[]).includes(berkas.type)) {
    return {
      diterima: false,
      pesan: "Itu bukan foto. Potret wadahnya, atau pakai geser saja — hasilnya sama.",
    };
  }

  if (berkas.size > UKURAN_MENTAH_MAKS_BYTE) {
    return {
      diterima: false,
      pesan:
        "Fotonya terlalu besar. Potret ulang, atau pakai geser saja — hasilnya sama.",
    };
  }

  return { diterima: true };
}
