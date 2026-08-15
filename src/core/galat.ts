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
  "PORSI_TIDAK_SAH" | "DATA_CATATAN_TIDAK_SAH" | "KOREKSI_TIDAK_SAH";

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
