/*
 * Error bertipe untuk `/core`.
 *
 * CLAUDE.md bagian 5: fungsi `/core` melempar error bertipe, tidak mengembalikan
 * `null` diam-diam. Alasannya praktis — `null` yang dikembalikan diam-diam akan
 * mengalir ke UI sebagai angka kosong atau `NaN`, dan operator akan melihat
 * layar rusak tanpa penjelasan. Error bertipe memaksa pemanggil memutuskan apa
 * yang ditampilkan.
 *
 * `kode` adalah konstanta yang dipakai route handler untuk membentuk respons
 * `{ ok: false, kode, pesan }`. Pesan untuk pengguna dirakit di lapisan route,
 * bukan di sini — `/core` tidak tahu bahasa apa yang sedang dipakai layar.
 */

export type KodeGalat =
  | "PORSI_TIDAK_SAH"
  | "FRAKSI_TIDAK_SAH"
  | "DATA_CATATAN_TIDAK_SAH"
  | "KOREKSI_TIDAK_SAH"
  | "KONSTANTA_TIDAK_DITEMUKAN"
  | "KALIBRASI_TIDAK_SAH";

/** Induk semua error domain. Memudahkan `catch` yang membedakan galat kita dari galat lain. */
export abstract class GalatDomain extends Error {
  abstract readonly kode: KodeGalat;

  constructor(pesan: string) {
    super(pesan);
    this.name = new.target.name;
  }
}

/** Nilai porsi tidak bisa diurai, atau bukan bilangan bulat perseratus. */
export class GalatPorsiTidakSah extends GalatDomain {
  readonly kode = "PORSI_TIDAK_SAH" as const;
}

/**
 * Catatan harian melanggar asumsi yang seharusnya sudah dijamin lapisan lain.
 *
 * Contoh: porsi tersisa lebih besar daripada porsi dimasak. Itu mustahil secara
 * fisik, jadi kalau sampai muncul di `/core`, ada validasi di batas sistem yang
 * bocor — dan menghitung konsumsi negatif diam-diam akan menghasilkan lantai
 * keras yang salah tanpa ada yang tahu.
 */
export class GalatDataCatatanTidakSah extends GalatDomain {
  readonly kode = "DATA_CATATAN_TIDAK_SAH" as const;
}

/** Koreksi tidak masuk akal, misalnya porsi negatif. */
export class GalatKoreksiTidakSah extends GalatDomain {
  readonly kode = "KOREKSI_TIDAK_SAH" as const;
}

/** Fraksi keterisian di luar rentang 0..1, atau tidak bisa diurai. */
export class GalatFraksiTidakSah extends GalatDomain {
  readonly kode = "FRAKSI_TIDAK_SAH" as const;
}

/**
 * Tidak ada konstanta kalibrasi untuk pasangan wadah x jenis masakan ini, dan
 * tidak ada pula yang bisa dipinjam dari kategori fisik yang sama.
 *
 * SISTEM MENOLAK MENEBAK. Ini bukan keterbatasan yang disembunyikan — ini
 * demonstrasi bahwa sistem tahu batas dirinya sendiri. Layar menjawabnya dengan
 * "Wadah ini belum terdaftar di dapur ini" beserta dua jalan keluar, bukan
 * dengan angka karangan yang terlihat berwibawa.
 */
export class KonstantaTidakDitemukan extends GalatDomain {
  readonly kode = "KONSTANTA_TIDAK_DITEMUKAN" as const;

  /*
   * Field dideklarasikan lalu diisi di badan konstruktor, BUKAN sebagai
   * parameter property (`constructor(readonly wadahId: string)`).
   *
   * Parameter property memerlukan pembangkitan kode, bukan sekadar pembuangan
   * tipe, sehingga Node menolaknya dengan `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX`
   * saat menjalankan berkas .ts secara langsung. Vitest tidak terpengaruh karena
   * memakai transformer penuh — jadi tesnya hijau sementara skrip yang dijalankan
   * `node` gagal. Gejalanya dicatat di PROGRESS.md bagian "jebakan lingkungan".
   */
  readonly wadahId: string;
  readonly jenisMasakanId: string;

  constructor(wadahId: string, jenisMasakanId: string) {
    super(
      `Tidak ada konstanta kalibrasi untuk wadah ${wadahId} dengan jenis masakan ${jenisMasakanId}, ` +
        "dan tidak ada kategori fisik sama yang bisa dipinjam.",
    );
    this.wadahId = wadahId;
    this.jenisMasakanId = jenisMasakanId;
  }
}

/** Data kalibrasi melanggar asumsi, misalnya pembaruan dari fraksi nol. */
export class GalatKalibrasiTidakSah extends GalatDomain {
  readonly kode = "KALIBRASI_TIDAK_SAH" as const;
}
