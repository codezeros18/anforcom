import type { KonteksKalibrasi } from "@/core/kalibrasi";
import { porsiKePerseratus, type Porsi } from "@/core/porsi";
import type { KategoriFisik } from "@/core/tipe";

/*
 * Helper murni untuk lapisan API.
 *
 * DIPISAHKAN DARI `data.ts` DENGAN SENGAJA. `data.ts` mengimpor client Prisma,
 * dan client itu melempar saat dimuat bila `DATABASE_URL` kosong — perilaku
 * yang memang diinginkan di production. Konsekuensinya: apa pun yang mengimpor
 * `data.ts` menjadi mustahil diuji tanpa basis data, dan CI menjalankan tes
 * TANPA basis data sama sekali.
 *
 * Jadi yang murni tinggal di sini, dan bisa diuji di mana saja.
 */

export function kategoriDari(
  konteks: KonteksKalibrasi,
  jenisMasakanId: string,
): KategoriFisik {
  return (
    konteks.jenisMasakan.find((j) => j.id === jenisMasakanId)?.kategoriFisik ??
    "padat_rata"
  );
}

/** Tanggal `YYYY-MM-DD` menjadi `Date` tengah malam UTC, sesuai kolom DATE. */
export function tanggalUtc(teks: string): Date {
  return new Date(`${teks}T00:00:00.000Z`);
}

export interface RentangRupiah {
  bawah: string;
  atas: string;
  /**
   * Penanda yang membuat angka ini MUSTAHIL tertukar dengan angka klaim.
   *
   * CLAUDE.md aturan 5: angka dampak hanya dari `penimbangan_referensi`.
   * Angka di bawah dihitung dari `estimasi`, jadi ia angka OPERASIONAL harian
   * untuk layar operator — bukan bahan klaim, bukan bahan pitch, bukan bahan
   * laporan dampak. Penandanya ikut di setiap respons supaya kode di hilir
   * tidak bisa memakainya tanpa melihat peringatan ini.
   */
  sumber: "estimasi_operasional";
  bolehUntukKlaim: false;
}

/**
 * Rentang rupiah kasar dari porsi tersisa.
 *
 * Bilangan bulat sepanjang perhitungan: porsi dalam perseratus, biaya dalam
 * sen, dibagi di akhir.
 */
export function hitungRentangRupiah(
  porsiTersisa: Porsi,
  biayaMinSen: number,
  biayaMaksSen: number,
): RentangRupiah {
  const perseratus = porsiKePerseratus(porsiTersisa);

  return {
    bawah: String(Math.round((perseratus * biayaMinSen) / 10_000)),
    atas: String(Math.round((perseratus * biayaMaksSen) / 10_000)),
    sumber: "estimasi_operasional",
    bolehUntukKlaim: false,
  };
}

/** `DECIMAL(12,2)` rupiah menjadi bilangan bulat sen, tanpa melewati float. */
export function keSen(desimal: { toString(): string }): number {
  const [utuh = "0", pecahan = ""] = desimal.toString().split(".");
  return Number(utuh) * 100 + Number(pecahan.padEnd(2, "0").slice(0, 2));
}
