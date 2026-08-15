import { describe, expect, it } from "vitest";
import {
  agregasiAkurasi,
  catatKoreksi,
  type EstimasiUntukAudit,
  hitungPorsiFinal,
  type KoreksiTercatat,
} from "../audit.ts";
import { porsiDariString, porsiDariUtuh, porsiKeStringRingkas } from "../porsi.ts";
import { GalatKoreksiTidakSah } from "../galat.ts";
import type { KategoriFisik } from "../tipe.ts";

function koreksi(porsiSesudah: number | string, detik: number): KoreksiTercatat {
  return {
    porsiSesudah:
      typeof porsiSesudah === "string"
        ? porsiDariString(porsiSesudah)
        : porsiDariUtuh(porsiSesudah),
    dibuatPada: new Date(Date.UTC(2026, 7, 14, 10, 0, detik)),
  };
}

function estimasi(
  porsiEstimasi: number | string,
  ubah: Partial<EstimasiUntukAudit> = {},
): EstimasiUntukAudit {
  return {
    id: "estimasi-1",
    kategoriFisik: "padat_rata",
    porsiEstimasi:
      typeof porsiEstimasi === "string"
        ? porsiDariString(porsiEstimasi)
        : porsiDariUtuh(porsiEstimasi),
    isAnomali: false,
    koreksi: [],
    ...ubah,
  };
}

// ---------------------------------------------------------------------------
// 3.17 / 3.20 — nilai final
// ---------------------------------------------------------------------------

describe("hitungPorsiFinal (3.17)", () => {
  it("memakai nilai estimasi bila belum pernah dikoreksi", () => {
    const e = estimasi(30);
    expect(porsiKeStringRingkas(hitungPorsiFinal(e, []))).toBe("30");
  });

  it("memakai nilai koreksi bila ada satu koreksi", () => {
    const e = estimasi(30);
    expect(porsiKeStringRingkas(hitungPorsiFinal(e, [koreksi(24, 1)]))).toBe("24");
  });

  it("memakai koreksi TERAKHIR bila ada beberapa (3.20)", () => {
    const e = estimasi(30);
    const daftar = [koreksi(24, 1), koreksi(21, 2), koreksi(26, 3)];
    expect(porsiKeStringRingkas(hitungPorsiFinal(e, daftar))).toBe("26");
  });

  it("terakhir ditentukan cap waktu, bukan urutan dalam array", () => {
    const e = estimasi(30);
    // Sengaja dibalik: yang paling baru ditaruh paling depan.
    const daftar = [koreksi(26, 9), koreksi(24, 1), koreksi(21, 2)];
    expect(porsiKeStringRingkas(hitungPorsiFinal(e, daftar))).toBe("26");
  });

  it("bila cap waktu identik, yang belakangan dalam urutan masukan yang menang", () => {
    /*
     * Basis data dengan presisi detik bisa menghasilkan dua koreksi bercap waktu
     * sama. Aturannya ditulis eksplisit supaya hasilnya tidak bergantung pada
     * stabilitas `sort` bawaan mesin yang menjalankannya.
     */
    const e = estimasi(30);
    const daftar = [koreksi(24, 5), koreksi(21, 5)];
    expect(porsiKeStringRingkas(hitungPorsiFinal(e, daftar))).toBe("21");
  });

  it("mempertahankan desimal", () => {
    const e = estimasi("30.75");
    expect(porsiKeStringRingkas(hitungPorsiFinal(e, []))).toBe("30.75");
    expect(porsiKeStringRingkas(hitungPorsiFinal(e, [koreksi("24.30", 1)]))).toBe(
      "24.30",
    );
  });
});

// ---------------------------------------------------------------------------
// 3.16 / 3.19 — koreksi append-only
// ---------------------------------------------------------------------------

describe("catatKoreksi (3.16, 3.19)", () => {
  it("membentuk baris koreksi baru dengan selisih yang benar", () => {
    const e = estimasi(30);
    const baris = catatKoreksi({
      estimasi: e,
      koreksiSebelumnya: [],
      porsiSesudah: porsiDariUtuh(24),
      peranPengoreksi: "operator",
    });

    expect(baris.estimasiId).toBe(e.id);
    expect(porsiKeStringRingkas(baris.porsiSebelum)).toBe("30");
    expect(porsiKeStringRingkas(baris.porsiSesudah)).toBe("24");
    expect(porsiKeStringRingkas(baris.selisihAbsolut)).toBe("6");
    expect(baris.peranPengoreksi).toBe("operator");
  });

  /*
   * TES INTI ATURAN 2.
   *
   * Kalau koreksi menimpa estimasi, selisih antara tebakan sistem dan penilaian
   * manusia hilang selamanya — dan selisih itu persis yang dibutuhkan halaman
   * Akurasi untuk menjawab "sistem ini pernah salah tidak?".
   */
  it("TIDAK mengubah baris estimasi sedikit pun (3.19)", () => {
    const e = estimasi(30);
    const salinanSebelum = JSON.stringify(e);

    catatKoreksi({
      estimasi: e,
      koreksiSebelumnya: [],
      porsiSesudah: porsiDariUtuh(24),
      peranPengoreksi: "operator",
    });

    expect(JSON.stringify(e)).toBe(salinanSebelum);
    expect(porsiKeStringRingkas(e.porsiEstimasi)).toBe("30");
  });

  it("keluarannya tidak memuat bentuk estimasi yang sudah diubah", () => {
    /*
     * Bukan hanya "tidak mengubah" — bentuk keluarannya memang tidak punya
     * tempat untuk estimasi yang diubah. Tidak ada cara memanggil fungsi ini
     * yang menghasilkan pembaruan estimasi.
     */
    const baris = catatKoreksi({
      estimasi: estimasi(30),
      koreksiSebelumnya: [],
      porsiSesudah: porsiDariUtuh(24),
      peranPengoreksi: "operator",
    });

    expect(Object.keys(baris).sort()).toEqual(
      [
        "estimasiId",
        "peranPengoreksi",
        "porsiSebelum",
        "porsiSesudah",
        "selisihAbsolut",
      ].sort(),
    );
    expect(baris).not.toHaveProperty("porsiEstimasi");
    expect(baris).not.toHaveProperty("estimasi");
  });

  it("dua koreksi berurutan menghasilkan dua baris, dan rantainya menyambung (3.20)", () => {
    const e = estimasi(30);

    const pertama = catatKoreksi({
      estimasi: e,
      koreksiSebelumnya: [],
      porsiSesudah: porsiDariUtuh(24),
      peranPengoreksi: "operator",
    });

    const tersimpan = [koreksi(24, 1)];

    const kedua = catatKoreksi({
      estimasi: e,
      koreksiSebelumnya: tersimpan,
      porsiSesudah: porsiDariUtuh(21),
      peranPengoreksi: "pengelola",
    });

    // Dua baris terpisah, bukan satu baris yang diperbarui.
    expect(pertama).not.toBe(kedua);

    // porsiSebelum koreksi kedua = porsiSesudah koreksi pertama. Rantai terbaca
    // berurutan saat riwayat koreksi ditampilkan.
    expect(porsiKeStringRingkas(pertama.porsiSesudah)).toBe("24");
    expect(porsiKeStringRingkas(kedua.porsiSebelum)).toBe("24");
    expect(porsiKeStringRingkas(kedua.porsiSesudah)).toBe("21");
    expect(porsiKeStringRingkas(kedua.selisihAbsolut)).toBe("3");

    // Nilai final = koreksi terakhir.
    const semua = [...tersimpan, koreksi(21, 2)];
    expect(porsiKeStringRingkas(hitungPorsiFinal(e, semua))).toBe("21");

    // Estimasi asli tetap utuh.
    expect(porsiKeStringRingkas(e.porsiEstimasi)).toBe("30");
  });

  it("koreksi ke atas juga menghasilkan selisih positif", () => {
    const baris = catatKoreksi({
      estimasi: estimasi(20),
      koreksiSebelumnya: [],
      porsiSesudah: porsiDariUtuh(28),
      peranPengoreksi: "operator",
    });
    expect(porsiKeStringRingkas(baris.selisihAbsolut)).toBe("8");
  });

  it("menerima koreksi menjadi nol porsi", () => {
    // "Ternyata habis" adalah koreksi yang sah dan sering terjadi.
    const baris = catatKoreksi({
      estimasi: estimasi(12),
      koreksiSebelumnya: [],
      porsiSesudah: porsiDariUtuh(0),
      peranPengoreksi: "operator",
    });
    expect(porsiKeStringRingkas(baris.porsiSesudah)).toBe("0");
    expect(porsiKeStringRingkas(baris.selisihAbsolut)).toBe("12");
  });

  it("menolak porsi negatif", () => {
    expect(() =>
      catatKoreksi({
        estimasi: estimasi(12),
        koreksiSebelumnya: [],
        porsiSesudah: porsiDariString("-1"),
        peranPengoreksi: "operator",
      }),
    ).toThrow(GalatKoreksiTidakSah);
  });
});

// ---------------------------------------------------------------------------
// 3.18 / 3.21 — agregasi akurasi
// ---------------------------------------------------------------------------

describe("agregasiAkurasi (3.18, 3.21)", () => {
  it("menghitung angka yang cocok dengan hitungan tangan", () => {
    /*
     * Empat estimasi, dua dikoreksi.
     *
     *   e1: 30 -> 24   selisih 6, relatif 6/24  = 25.00%
     *   e2: 20 -> 25   selisih 5, relatif 5/25  = 20.00%
     *   e3: 15         tidak dikoreksi
     *   e4: 10         tidak dikoreksi
     *
     *   persenDikoreksi     = 2/4            = 50.00%
     *   simpanganRataPersen = (25 + 20) / 2  = 22.50%
     */
    const data: EstimasiUntukAudit[] = [
      estimasi(30, { id: "e1", koreksi: [koreksi(24, 1)] }),
      estimasi(20, { id: "e2", koreksi: [koreksi(25, 1)] }),
      estimasi(15, { id: "e3" }),
      estimasi(10, { id: "e4" }),
    ];

    const hasil = agregasiAkurasi(data);

    expect(hasil.totalEstimasi).toBe(4);
    expect(hasil.jumlahDikoreksi).toBe(2);
    expect(hasil.persenDikoreksi).toBe("50.00");
    expect(hasil.simpanganRataPersen).toBe("22.50");
    expect(hasil.jumlahDikecualikan).toBe(0);
  });

  it("mengukur simpangan terhadap nilai koreksi TERAKHIR", () => {
    // 30 -> 24 -> 20. Simpangan diukur 30 vs 20 = 10/20 = 50.00%
    const data = [estimasi(30, { koreksi: [koreksi(24, 1), koreksi(20, 2)] })];
    expect(agregasiAkurasi(data).simpanganRataPersen).toBe("50.00");
  });

  it("mengecualikan estimasi dari hari anomali", () => {
    const data: EstimasiUntukAudit[] = [
      estimasi(30, { id: "e1", koreksi: [koreksi(24, 1)] }),
      estimasi(20, { id: "e2" }),
      // Hari acara: kondisi visualnya tidak mewakili operasi sehari-hari.
      estimasi(100, { id: "e3", isAnomali: true, koreksi: [koreksi(10, 1)] }),
    ];

    const hasil = agregasiAkurasi(data);

    expect(hasil.totalEstimasi).toBe(2);
    expect(hasil.jumlahDikecualikan).toBe(1);
    // Bila e3 ikut, simpangan rata-rata melonjak ke 475%.
    expect(hasil.simpanganRataPersen).toBe("25.00");
  });

  it("memecah angka per kategori fisik", () => {
    const data: EstimasiUntukAudit[] = [
      estimasi(30, { kategoriFisik: "padat_menggunung", koreksi: [koreksi(24, 1)] }),
      estimasi(20, { kategoriFisik: "padat_menggunung" }),
      estimasi(10, { kategoriFisik: "berkuah", koreksi: [koreksi(11, 1)] }),
      estimasi(40, { kategoriFisik: "padat_rata" }),
    ];

    const hasil = agregasiAkurasi(data);
    const cari = (k: KategoriFisik) =>
      hasil.perKategoriFisik.find((x) => x.kategoriFisik === k)!;

    expect(cari("padat_menggunung").totalEstimasi).toBe(2);
    expect(cari("padat_menggunung").jumlahDikoreksi).toBe(1);
    expect(cari("padat_menggunung").persenDikoreksi).toBe("50.00");
    expect(cari("padat_menggunung").simpanganRataPersen).toBe("25.00");

    // 10 -> 11: selisih 1, relatif 1/11 = 9.0909...% -> 9.09%
    expect(cari("berkuah").simpanganRataPersen).toBe("9.09");

    expect(cari("padat_rata").totalEstimasi).toBe(1);
    expect(cari("padat_rata").jumlahDikoreksi).toBe(0);
    expect(cari("padat_rata").simpanganRataPersen).toBeNull();
  });

  it("selalu memuat ketiga kategori, meski salah satunya kosong", () => {
    const hasil = agregasiAkurasi([estimasi(10, { kategoriFisik: "berkuah" })]);
    expect(hasil.perKategoriFisik.map((k) => k.kategoriFisik)).toEqual([
      "padat_rata",
      "padat_menggunung",
      "berkuah",
    ]);
  });

  /*
   * Tiga tes berikut menjaga kejujuran angka akurasi. Semuanya tentang hal yang
   * sama: angka yang belum terukur tidak boleh terlihat seperti angka bagus.
   */
  it("simpangan null bila belum ada koreksi, BUKAN nol persen", () => {
    const hasil = agregasiAkurasi([estimasi(10), estimasi(20)]);
    // "0% simpangan" terbaca sebagai sistem yang tidak pernah salah, padahal
    // artinya belum ada yang diukur.
    expect(hasil.simpanganRataPersen).toBeNull();
    expect(hasil.persenDikoreksi).toBe("0.00");
  });

  it("persenDikoreksi null bila tidak ada estimasi sama sekali", () => {
    const hasil = agregasiAkurasi([]);
    expect(hasil.totalEstimasi).toBe(0);
    expect(hasil.persenDikoreksi).toBeNull();
    expect(hasil.simpanganRataPersen).toBeNull();
  });

  it("estimasi yang tidak dikoreksi tidak dihitung sebagai simpangan nol", () => {
    /*
     * Kalau estimasi tanpa koreksi dianggap simpangan 0%, akurasi akan terlihat
     * membaik setiap kali operator terburu-buru dan melewatkan koreksi — sistem
     * jadi terlihat paling akurat justru saat paling sedikit diperiksa.
     */
    const satuKoreksi = [estimasi(30, { koreksi: [koreksi(24, 1)] })];
    const satuKoreksiPlusSembilanTanpaKoreksi = [
      ...satuKoreksi,
      ...Array.from({ length: 9 }, (_, i) => estimasi(20, { id: `tanpa-${i}` })),
    ];

    expect(agregasiAkurasi(satuKoreksi).simpanganRataPersen).toBe("25.00");
    expect(agregasiAkurasi(satuKoreksiPlusSembilanTanpaKoreksi).simpanganRataPersen).toBe(
      "25.00",
    );
    // Yang berubah hanyalah berapa banyak yang diperiksa, dan itu ditampilkan.
    expect(agregasiAkurasi(satuKoreksiPlusSembilanTanpaKoreksi).persenDikoreksi).toBe(
      "10.00",
    );
  });

  it("koreksi menjadi nol porsi tetap dihitung sebagai koreksi tapi tidak menyumbang simpangan", () => {
    // Simpangan relatif terhadap nol tidak terdefinisi. Baris itu tetap dihitung
    // sebagai koreksi — hanya persentasenya yang tidak bisa dibentuk.
    const data = [
      estimasi(12, { id: "e1", koreksi: [koreksi(0, 1)] }),
      estimasi(30, { id: "e2", koreksi: [koreksi(24, 1)] }),
    ];

    const hasil = agregasiAkurasi(data);
    expect(hasil.jumlahDikoreksi).toBe(2);
    expect(hasil.persenDikoreksi).toBe("100.00");
    expect(hasil.simpanganRataPersen).toBe("25.00");
  });

  it("membulatkan persentase ke dua desimal secara konsisten", () => {
    // 1/3 = 33.333...% -> 33.33 ; 2/3 = 66.666...% -> 66.67
    const sepertiga = agregasiAkurasi([
      estimasi(10, { id: "a", koreksi: [koreksi(11, 1)] }),
      estimasi(10, { id: "b" }),
      estimasi(10, { id: "c" }),
    ]);
    expect(sepertiga.persenDikoreksi).toBe("33.33");

    const duaPertiga = agregasiAkurasi([
      estimasi(10, { id: "a", koreksi: [koreksi(11, 1)] }),
      estimasi(10, { id: "b", koreksi: [koreksi(11, 1)] }),
      estimasi(10, { id: "c" }),
    ]);
    expect(duaPertiga.persenDikoreksi).toBe("66.67");
  });
});
