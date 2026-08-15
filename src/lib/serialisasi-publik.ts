/*
 * SATU-SATUNYA tempat mode anonim ditangani (CLAUDE.md bagian 3 aturan 10).
 *
 * Setiap jalur keluaran publik — halaman publik, route handler, ekspor, apa pun
 * yang nanti dibangun — wajib melewati `keDapurPublik()`. Jangan pernah menyalin
 * logika `modeAnonim ? labelAnonim : nama` ke tempat lain. Satu boolean harus
 * mengubah seluruh tampilan nama, dan itu hanya bisa dijamin kalau logikanya
 * ada di satu berkas.
 *
 * Cara berkas ini menegakkan aturan itu, bukan sekadar memintanya:
 * bentuk keluaran `DapurPublik` TIDAK memuat `nama` asli maupun `labelAnonim`.
 * Ia hanya punya satu field `nama` yang sudah diselesaikan. Jadi kode di
 * hilir tidak punya akses ke nama asli sama sekali — bukan "boleh tapi jangan",
 * melainkan tidak tersedia.
 */

/**
 * Nilai desimal apa adanya. Diterima sebagai `Prisma.Decimal`, string, atau apa
 * pun yang punya `toString()` yang benar.
 *
 * Sengaja BUKAN `number`. Uang tidak pernah melewati float di sistem ini
 * (CLAUDE.md aturan 3), termasuk di lapisan serialisasi — mengubahnya ke
 * `number` di sini akan membatalkan presisi yang dijaga susah-payah di skema.
 */
export type NilaiDesimal = { toString(): string };

/** Bentuk masukan minimal. `Dapur` dari Prisma memenuhi bentuk ini. */
export interface DapurUntukSerialisasi {
  id: string;
  nama: string;
  labelAnonim: string;
  modeAnonim: boolean;
  kecamatan: string;
  jenis: string;
  biayaBahanPerPorsiMin: NilaiDesimal;
  biayaBahanPerPorsiMaks: NilaiDesimal;
  izinTampilPublik: boolean;
  izinBerlakuSampai: Date | null;
  isContoh: boolean;
}

/**
 * Bentuk publik sebuah dapur.
 *
 * Perhatikan yang TIDAK ada di sini: `labelAnonim`, `modeAnonim` sebagai nama
 * mentah, dan tentu saja nama asli saat mode anonim aktif. Yang ada hanya
 * `nama` yang sudah final dan `anonim` sebagai penanda untuk UI.
 */
export interface DapurPublik {
  id: string;
  /** Sudah diselesaikan. Bila `anonim` true, ini adalah label generik. */
  nama: string;
  /** Supaya UI bisa menjelaskan bahwa nama ini sengaja disamarkan. */
  anonim: boolean;
  kecamatan: string;
  jenis: string;
  /** String, bukan number — lihat catatan pada `NilaiDesimal`. */
  biayaBahanPerPorsiMin: string;
  biayaBahanPerPorsiMaks: string;
  /**
   * Data dapur contoh tidak pernah boleh dipakai untuk klaim dampak dan wajib
   * diberi badge yang terlihat (CLAUDE.md aturan 8). Penanda ini ikut ke bentuk
   * publik supaya UI tidak perlu mengambilnya dari sumber lain.
   */
  isContoh: boolean;
}

/**
 * Label cadangan bila `modeAnonim` aktif tapi `labelAnonim` kosong.
 *
 * Kegagalan harus jatuh ke arah yang aman. Mengembalikan nama asli sebagai
 * cadangan akan membuat satu baris data yang cacat membocorkan identitas dapur
 * yang justru meminta disamarkan — persis kebalikan dari yang diminta.
 */
const LABEL_ANONIM_CADANGAN = "Dapur (nama disamarkan)";

/**
 * Mengubah entitas dapur menjadi bentuk publik.
 *
 * Ini satu-satunya fungsi yang boleh memutuskan nama mana yang tampil.
 */
export function keDapurPublik(dapur: DapurUntukSerialisasi): DapurPublik {
  const anonim = dapur.modeAnonim;
  const labelAnonim = dapur.labelAnonim.trim();

  const nama = anonim
    ? labelAnonim === ""
      ? LABEL_ANONIM_CADANGAN
      : labelAnonim
    : dapur.nama;

  return {
    id: dapur.id,
    nama,
    anonim,
    kecamatan: dapur.kecamatan,
    jenis: dapur.jenis,
    biayaBahanPerPorsiMin: dapur.biayaBahanPerPorsiMin.toString(),
    biayaBahanPerPorsiMaks: dapur.biayaBahanPerPorsiMaks.toString(),
    isContoh: dapur.isContoh,
  };
}

/**
 * Apakah dapur ini boleh ditampilkan di layar publik sama sekali.
 *
 * Berbeda dari mode anonim: mode anonim mengatur NAMA mana yang tampil, fungsi
 * ini mengatur apakah dapurnya tampil. Izin punya masa berlaku, dan izin yang
 * kedaluwarsa sama artinya dengan tidak ada izin.
 *
 * Ditaruh di berkas yang sama dengan sengaja: keduanya adalah keputusan "apa
 * yang boleh dilihat orang luar", dan memisahkannya ke berkas lain akan
 * mengulang kesalahan yang aturan 10 coba cegah.
 */
export function bolehTampilPublik(
  dapur: Pick<DapurUntukSerialisasi, "izinTampilPublik" | "izinBerlakuSampai">,
  sekarang: Date = new Date(),
): boolean {
  if (!dapur.izinTampilPublik) return false;
  if (dapur.izinBerlakuSampai === null) return true;

  // Izin berlaku sepanjang hari pada tanggal terakhirnya, jadi pembandingnya
  // adalah akhir hari itu — bukan tengah malam awal hari, yang akan memutus
  // izin satu hari lebih cepat dari yang disepakati pemilik dapur.
  const akhirHariTerakhir = new Date(dapur.izinBerlakuSampai);
  akhirHariTerakhir.setUTCHours(23, 59, 59, 999);

  return sekarang.getTime() <= akhirHariTerakhir.getTime();
}
