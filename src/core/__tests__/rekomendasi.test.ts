import { describe, expect, it } from "vitest";
import {
  AMBANG_DATA_MINIMUM,
  type CatatanUntukRekomendasi,
  hitungKonsumsiAktual,
  hitungRekomendasi,
  PANJANG_JENDELA_HARI,
} from "../rekomendasi.ts";
import { porsiDariString, porsiDariUtuh, porsiKeStringRingkas } from "../porsi.ts";
import { GalatDataCatatanTidakSah } from "../galat.ts";

/*
 * Seluruh tanggal dibangun relatif terhadap BESOK, dalam UTC. Menuliskan
 * tanggal harfiah akan membuat tes ini bergantung pada nama hari yang harus
 * dihitung tangan, dan salah satu bug yang paling mudah lolos di mesin ini
 * adalah salah hari.
 */
const BESOK = new Date("2026-08-19T00:00:00.000Z"); // Rabu

function hariSebelumBesok(jumlah: number): Date {
  const d = new Date(BESOK);
  d.setUTCDate(d.getUTCDate() - jumlah);
  return d;
}

let nomorUrut = 0;

/**
 * Membuat catatan dengan konsumsi yang diinginkan.
 *
 * Sisa dipatok 20 porsi dan porsi dimasak dihitung mundur, supaya angka
 * konsumsi di tes terbaca langsung tanpa perlu menghitung selisih.
 */
function catatan(
  hariLalu: number,
  konsumsi: number | string,
  ubah: Partial<CatatanUntukRekomendasi> = {},
): CatatanUntukRekomendasi {
  const sisa = porsiDariUtuh(20);
  const nilaiKonsumsi =
    typeof konsumsi === "string" ? porsiDariString(konsumsi) : porsiDariUtuh(konsumsi);

  nomorUrut += 1;
  return {
    id: `catatan-${nomorUrut}`,
    tanggal: hariSebelumBesok(hariLalu),
    porsiDimasak: porsiDariString(String((nilaiKonsumsi + sisa) / 100)),
    porsiTersisaFinal: sisa,
    isAnomali: false,
    alasanAnomali: null,
    ...ubah,
  };
}

/** Lima hari biasa dengan konsumsi rendah, supaya ambang |D| >= 5 terpenuhi. */
function limaHariBiasa(konsumsi = 200): CatatanUntukRekomendasi[] {
  return [1, 2, 3, 4, 5].map((h) => catatan(h, konsumsi));
}

// ---------------------------------------------------------------------------
// 3.1 — konsumsi aktual
// ---------------------------------------------------------------------------

describe("hitungKonsumsiAktual (3.1)", () => {
  it("konsumsi = porsiDimasak - porsiTersisaFinal", () => {
    const c = catatan(1, 280);
    expect(porsiKeStringRingkas(hitungKonsumsiAktual(c)!)).toBe("280");
  });

  it("mengembalikan null bila hari belum difinalisasi", () => {
    const c = catatan(1, 280, { porsiTersisaFinal: null });
    expect(hitungKonsumsiAktual(c)).toBeNull();
  });

  it("mempertahankan desimal tanpa melewati float", () => {
    const c: CatatanUntukRekomendasi = {
      ...catatan(1, 280),
      porsiDimasak: porsiDariString("309.48"),
      porsiTersisaFinal: porsiDariString("13.29"),
    };
    expect(porsiKeStringRingkas(hitungKonsumsiAktual(c)!)).toBe("296.19");
  });

  it("melempar bila sisa melebihi yang dimasak, bukan mengembalikan angka negatif", () => {
    /*
     * Konsumsi negatif mustahil secara fisik. Kalau dibiarkan lewat, ia akan
     * masuk ke perhitungan lantai keras dan menurunkannya diam-diam.
     */
    const c: CatatanUntukRekomendasi = {
      ...catatan(1, 100),
      porsiDimasak: porsiDariUtuh(100),
      porsiTersisaFinal: porsiDariUtuh(150),
    };
    expect(() => hitungKonsumsiAktual(c)).toThrow(GalatDataCatatanTidakSah);
  });
});

// ---------------------------------------------------------------------------
// 3.6 / 3.12 — ambang data minimum
// ---------------------------------------------------------------------------

describe("ambang data minimum (3.6, 3.12)", () => {
  it("|D| = 4 mengembalikan status belum_cukup_data TANPA angka rekomendasi", () => {
    const hasil = hitungRekomendasi(
      [1, 2, 3, 4].map((h) => catatan(h, 280)),
      BESOK,
    );

    expect(hasil.status).toBe("belum_cukup_data");
    if (hasil.status !== "belum_cukup_data") throw new Error("status salah");

    expect(hasil.jumlahData).toBe(4);
    expect(hasil.sisaHari).toBe(1);

    // Yang paling penting: tidak ada angka rekomendasi di mana pun pada hasil.
    expect(Object.keys(hasil)).toEqual(["status", "jumlahData", "sisaHari"]);
    expect(JSON.stringify(hasil)).not.toContain("rekomendasi");
    expect(JSON.stringify(hasil)).not.toContain("lantai");
  });

  it("|D| = 0 juga tidak mengeluarkan angka", () => {
    const hasil = hitungRekomendasi([], BESOK);
    expect(hasil.status).toBe("belum_cukup_data");
    if (hasil.status !== "belum_cukup_data") throw new Error("status salah");
    expect(hasil.jumlahData).toBe(0);
    expect(hasil.sisaHari).toBe(AMBANG_DATA_MINIMUM);
  });

  it("|D| = 5 sudah mengeluarkan rekomendasi", () => {
    const hasil = hitungRekomendasi(limaHariBiasa(), BESOK);
    expect(hasil.status).toBe("siap");
  });

  it("hari anomali TIDAK ikut memenuhi ambang", () => {
    // Empat hari sah + satu anomali = |D| 4, bukan 5.
    const data = [
      ...[1, 2, 3, 4].map((h) => catatan(h, 280)),
      catatan(5, 500, { isAnomali: true, alasanAnomali: "Acara" }),
    ];
    const hasil = hitungRekomendasi(data, BESOK);
    expect(hasil.status).toBe("belum_cukup_data");
  });

  it("hari yang belum difinalisasi TIDAK ikut memenuhi ambang", () => {
    const data = [
      ...[1, 2, 3, 4].map((h) => catatan(h, 280)),
      catatan(5, 280, { porsiTersisaFinal: null }),
    ];
    const hasil = hitungRekomendasi(data, BESOK);
    expect(hasil.status).toBe("belum_cukup_data");
  });
});

// ---------------------------------------------------------------------------
// 3.3 / 3.9 / 3.10 — basis
// ---------------------------------------------------------------------------

describe("basis hari-sama (3.3, 3.9)", () => {
  it("memakai tiga kemunculan hari yang sama dan menamai aturannya hari_sama", () => {
    // Besok Rabu. Tiga Rabu terakhir: 7, 14, 21 hari lalu.
    const data = [
      catatan(21, 289),
      catatan(14, 294),
      catatan(7, 290),
      // Hari lain dengan konsumsi lebih rendah, supaya lantai tidak ikut campur.
      catatan(1, 200),
      catatan(2, 200),
      catatan(3, 200),
    ];

    const hasil = hitungRekomendasi(data, BESOK);
    if (hasil.status !== "siap") throw new Error("harus siap");

    expect(hasil.aturan).toBe("hari_sama");
    // (289 + 294 + 290) / 3 = 291
    expect(porsiKeStringRingkas(hasil.basis)).toBe("291");
    expect(hasil.basisDariHari).toHaveLength(3);
    expect(hasil.basisDariHari.map((h) => porsiKeStringRingkas(h.konsumsi))).toEqual([
      "289",
      "294",
      "290",
    ]);
  });

  it("memakai TIGA TERAKHIR bila kemunculannya lebih dari tiga", () => {
    /*
     * Empat Rabu ada di data, tapi yang ke-28 hari lalu di luar jendela 21 hari.
     * Ia tidak boleh ikut, dan angkanya sengaja ekstrem supaya kalau ikut,
     * tesnya gagal keras.
     */
    const data = [
      catatan(28, 900),
      catatan(21, 289),
      catatan(14, 294),
      catatan(7, 290),
      catatan(1, 200),
      catatan(2, 200),
      catatan(3, 200),
    ];

    const hasil = hitungRekomendasi(data, BESOK);
    if (hasil.status !== "siap") throw new Error("harus siap");

    expect(hasil.aturan).toBe("hari_sama");
    expect(porsiKeStringRingkas(hasil.basis)).toBe("291");
    expect(hasil.basisDariHari).toHaveLength(3);
  });

  it("setiap hari basis membawa id supaya angkanya bisa ditelusuri", () => {
    const rabu21 = catatan(21, 289);
    const rabu14 = catatan(14, 294);
    const rabu7 = catatan(7, 290);
    const data = [
      rabu21,
      rabu14,
      rabu7,
      catatan(1, 200),
      catatan(2, 200),
      catatan(3, 200),
    ];

    const hasil = hitungRekomendasi(data, BESOK);
    if (hasil.status !== "siap") throw new Error("harus siap");

    expect(hasil.basisDariHari.map((h) => h.catatanHarianId)).toEqual([
      rabu21.id,
      rabu14.id,
      rabu7.id,
    ]);
    // Hari basis di luar jendela 14 hari tetap masuk daftar yang bisa diklik.
    expect(hasil.catatanHarianIdDipakai).toContain(rabu21.id);
  });
});

describe("fallback rata umum (3.3, 3.10)", () => {
  it("memakai rata-rata seluruh D bila kemunculan hari-sama kurang dari tiga", () => {
    // Hanya dua Rabu (7 dan 14 hari lalu).
    const data = [
      catatan(14, 300),
      catatan(7, 300),
      catatan(1, 240),
      catatan(2, 240),
      catatan(3, 240),
    ];

    const hasil = hitungRekomendasi(data, BESOK);
    if (hasil.status !== "siap") throw new Error("harus siap");

    expect(hasil.aturan).toBe("rata_umum");
    // (300 + 300 + 240 + 240 + 240) / 5 = 264
    expect(porsiKeStringRingkas(hasil.basis)).toBe("264");
    expect(hasil.basisDariHari).toHaveLength(5);
  });

  it("jendela 21 hari TIDAK dipakai untuk basis rata umum", () => {
    /*
     * Jendela luas hanya melayani pencarian pola mingguan. Kalau ia bocor ke
     * rata_umum, hari ke-21 yang ekstrem akan menarik rata-rata dan lantai
     * keras — dan "rata-rata 14 hari terakhir" di kalimat alasan menjadi bohong.
     */
    const data = [catatan(20, 900), ...limaHariBiasa(240)];

    const hasil = hitungRekomendasi(data, BESOK);
    if (hasil.status !== "siap") throw new Error("harus siap");

    expect(hasil.aturan).toBe("rata_umum");
    expect(porsiKeStringRingkas(hasil.basis)).toBe("240");
    expect(porsiKeStringRingkas(hasil.lantaiKeras)).toBe("240");
    expect(hasil.jumlahData).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// 3.4 / 3.5 / 3.11 — lantai keras
// ---------------------------------------------------------------------------

describe("lantai keras (3.4, 3.5, 3.11)", () => {
  it("LANTAI MENANG: basis 291, lantai 296 -> rekomendasi 296", () => {
    const data = [
      catatan(21, 289),
      catatan(14, 294),
      catatan(7, 290),
      catatan(2, 296), // hari dengan konsumsi tertinggi
      catatan(3, 250),
      catatan(4, 250),
    ];

    const hasil = hitungRekomendasi(data, BESOK);
    if (hasil.status !== "siap") throw new Error("harus siap");

    expect(porsiKeStringRingkas(hasil.basis)).toBe("291");
    expect(porsiKeStringRingkas(hasil.lantaiKeras)).toBe("296");
    expect(porsiKeStringRingkas(hasil.rekomendasi)).toBe("296");
    expect(hasil.aturanMenang).toBe("lantai");
    // Aturan basis tetap tercatat apa adanya, bukan ditimpa oleh yang menang.
    expect(hasil.aturan).toBe("hari_sama");
  });

  it("menunjuk hari asal lantai, supaya angkanya bisa diklik", () => {
    const hariTertinggi = catatan(2, 296);
    const data = [
      catatan(21, 289),
      catatan(14, 294),
      catatan(7, 290),
      hariTertinggi,
      catatan(3, 250),
      catatan(1, 250),
    ];

    const hasil = hitungRekomendasi(data, BESOK);
    if (hasil.status !== "siap") throw new Error("harus siap");

    expect(hasil.lantaiDariHari.catatanHarianId).toBe(hariTertinggi.id);
    expect(porsiKeStringRingkas(hasil.lantaiDariHari.konsumsi)).toBe("296");
  });

  it("basis menang ketika ia di atas lantai", () => {
    const data = [
      // Angka besar ditaruh pada Rabu ke-21 yang ADA di jendela pola mingguan
      // tapi DI LUAR jendela 14 hari, supaya basis bisa berada di atas lantai.
      catatan(21, 400),
      catatan(14, 250),
      catatan(7, 250),
      catatan(1, 250),
      catatan(2, 250),
      catatan(3, 250),
    ];

    const hasil = hitungRekomendasi(data, BESOK);
    if (hasil.status !== "siap") throw new Error("harus siap");

    expect(porsiKeStringRingkas(hasil.rekomendasi)).toBe("300");
    expect(hasil.aturanMenang).toBe("hari_sama");
  });

  /*
   * TES PALING PENTING DI BERKAS INI.
   *
   * Lantai keras adalah janji: rekomendasi tidak pernah di bawah konsumsi
   * tertinggi 14 hari terakhir. Tes-tes di atas memeriksa beberapa contoh; yang
   * ini memeriksa SIFATNYA pada banyak bentuk data sekaligus, termasuk yang
   * tidak terpikir saat menulis contoh satu per satu.
   */
  it("rekomendasi TIDAK PERNAH di bawah lantai keras, pada 200 bentuk data acak", () => {
    let benih = 12345;
    const acak = (maks: number) => {
      benih = (benih * 1103515245 + 12345) & 0x7fffffff;
      return benih % maks;
    };

    for (let percobaan = 0; percobaan < 200; percobaan++) {
      const jumlahHari = 5 + acak(16);
      const data: CatatanUntukRekomendasi[] = [];
      for (let h = 1; h <= jumlahHari; h++) {
        data.push(catatan(h, 100 + acak(400)));
      }

      const hasil = hitungRekomendasi(data, BESOK);
      if (hasil.status !== "siap") continue;

      expect(hasil.rekomendasi).toBeGreaterThanOrEqual(hasil.lantaiKeras);
    }
  });
});

// ---------------------------------------------------------------------------
// 3.15 — tidak ada buffer
// ---------------------------------------------------------------------------

describe("tidak ada buffer di atas lantai (3.15)", () => {
  it("basis 300 dan lantai 250 -> rekomendasi TEPAT 300, bukan 309", () => {
    const data = [
      catatan(21, 400),
      catatan(14, 250),
      catatan(7, 250),
      catatan(1, 250),
      catatan(2, 250),
      catatan(3, 250),
    ];

    const hasil = hitungRekomendasi(data, BESOK);
    if (hasil.status !== "siap") throw new Error("harus siap");

    expect(porsiKeStringRingkas(hasil.basis)).toBe("300");
    expect(porsiKeStringRingkas(hasil.lantaiKeras)).toBe("250");
    expect(porsiKeStringRingkas(hasil.rekomendasi)).toBe("300");
    // 300 + 3% = 309. Kalau angka itu muncul, ada buffer yang diselipkan.
    expect(hasil.rekomendasi).toBe(porsiDariUtuh(300));
  });

  it("lantai menang tanpa tambahan apa pun di atasnya", () => {
    const data = [
      catatan(21, 200),
      catatan(14, 200),
      catatan(7, 200),
      catatan(1, 296),
      catatan(2, 250),
      catatan(3, 250),
    ];

    const hasil = hitungRekomendasi(data, BESOK);
    if (hasil.status !== "siap") throw new Error("harus siap");

    expect(hasil.rekomendasi).toBe(porsiDariUtuh(296));
  });
});

// ---------------------------------------------------------------------------
// 3.13 — anomali dikecualikan dari basis DAN lantai
// ---------------------------------------------------------------------------

describe("anomali dikecualikan dari basis DAN dari lantai (3.13)", () => {
  it("hari acara dengan konsumsi 500 tidak mengangkat lantai", () => {
    /*
     * Inti dari seluruh aturan ini: kalau 500 lolos ke lantai, rekomendasi 14
     * hari berikutnya terkunci di 500 dan dapur dipaksa memasak berlebih setiap
     * hari gara-gara satu hari istimewa.
     */
    const data = [
      catatan(3, 500, { isAnomali: true, alasanAnomali: "Acara haul" }),
      ...limaHariBiasa(280),
    ];

    const hasil = hitungRekomendasi(data, BESOK);
    if (hasil.status !== "siap") throw new Error("harus siap");

    expect(porsiKeStringRingkas(hasil.lantaiKeras)).toBe("280");
    expect(porsiKeStringRingkas(hasil.rekomendasi)).toBe("280");
    expect(hasil.rekomendasi).toBeLessThan(porsiDariUtuh(500));
  });

  it("hari anomali tidak masuk basis rata umum", () => {
    const data = [
      catatan(3, 500, { isAnomali: true, alasanAnomali: "Acara haul" }),
      ...limaHariBiasa(280),
    ];

    const hasil = hitungRekomendasi(data, BESOK);
    if (hasil.status !== "siap") throw new Error("harus siap");

    // Bila 500 ikut, rata-rata menjadi 316.67, bukan 280.
    expect(porsiKeStringRingkas(hasil.basis)).toBe("280");
    expect(hasil.jumlahData).toBe(5);
  });

  it("hari anomali tidak masuk basis hari-sama meski harinya cocok", () => {
    const data = [
      catatan(21, 289),
      catatan(14, 294),
      // Rabu 7 hari lalu ditandai anomali -> hanya dua Rabu tersisa -> rata_umum
      catatan(7, 500, { isAnomali: true, alasanAnomali: "Acara" }),
      catatan(1, 250),
      catatan(2, 250),
      catatan(3, 250),
      catatan(4, 250),
    ];

    const hasil = hitungRekomendasi(data, BESOK);
    if (hasil.status !== "siap") throw new Error("harus siap");

    expect(hasil.aturan).toBe("rata_umum");
    expect(hasil.basisDariHari.every((h) => h.konsumsi < porsiDariUtuh(500))).toBe(true);
  });

  it("mencatat jumlah dan alasan pengecualian", () => {
    const data = [
      catatan(3, 500, { isAnomali: true, alasanAnomali: "Acara haul" }),
      catatan(4, 480, { isAnomali: true, alasanAnomali: "Acara haul" }),
      ...limaHariBiasa(280),
    ];

    const hasil = hitungRekomendasi(data, BESOK);
    if (hasil.status !== "siap") throw new Error("harus siap");

    expect(hasil.jumlahDikecualikanAnomali).toBe(2);
    expect(hasil.alasanDikecualikan).toEqual(["Acara haul"]);
  });

  it("membedakan hari belum final dari hari anomali", () => {
    /*
     * Hari yang belum selesai dicatat bukan hari tak biasa. Menghitungnya
     * sebagai anomali akan membuat kalimat alasan menuduh hari yang sekadar
     * belum difinalisasi.
     */
    const data = [
      catatan(6, 280, { porsiTersisaFinal: null }),
      catatan(7, 500, { isAnomali: true, alasanAnomali: "Acara" }),
      ...limaHariBiasa(280),
    ];

    const hasil = hitungRekomendasi(data, BESOK);
    if (hasil.status !== "siap") throw new Error("harus siap");

    expect(hasil.jumlahBelumFinal).toBe(1);
    expect(hasil.jumlahDikecualikanAnomali).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 3.2 — jendela 14 hari
// ---------------------------------------------------------------------------

describe("jendela data (3.2)", () => {
  it("hari di luar 14 hari tidak masuk lantai keras", () => {
    const data = [catatan(20, 900), ...limaHariBiasa(280)];

    const hasil = hitungRekomendasi(data, BESOK);
    if (hasil.status !== "siap") throw new Error("harus siap");

    expect(porsiKeStringRingkas(hasil.lantaiKeras)).toBe("280");
  });

  it("hari tepat di tepi jendela masih ikut", () => {
    const tepi = catatan(PANJANG_JENDELA_HARI, 350);
    const hasil = hitungRekomendasi([tepi, ...limaHariBiasa(280)], BESOK);
    if (hasil.status !== "siap") throw new Error("harus siap");

    expect(porsiKeStringRingkas(hasil.lantaiKeras)).toBe("350");
    expect(hasil.jumlahData).toBe(6);
  });

  it("hari sesudah tepi jendela sudah tidak ikut", () => {
    const luar = catatan(PANJANG_JENDELA_HARI + 1, 350);
    const hasil = hitungRekomendasi([luar, ...limaHariBiasa(280)], BESOK);
    if (hasil.status !== "siap") throw new Error("harus siap");

    expect(porsiKeStringRingkas(hasil.lantaiKeras)).toBe("280");
    expect(hasil.jumlahData).toBe(5);
  });

  it("hari besok sendiri tidak pernah ikut", () => {
    const hasil = hitungRekomendasi([catatan(0, 900), ...limaHariBiasa(280)], BESOK);
    if (hasil.status !== "siap") throw new Error("harus siap");

    expect(hasil.jumlahData).toBe(5);
    expect(porsiKeStringRingkas(hasil.lantaiKeras)).toBe("280");
  });
});

// ---------------------------------------------------------------------------
// 3.7 / 3.14 — kalimat alasan
// ---------------------------------------------------------------------------

describe("kalimat alasan (3.7, 3.14)", () => {
  it("menyebut hari, angka yang dipakai, basis, lantai, dan aturan yang menang", () => {
    const data = [
      catatan(21, 289),
      catatan(14, 294),
      catatan(7, 290),
      catatan(2, 296),
      catatan(3, 250),
      catatan(4, 250),
      catatan(5, 500, { isAnomali: true, alasanAnomali: "Acara khusus" }),
    ];

    const hasil = hitungRekomendasi(data, BESOK);
    if (hasil.status !== "siap") throw new Error("harus siap");

    expect(hasil.kalimatAlasan).toBe(
      "Rabu tiga minggu terakhir terpakai 289, 294, 290 — rata-rata 291. " +
        "Konsumsi tertinggi dalam 14 hari: 296. " +
        "Kami sarankan 296, mengikuti angka tertinggi itu supaya tidak sampai kurang. " +
        "1 hari tidak dihitung karena ditandai acara khusus.",
    );
  });

  it("menyebut aturan rata umum saat hari-sama tidak cukup", () => {
    const data = [catatan(14, 300), catatan(7, 300), ...limaHariBiasa(240)];

    const hasil = hitungRekomendasi(data, BESOK);
    if (hasil.status !== "siap") throw new Error("harus siap");

    expect(hasil.kalimatAlasan).toContain("Belum ada tiga hari Rabu dalam data");
    expect(hasil.kalimatAlasan).toContain("hari terakhir");
  });

  it("tidak menyebut pengecualian bila tidak ada hari yang dikecualikan", () => {
    const hasil = hitungRekomendasi(limaHariBiasa(280), BESOK);
    if (hasil.status !== "siap") throw new Error("harus siap");

    expect(hasil.kalimatAlasan).not.toContain("tidak dihitung");
  });

  it("selalu menyebut lantai keras, bahkan ketika basis yang menang", () => {
    // Lantai wajib ditampilkan setiap kali (CLAUDE.md aturan 6).
    const data = [
      catatan(21, 400),
      catatan(14, 250),
      catatan(7, 250),
      catatan(1, 250),
      catatan(2, 250),
      catatan(3, 250),
    ];

    const hasil = hitungRekomendasi(data, BESOK);
    if (hasil.status !== "siap") throw new Error("harus siap");

    expect(hasil.kalimatAlasan).toContain("Konsumsi tertinggi dalam 14 hari: 250.");
    expect(hasil.kalimatAlasan).toContain(
      "di atas rata-rata dan tidak di bawah angka tertinggi",
    );
  });

  it("menggabungkan beberapa alasan anomali yang berbeda", () => {
    const data = [
      catatan(3, 500, { isAnomali: true, alasanAnomali: "Acara haul" }),
      catatan(4, 480, { isAnomali: true, alasanAnomali: "Libur nasional" }),
      ...limaHariBiasa(280),
    ];

    const hasil = hitungRekomendasi(data, BESOK);
    if (hasil.status !== "siap") throw new Error("harus siap");

    expect(hasil.kalimatAlasan).toContain(
      "2 hari tidak dihitung karena ditandai acara haul dan libur nasional.",
    );
  });

  it("tetap membentuk kalimat ketika alasan anomali tidak diisi", () => {
    const data = [catatan(3, 500, { isAnomali: true }), ...limaHariBiasa(280)];

    const hasil = hitungRekomendasi(data, BESOK);
    if (hasil.status !== "siap") throw new Error("harus siap");

    expect(hasil.kalimatAlasan).toContain(
      "1 hari tidak dihitung karena ditandai hari tidak biasa.",
    );
  });

  it("setiap angka di kalimat berasal dari hari yang bisa ditunjuk", () => {
    const data = [
      catatan(21, 289),
      catatan(14, 294),
      catatan(7, 290),
      catatan(2, 296),
      catatan(3, 250),
      catatan(1, 250),
    ];

    const hasil = hitungRekomendasi(data, BESOK);
    if (hasil.status !== "siap") throw new Error("harus siap");

    for (const hari of hasil.basisDariHari) {
      expect(hasil.kalimatAlasan).toContain(porsiKeStringRingkas(hari.konsumsi));
      expect(hasil.catatanHarianIdDipakai).toContain(hari.catatanHarianId);
    }
    expect(hasil.kalimatAlasan).toContain(porsiKeStringRingkas(hasil.lantaiKeras));
  });
});

// ---------------------------------------------------------------------------
// Pembulatan dan zona waktu
// ---------------------------------------------------------------------------

describe("pembulatan", () => {
  it("membulatkan basis KE ATAS ke porsi utuh", () => {
    // (280.50 + 280.50 + 280.50) / 3 = 280.50 -> ceil 281
    const data = [
      catatan(21, "280.50"),
      catatan(14, "280.50"),
      catatan(7, "280.50"),
      catatan(1, 200),
      catatan(2, 200),
      catatan(3, 200),
    ];

    const hasil = hitungRekomendasi(data, BESOK);
    if (hasil.status !== "siap") throw new Error("harus siap");

    // Nilai berdesimal tetap ditulis dua angka; hanya nilai bulat yang diringkas.
    expect(porsiKeStringRingkas(hasil.basis)).toBe("280.50");
    expect(porsiKeStringRingkas(hasil.rekomendasi)).toBe("281");
  });

  it("membulatkan lantai KE ATAS, tidak pernah ke bawah", () => {
    /*
     * Lantai 296.19 dibulatkan menjadi 297, bukan 296. Membulatkan ke bawah
     * berarti menyarankan angka di bawah konsumsi tertinggi yang pernah
     * terjadi — persis kekurangan yang lantai keras ada untuk mencegahnya.
     */
    const data = [catatan(1, "296.19"), ...[2, 3, 4, 5].map((h) => catatan(h, 200))];

    const hasil = hitungRekomendasi(data, BESOK);
    if (hasil.status !== "siap") throw new Error("harus siap");

    expect(porsiKeStringRingkas(hasil.lantaiKeras)).toBe("296.19");
    expect(porsiKeStringRingkas(hasil.rekomendasi)).toBe("297");
    expect(hasil.aturanMenang).toBe("lantai");
  });

  it("tidak kehilangan satu porsi karena pembulatan bertingkat", () => {
    /*
     * Rata-rata sebenarnya (290.01 + 290.01 + 290.02)/3 = 290.0133...
     * Kalau dibulatkan dulu ke perseratus (290.01) lalu di-ceil, hasilnya sama;
     * yang diuji di sini adalah bahwa ceil dihitung dari nilai sebenarnya dan
     * menghasilkan 291, bukan 290.
     */
    const data = [
      catatan(21, "290.01"),
      catatan(14, "290.01"),
      catatan(7, "290.02"),
      catatan(1, 200),
      catatan(2, 200),
      catatan(3, 200),
    ];

    const hasil = hitungRekomendasi(data, BESOK);
    if (hasil.status !== "siap") throw new Error("harus siap");

    expect(porsiKeStringRingkas(hasil.rekomendasi)).toBe("291");
  });
});

describe("zona waktu", () => {
  it("menentukan hari-dalam-minggu menurut UTC, bukan waktu lokal mesin", () => {
    /*
     * Tanggal dari kolom DATE tiba sebagai tengah malam UTC. Pada server di
     * sebelah barat UTC, `getDay()` lokal akan membaca hari SEBELUMNYA dan
     * basis hari-sama diam-diam membandingkan Rabu dengan Selasa. Tes ini
     * memakai tanggal tengah malam UTC persis — bentuk yang paling rentan.
     */
    const data = [
      catatan(21, 289),
      catatan(14, 294),
      catatan(7, 290),
      catatan(1, 200),
      catatan(2, 200),
      catatan(3, 200),
    ];

    for (const c of data) {
      expect(c.tanggal.toISOString()).toMatch(/T00:00:00\.000Z$/);
    }

    const hasil = hitungRekomendasi(data, BESOK);
    if (hasil.status !== "siap") throw new Error("harus siap");

    expect(hasil.aturan).toBe("hari_sama");
    expect(hasil.kalimatAlasan.startsWith("Rabu")).toBe(true);
  });

  it("hasilnya sama walau cap waktu punya komponen jam", () => {
    const dataUtc = [
      catatan(21, 289),
      catatan(14, 294),
      catatan(7, 290),
      catatan(1, 200),
      catatan(2, 200),
      catatan(3, 200),
    ];
    const dataBerjam = dataUtc.map((c) => ({
      ...c,
      tanggal: new Date(c.tanggal.getTime() + 17 * 3600 * 1000),
    }));

    const a = hitungRekomendasi(dataUtc, BESOK);
    const b = hitungRekomendasi(dataBerjam, BESOK);
    if (a.status !== "siap" || b.status !== "siap") throw new Error("harus siap");

    expect(b.aturan).toBe(a.aturan);
    expect(b.rekomendasi).toBe(a.rekomendasi);
    expect(b.lantaiKeras).toBe(a.lantaiKeras);
  });
});
