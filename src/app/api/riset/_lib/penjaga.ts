/*
 * Penjaga endpoint riset — 9.4.
 *
 * "Terlindungi flag lingkungan, TIDAK MUNCUL di UI operator."
 *
 * Dua bagian kalimat itu dijaga di dua tempat berbeda, dan keduanya perlu:
 *
 *   - "tidak muncul di UI" dijaga dengan TIDAK MEMBUAT layarnya. Tidak ada
 *     komponen, tidak ada tautan, tidak ada rute halaman. Itu jaminan yang
 *     jauh lebih kuat daripada menyembunyikan tombol di balik kondisi.
 *   - "terlindungi flag lingkungan" dijaga di berkas ini.
 *
 * KENAPA GERBANGNYA TERTUTUP SECARA BAWAAN. `RISET_ENABLED` yang tidak diisi
 * berarti TERTUTUP, bukan terbuka. Production Vercel tidak memiliki variabel
 * itu, jadi endpoint ini mati di sana tanpa ada yang perlu mengingat untuk
 * mematikannya. Gerbang yang harus dinyalakan untuk aman adalah gerbang yang
 * suatu hari akan lupa dinyalakan.
 *
 * Kenapa ini penting melebihi kerapian: `penimbangan_referensi` adalah SUMBER
 * TUNGGAL angka dampak (aturan keras 5). Endpoint yang bisa menulis ke sana
 * dari internet terbuka berarti angka klaim kita bisa disisipi siapa saja.
 */

export const NAMA_FLAG_RISET = "RISET_ENABLED";

/**
 * `true` hanya bila flag-nya bernilai persis `"true"`.
 *
 * Perbandingan ketat disengaja: `"1"`, `"yes"`, atau `"TRUE"` TIDAK membuka
 * gerbang. Nilai yang setengah cocok biasanya berarti seseorang menebak
 * bentuknya, dan menebak bukan dasar yang cukup untuk membuka jalur tulis ke
 * tabel klaim.
 */
export function risetAktif(env: NodeJS.ProcessEnv = process.env): boolean {
  return env[NAMA_FLAG_RISET] === "true";
}
