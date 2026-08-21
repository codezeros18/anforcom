/*
 * Draf lokal — 9.1, 9.2, 9.19.
 *
 * APA YANG INI *BUKAN*. Ini bukan mesin sinkronisasi offline. Sinkron offline
 * penuh ada di daftar TINGKAT 3 (CLAUDE.md bagian 2): dilarang selamanya, tidak
 * boleh masuk dengan nama lain atau sebagai "persiapan". Yang dibangun di sini
 * sengaja jauh lebih kecil, dan batasnya ditulis supaya tidak diam-diam tumbuh:
 *
 *   - SATU draf pada satu waktu, bukan antrean banyak operasi
 *   - HANYA catatan harian (layar 2), bukan estimasi, koreksi, atau penyaluran
 *   - Tidak ada resolusi konflik, tidak ada penggabungan, tidak ada nomor versi
 *   - Tidak ada Service Worker, tidak ada background sync
 *
 * Alasan batas itu bukan kemalasan. Antrean banyak operasi memerlukan urutan
 * kausal (estimasi butuh catatan yang belum ada id-nya), dan begitu itu masuk,
 * yang terbangun adalah mesin sinkronisasi — persis yang dilarang. Satu draf
 * catatan tidak punya masalah itu, karena tidak ada apa pun yang bergantung
 * padanya sampai ia berhasil terkirim.
 *
 * MASALAH NYATA YANG DIPECAHKAN: operator mengetik porsi di dapur yang
 * sinyalnya putus-putus, menekan Simpan, lalu angkanya hilang. Yang hilang
 * bukan hanya data — yang hilang adalah kepercayaan bahwa alat ini menyimpan
 * apa yang dia ketik.
 *
 * Berkas ini murni: tidak menyentuh `window` secara langsung, menerima
 * penyimpanannya sebagai parameter. Itu yang membuatnya bisa diuji di Vitest
 * tanpa jsdom.
 */

export const KUNCI_DRAF = "sisa_draf_catatan";

/** Bentuk penyimpanan yang dibutuhkan. `localStorage` memenuhinya. */
export interface PenyimpananSederhana {
  getItem(kunci: string): string | null;
  setItem(kunci: string, nilai: string): void;
  removeItem(kunci: string): void;
}

export interface DrafCatatan {
  tanggal: string;
  porsiDimasak: string;
  dicatatMundur: boolean;
  /** Cap waktu ISO saat draf disimpan, untuk memberi tahu umurnya ke operator. */
  disimpanPada: string;
  /**
   * `true` bila pengiriman sudah pernah dicoba dan gagal — inilah yang membuat
   * indikator "belum terkirim" muncul (9.1). Draf yang belum pernah dicoba
   * hanyalah pemulihan ketikan (9.2), dan tidak perlu mengkhawatirkan siapa pun.
   */
  pernahGagalKirim: boolean;
}

/**
 * Umur maksimum draf yang masih ditawarkan untuk dipulihkan.
 *
 * Lewat dari ini, draf dibuang diam-diam. Menawarkan angka porsi dari tiga hari
 * lalu lebih berbahaya daripada tidak menawarkan apa-apa: operator yang
 * menerimanya begitu saja akan mencatat angka hari lain sebagai hari ini.
 */
export const UMUR_DRAF_MAKS_JAM = 12;

function amanUrai(teks: string | null): unknown {
  if (teks === null) return null;
  try {
    return JSON.parse(teks);
  } catch {
    // Isi yang rusak diperlakukan seperti tidak ada draf. Draf yang tidak bisa
    // dibaca tidak boleh menjatuhkan layar yang mencoba membacanya.
    return null;
  }
}

/** Memeriksa bentuk draf secara ketat. Data dari localStorage tidak dipercaya. */
function bentuknyaBenar(nilai: unknown): nilai is DrafCatatan {
  if (typeof nilai !== "object" || nilai === null) return false;
  const d = nilai as Record<string, unknown>;
  return (
    typeof d.tanggal === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(d.tanggal) &&
    typeof d.porsiDimasak === "string" &&
    typeof d.dicatatMundur === "boolean" &&
    typeof d.disimpanPada === "string" &&
    typeof d.pernahGagalKirim === "boolean"
  );
}

export function simpanDraf(
  penyimpanan: PenyimpananSederhana,
  draf: Omit<DrafCatatan, "disimpanPada">,
  sekarang: Date = new Date(),
): void {
  try {
    penyimpanan.setItem(
      KUNCI_DRAF,
      JSON.stringify({ ...draf, disimpanPada: sekarang.toISOString() }),
    );
  } catch {
    /*
     * Penyimpanan penuh, atau mode penyamaran yang menolak menulis. Draf lokal
     * adalah jaring pengaman — kalau jaringnya sendiri gagal, alur utama tetap
     * harus jalan. Kegagalan di sini TIDAK BOLEH menghentikan pengiriman.
     */
  }
}

export function hapusDraf(penyimpanan: PenyimpananSederhana): void {
  try {
    penyimpanan.removeItem(KUNCI_DRAF);
  } catch {
    // Sama seperti di atas: kegagalan membersihkan bukan alasan menjatuhkan layar.
  }
}

/**
 * Membaca draf yang masih layak dipulihkan.
 *
 * Mengembalikan `null` bila tidak ada, bentuknya rusak, atau sudah terlalu tua.
 * Ketiganya diperlakukan sama karena akibatnya bagi operator sama: tidak ada
 * yang perlu ditawarkan.
 */
export function bacaDraf(
  penyimpanan: PenyimpananSederhana,
  sekarang: Date = new Date(),
): DrafCatatan | null {
  let mentah: string | null = null;
  try {
    mentah = penyimpanan.getItem(KUNCI_DRAF);
  } catch {
    return null;
  }

  const nilai = amanUrai(mentah);
  if (!bentuknyaBenar(nilai)) return null;

  const umurJam =
    (sekarang.getTime() - new Date(nilai.disimpanPada).getTime()) / 3_600_000;
  if (!Number.isFinite(umurJam) || umurJam < 0 || umurJam > UMUR_DRAF_MAKS_JAM) {
    return null;
  }

  return nilai;
}

/**
 * Apakah draf ini masih relevan untuk tanggal yang sedang dibuka.
 *
 * Draf untuk tanggal LAIN tidak ditawarkan. Kalau ditawarkan, operator yang
 * menekan "pulihkan" akan menimpa tanggal hari ini dengan angka hari lain —
 * kesalahan yang jauh lebih mahal daripada kehilangan ketikan.
 */
export function drafUntukTanggal(
  draf: DrafCatatan | null,
  tanggal: string,
): DrafCatatan | null {
  if (draf === null) return null;
  return draf.tanggal === tanggal ? draf : null;
}
