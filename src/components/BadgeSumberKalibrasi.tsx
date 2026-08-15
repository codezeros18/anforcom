/*
 * Badge sumber kalibrasi — tugas 6.4.
 *
 * Selama `sumber='deklarasi'`, angka estimasi berasal dari tebakan operator
 * saat pendaftaran dan BELUM teruji satu koreksi pun. Badge ini mengatakannya
 * terus terang.
 *
 * TIGA HAL YANG MEMBUATNYA BEKERJA, dan yang akan merusaknya kalau diubah:
 *
 * 1. ABU-ABU, BUKAN MERAH. Ini keterangan keadaan, bukan peringatan kesalahan.
 *    Merah akan membuat operator mengira dia melakukan sesuatu yang salah saat
 *    mendaftarkan wadah — padahal dia baru saja melakukan hal yang paling
 *    berguna yang bisa dia lakukan.
 *
 * 2. KALIMATNYA MENJANJIKAN PERBAIKAN, bukan menyatakan kekurangan.
 *    "angka akan membaik setelah beberapa koreksi" memberi tahu bahwa
 *    mengoreksi itu ada gunanya — dan koreksi itulah bahan mentah kalibrasi.
 *    Badge ini karena itu bukan sekadar label; ia mengundang perilaku yang
 *    membuat sistemnya membaik.
 *
 * 3. IA HILANG SENDIRI. Begitu `sumber='terkalibrasi'`, badge tidak
 *    ditampilkan. Badge yang menetap selamanya berhenti dibaca dalam seminggu.
 */

export interface BadgeSumberKalibrasiProps {
  sumber: "deklarasi" | "terkalibrasi";
  /** Konstanta dipinjam dari jenis masakan lain sekategori. */
  perkiraan?: boolean;
  jumlahKoreksi?: number;
}

export const TEKS_BELUM_TERKALIBRASI =
  "Belum terkalibrasi — angka akan membaik setelah beberapa koreksi.";

export const TEKS_KONSTANTA_PINJAMAN = "Angka ini perkiraan dari wadah sejenis.";

/** Teks badge, atau `null` bila tidak ada yang perlu dikatakan. */
export function teksBadge(
  sumber: "deklarasi" | "terkalibrasi",
  perkiraan = false,
): string | null {
  if (sumber === "deklarasi") return TEKS_BELUM_TERKALIBRASI;
  if (perkiraan) return TEKS_KONSTANTA_PINJAMAN;
  return null;
}

export function BadgeSumberKalibrasi({
  sumber,
  perkiraan = false,
}: BadgeSumberKalibrasiProps) {
  const teks = teksBadge(sumber, perkiraan);
  if (teks === null) return null;

  return (
    <p
      className="text-konteks rounded-lg bg-netral-100 px-3 py-2 text-netral-600"
      role="note"
    >
      {teks}
    </p>
  );
}
