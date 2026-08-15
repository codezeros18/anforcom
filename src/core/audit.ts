/*
 * Jejak koreksi dan agregasi akurasi.
 *
 * ATURAN YANG MEMBENTUK SELURUH BERKAS INI (CLAUDE.md aturan 2):
 * koreksi selalu baris baru. Tabel `koreksi` hanya menerima INSERT — tidak
 * pernah UPDATE, tidak pernah DELETE. Nilai di `estimasi` tidak pernah diubah
 * setelah dibuat; nilai final DIHITUNG dari keduanya, bukan ditimpa.
 *
 * Kenapa: kalau koreksi menimpa estimasi, selisih antara tebakan sistem dan
 * penilaian manusia hilang selamanya — dan selisih itu persis yang dibutuhkan
 * halaman Akurasi untuk menjawab "sistem ini pernah salah tidak?". Sistem yang
 * tidak bisa menunjukkan kesalahannya sendiri tidak bisa dipercaya soal
 * keberhasilannya.
 *
 * Cara berkas ini menegakkannya, bukan sekadar memintanya: `catatKoreksi()`
 * mengembalikan BARIS BARU untuk disisipkan. Ia tidak menerima dan tidak
 * mengembalikan estimasi yang sudah diubah, jadi tidak ada bentuk pemanggilan
 * yang menghasilkan pembaruan estimasi. Fungsi di sini murni — penulisan ke
 * basis data terjadi di route handler (Sprint 5), sehingga `/core` tetap bisa
 * diuji tanpa basis data sama sekali. CI menjalankan tes tanpa Postgres.
 */

import { GalatKoreksiTidakSah } from "./galat.ts";
import {
  type Porsi,
  persenKeString,
  persenPerseratus,
  porsiKePerseratus,
  porsiKeStringRingkas,
  porsiSelisihAbsolut,
} from "./porsi.ts";
import { SEMUA_KATEGORI_FISIK, type KategoriFisik, type Peran } from "./tipe.ts";

// ---------------------------------------------------------------------------
// Bentuk data
// ---------------------------------------------------------------------------

/** Satu baris koreksi yang sudah tersimpan. */
export interface KoreksiTercatat {
  porsiSesudah: Porsi;
  dibuatPada: Date;
}

export interface EstimasiUntukAudit {
  id: string;
  kategoriFisik: KategoriFisik;
  porsiEstimasi: Porsi;
  /** Berasal dari catatan harian estimasi ini. Hari anomali dikecualikan dari agregasi. */
  isAnomali: boolean;
  koreksi: readonly KoreksiTercatat[];
}

/** Baris yang siap disisipkan ke tabel `koreksi`. Tidak pernah dipakai untuk UPDATE. */
export interface BarisKoreksiBaru {
  estimasiId: string;
  porsiSebelum: Porsi;
  porsiSesudah: Porsi;
  selisihAbsolut: Porsi;
  peranPengoreksi: Peran;
}

export interface MasukanKoreksi {
  estimasi: { id: string; porsiEstimasi: Porsi };
  /** Koreksi yang sudah ada untuk estimasi ini. Kosong bila ini koreksi pertama. */
  koreksiSebelumnya: readonly KoreksiTercatat[];
  porsiSesudah: Porsi;
  peranPengoreksi: Peran;
}

// ---------------------------------------------------------------------------
// Nilai final
// ---------------------------------------------------------------------------

/**
 * Nilai final sebuah estimasi: koreksi TERAKHIR bila ada, selain itu nilai
 * estimasi apa adanya.
 *
 * "Terakhir" ditentukan `dibuatPada`. Bila dua koreksi punya cap waktu yang
 * persis sama — mungkin terjadi pada basis data dengan presisi detik — yang
 * belakangan dalam urutan masukan yang menang. Aturan itu ditulis eksplisit
 * supaya hasilnya tidak bergantung pada stabilitas `sort` bawaan mesin.
 */
export function hitungPorsiFinal(
  estimasi: { porsiEstimasi: Porsi },
  koreksiList: readonly KoreksiTercatat[],
): Porsi {
  let terakhir: { koreksi: KoreksiTercatat; indeks: number } | null = null;

  for (const [indeks, koreksi] of koreksiList.entries()) {
    if (terakhir === null) {
      terakhir = { koreksi, indeks };
      continue;
    }
    const lebihBaru =
      koreksi.dibuatPada.getTime() > terakhir.koreksi.dibuatPada.getTime();
    const samaTapiBelakangan =
      koreksi.dibuatPada.getTime() === terakhir.koreksi.dibuatPada.getTime() &&
      indeks > terakhir.indeks;

    if (lebihBaru || samaTapiBelakangan) terakhir = { koreksi, indeks };
  }

  return terakhir === null ? estimasi.porsiEstimasi : terakhir.koreksi.porsiSesudah;
}

// ---------------------------------------------------------------------------
// Mencatat koreksi
// ---------------------------------------------------------------------------

/**
 * Membentuk baris koreksi baru.
 *
 * `porsiSebelum` diambil dari nilai final SAAT INI, bukan dari `porsiEstimasi`.
 * Jadi pada koreksi kedua, `porsiSebelum` adalah `porsiSesudah` milik koreksi
 * pertama — rantainya terbaca berurutan saat riwayat koreksi ditampilkan, dan
 * setiap langkah menjelaskan dirinya sendiri.
 *
 * Fungsi ini tidak menyentuh estimasi. Ia tidak bisa: estimasi hanya dibaca.
 */
export function catatKoreksi(masukan: MasukanKoreksi): BarisKoreksiBaru {
  if (porsiKePerseratus(masukan.porsiSesudah) < 0) {
    throw new GalatKoreksiTidakSah(
      `Porsi hasil koreksi tidak boleh negatif, diterima ${porsiKeStringRingkas(masukan.porsiSesudah)}.`,
    );
  }

  const porsiSebelum = hitungPorsiFinal(masukan.estimasi, masukan.koreksiSebelumnya);

  return {
    estimasiId: masukan.estimasi.id,
    porsiSebelum,
    porsiSesudah: masukan.porsiSesudah,
    selisihAbsolut: porsiSelisihAbsolut(masukan.porsiSesudah, porsiSebelum),
    peranPengoreksi: masukan.peranPengoreksi,
  };
}

// ---------------------------------------------------------------------------
// Agregasi akurasi
// ---------------------------------------------------------------------------

export interface RingkasanAkurasi {
  totalEstimasi: number;
  jumlahDikoreksi: number;
  /**
   * Persentase sebagai teks dua desimal, misalnya "24.00". `null` bila tidak
   * terdefinisi (tidak ada estimasi sama sekali).
   *
   * Sengaja bukan `0` saat tidak terdefinisi: "0% dikoreksi" terbaca sebagai
   * sistem yang tidak pernah salah, padahal artinya belum ada yang diukur.
   */
  persenDikoreksi: string | null;
  /**
   * Rata-rata simpangan relatif terhadap nilai hasil koreksi, sebagai teks dua
   * desimal. `null` bila belum ada koreksi yang bisa diukur.
   */
  simpanganRataPersen: string | null;
}

export interface RingkasanAkurasiKategori extends RingkasanAkurasi {
  kategoriFisik: KategoriFisik;
}

export interface HasilAgregasiAkurasi extends RingkasanAkurasi {
  perKategoriFisik: RingkasanAkurasiKategori[];
  /** Estimasi dari hari anomali. Dikeluarkan dari seluruh angka di atas. */
  jumlahDikecualikan: number;
}

/**
 * Menghitung ringkasan akurasi dari estimasi beserta jejak koreksinya.
 *
 * Estimasi dari hari anomali dikecualikan, konsisten dengan mesin rekomendasi:
 * hari acara punya kondisi visual yang tidak mewakili operasi normal (wadah
 * lebih penuh, penyajian berbeda), dan memasukkannya akan membuat angka akurasi
 * menjelaskan sesuatu yang bukan pemakaian sehari-hari.
 *
 * Simpangan diukur relatif terhadap nilai HASIL KOREKSI, karena itulah yang
 * dianggap benar oleh orang yang melihat wadahnya langsung. Estimasi yang tidak
 * pernah dikoreksi tidak punya simpangan terukur — ia tidak dihitung sebagai
 * simpangan nol. Menganggapnya nol akan membuat akurasi terlihat membaik setiap
 * kali operator terburu-buru dan melewatkan koreksi.
 */
export function agregasiAkurasi(
  estimasi: readonly EstimasiUntukAudit[],
): HasilAgregasiAkurasi {
  const dipakai = estimasi.filter((e) => !e.isAnomali);
  const jumlahDikecualikan = estimasi.length - dipakai.length;

  return {
    ...ringkas(dipakai),
    perKategoriFisik: SEMUA_KATEGORI_FISIK.map((kategori) => ({
      kategoriFisik: kategori,
      ...ringkas(dipakai.filter((e) => e.kategoriFisik === kategori)),
    })),
    jumlahDikecualikan,
  };
}

function ringkas(estimasi: readonly EstimasiUntukAudit[]): RingkasanAkurasi {
  const totalEstimasi = estimasi.length;
  const dikoreksi = estimasi.filter((e) => e.koreksi.length > 0);

  // Simpangan hanya bisa dihitung bila nilai acuannya bukan nol. Estimasi yang
  // dikoreksi menjadi 0 porsi ("ternyata habis") tetap dihitung sebagai koreksi,
  // tapi tidak menyumbang persentase — pembaginya tidak ada.
  const perseratusPersen: number[] = [];
  for (const e of dikoreksi) {
    const final = hitungPorsiFinal(e, e.koreksi);
    if (porsiKePerseratus(final) === 0) continue;

    const selisih = porsiSelisihAbsolut(e.porsiEstimasi, final);
    perseratusPersen.push(
      persenPerseratus(porsiKePerseratus(selisih), porsiKePerseratus(final)),
    );
  }

  const rataSimpangan =
    perseratusPersen.length === 0
      ? null
      : Math.round(
          perseratusPersen.reduce((jumlah, n) => jumlah + n, 0) / perseratusPersen.length,
        );

  return {
    totalEstimasi,
    jumlahDikoreksi: dikoreksi.length,
    persenDikoreksi:
      totalEstimasi === 0
        ? null
        : persenKeString(persenPerseratus(dikoreksi.length, totalEstimasi)),
    simpanganRataPersen: rataSimpangan === null ? null : persenKeString(rataSimpangan),
  };
}
