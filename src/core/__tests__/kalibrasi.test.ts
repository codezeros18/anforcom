import { describe, expect, it } from "vitest";
import {
  AMBANG_TERKALIBRASI,
  buatKalibrasiAwal,
  cariKonstanta,
  hitungPorsiTersisa,
  hitungRentang,
  jelaskanSumber,
  type KalibrasiTersimpan,
  type KonteksKalibrasi,
  perbaruiKalibrasi,
} from "../kalibrasi.ts";
import { fraksiDariString, fraksiDariPersen } from "../fraksi.ts";
import { porsiDariString, porsiDariUtuh, porsiKeStringRingkas } from "../porsi.ts";
import {
  GalatFraksiTidakSah,
  GalatKalibrasiTidakSah,
  KonstantaTidakDitemukan,
} from "../galat.ts";
import type { KategoriFisik } from "../tipe.ts";

// ---------------------------------------------------------------------------
// Bahan uji
// ---------------------------------------------------------------------------

function kalibrasi(
  wadahId: string,
  jenisMasakanId: string,
  porsiPenuh: number,
  ubah: Partial<KalibrasiTersimpan> = {},
): KalibrasiTersimpan {
  return {
    wadahId,
    jenisMasakanId,
    porsiPenuh: porsiDariUtuh(porsiPenuh),
    sumber: "deklarasi",
    jumlahKoreksi: 0,
    ...ubah,
  };
}

const JENIS_MASAKAN = [
  { id: "nasi", kategoriFisik: "padat_menggunung" as const },
  { id: "nasi-uduk", kategoriFisik: "padat_menggunung" as const },
  { id: "lauk", kategoriFisik: "padat_rata" as const },
  { id: "sayur", kategoriFisik: "berkuah" as const },
];

function konteks(kalibrasiList: KalibrasiTersimpan[]): KonteksKalibrasi {
  return { kalibrasi: kalibrasiList, jenisMasakan: JENIS_MASAKAN };
}

// ---------------------------------------------------------------------------
// 2.2 / 2.8 — rumus dasar
// ---------------------------------------------------------------------------

describe("hitungPorsiTersisa (2.2, 2.8)", () => {
  it("fraksi 0.5 x porsiPenuh 60 = 30", () => {
    const hasil = hitungPorsiTersisa(fraksiDariString("0.5"), porsiDariUtuh(60));
    expect(porsiKeStringRingkas(hasil)).toBe("30");
  });

  it("wadah penuh mengembalikan konstanta apa adanya", () => {
    const hasil = hitungPorsiTersisa(fraksiDariString("1"), porsiDariUtuh(120));
    expect(porsiKeStringRingkas(hasil)).toBe("120");
  });

  it("wadah kosong mengembalikan nol", () => {
    const hasil = hitungPorsiTersisa(fraksiDariString("0"), porsiDariUtuh(120));
    expect(porsiKeStringRingkas(hasil)).toBe("0");
  });

  it("menghitung fraksi empat desimal dengan tepat", () => {
    // 0.6250 x 120.00 = 75.00
    const hasil = hitungPorsiTersisa(fraksiDariString("0.6250"), porsiDariUtuh(120));
    expect(porsiKeStringRingkas(hasil)).toBe("75");
  });

  it("mempertahankan presisi pada konstanta berdesimal", () => {
    // 0.3333 x 90.50 = 30.16365 -> dibulatkan ke perseratus terdekat = 30.16
    const hasil = hitungPorsiTersisa(
      fraksiDariString("0.3333"),
      porsiDariString("90.50"),
    );
    expect(porsiKeStringRingkas(hasil)).toBe("30.16");
  });

  it("tidak melewati float — 0.35 x 100 tepat 35, bukan 35.000000000000004", () => {
    /*
     * `0.35 * 100` dalam aritmetika float menghasilkan 35.000000000000004.
     * Tes ini memastikan jalur perhitungan kita tidak pernah menyentuh nilai
     * seperti itu.
     */
    const hasil = hitungPorsiTersisa(fraksiDariString("0.35"), porsiDariUtuh(100));
    expect(porsiKeStringRingkas(hasil)).toBe("35");
  });

  it("menolak fraksi di luar 0..1", () => {
    // Wadah tidak bisa terisi 130%. Angka semacam itu biasanya berarti fraksi
    // tertukar dengan persen.
    expect(() => fraksiDariString("1.3")).toThrow(GalatFraksiTidakSah);
  });

  it("menolak konstanta negatif", () => {
    expect(() =>
      hitungPorsiTersisa(fraksiDariString("0.5"), porsiDariString("-10")),
    ).toThrow(GalatKalibrasiTidakSah);
  });
});

// ---------------------------------------------------------------------------
// 2.1 / 2.12 — mencari konstanta
// ---------------------------------------------------------------------------

describe("cariKonstanta (2.1, 2.12)", () => {
  it("mengembalikan konstanta yang cocok tepat, dengan perkiraan=false", () => {
    const k = konteks([
      kalibrasi("panci", "nasi", 180, { sumber: "terkalibrasi", jumlahKoreksi: 7 }),
    ]);

    const hasil = cariKonstanta(k, "panci", "nasi");

    expect(porsiKeStringRingkas(hasil.porsiPenuh)).toBe("180");
    expect(hasil.perkiraan).toBe(false);
    expect(hasil.sumber).toBe("terkalibrasi");
    expect(hasil.asal).toEqual({ wadahId: "panci", jenisMasakanId: "nasi" });
  });

  it("meminjam dari jenis masakan sekategori pada wadah yang sama, perkiraan=true", () => {
    // Belum ada kalibrasi panci x nasi-uduk, tapi panci x nasi ada dan keduanya
    // padat_menggunung.
    const k = konteks([kalibrasi("panci", "nasi", 180)]);

    const hasil = cariKonstanta(k, "panci", "nasi-uduk");

    expect(porsiKeStringRingkas(hasil.porsiPenuh)).toBe("180");
    expect(hasil.perkiraan).toBe(true);
    expect(hasil.asal.jenisMasakanId).toBe("nasi");
  });

  it("TIDAK meminjam dari kategori fisik yang berbeda", () => {
    // Panci hanya punya kalibrasi untuk sayur (berkuah); nasi menggunung tidak
    // boleh meminjam darinya — itu persis kesalahan sistematis yang kalibrasi
    // dua dimensi ada untuk mencegahnya.
    const k = konteks([kalibrasi("panci", "sayur", 150)]);

    expect(() => cariKonstanta(k, "panci", "nasi")).toThrow(KonstantaTidakDitemukan);
  });

  it("TIDAK meminjam dari wadah lain, meski kategorinya sama", () => {
    // Konstanta adalah sifat wadah itu. Meminjam dari panci lain akan mengarang
    // angka yang tidak ada hubungannya dengan wadah di depan operator.
    const k = konteks([kalibrasi("panci-besar", "nasi", 180)]);

    expect(() => cariKonstanta(k, "panci-kecil", "nasi")).toThrow(
      KonstantaTidakDitemukan,
    );
  });

  it("melempar KonstantaTidakDitemukan saat wadah belum terdaftar sama sekali", () => {
    expect(() => cariKonstanta(konteks([]), "wadah-asing", "nasi")).toThrow(
      KonstantaTidakDitemukan,
    );
  });

  it("error-nya membawa wadah dan jenis masakan yang diminta", () => {
    try {
      cariKonstanta(konteks([]), "wadah-asing", "nasi");
      throw new Error("seharusnya melempar");
    } catch (galat) {
      expect(galat).toBeInstanceOf(KonstantaTidakDitemukan);
      const k = galat as KonstantaTidakDitemukan;
      expect(k.wadahId).toBe("wadah-asing");
      expect(k.jenisMasakanId).toBe("nasi");
      expect(k.kode).toBe("KONSTANTA_TIDAK_DITEMUKAN");
    }
  });

  it("memilih kandidat terkalibrasi lebih dulu saat meminjam", () => {
    const k: KonteksKalibrasi = {
      jenisMasakan: [
        { id: "nasi", kategoriFisik: "padat_menggunung" },
        { id: "nasi-uduk", kategoriFisik: "padat_menggunung" },
        { id: "nasi-kuning", kategoriFisik: "padat_menggunung" },
      ],
      kalibrasi: [
        kalibrasi("panci", "nasi", 180, { sumber: "deklarasi", jumlahKoreksi: 0 }),
        kalibrasi("panci", "nasi-kuning", 200, {
          sumber: "terkalibrasi",
          jumlahKoreksi: 9,
        }),
      ],
    };

    const hasil = cariKonstanta(k, "panci", "nasi-uduk");

    expect(hasil.asal.jenisMasakanId).toBe("nasi-kuning");
    expect(porsiKeStringRingkas(hasil.porsiPenuh)).toBe("200");
  });

  it("hasil peminjaman deterministik, tidak bergantung urutan data masuk", () => {
    /*
     * Tanpa urutan yang ditetapkan, urutan baris dari basis data akan menentukan
     * angka yang dilihat operator — dan estimasi yang sama bisa berbeda antar
     * pemuatan halaman.
     */
    const daftar = [
      kalibrasi("panci", "nasi", 180, { jumlahKoreksi: 2 }),
      kalibrasi("panci", "nasi-kuning", 200, { jumlahKoreksi: 4 }),
    ];
    const jenis = [
      { id: "nasi", kategoriFisik: "padat_menggunung" as const },
      { id: "nasi-uduk", kategoriFisik: "padat_menggunung" as const },
      { id: "nasi-kuning", kategoriFisik: "padat_menggunung" as const },
    ];

    const majuA = cariKonstanta(
      { kalibrasi: daftar, jenisMasakan: jenis },
      "panci",
      "nasi-uduk",
    );
    const majuB = cariKonstanta(
      { kalibrasi: [...daftar].reverse(), jenisMasakan: jenis },
      "panci",
      "nasi-uduk",
    );

    expect(majuA.asal.jenisMasakanId).toBe(majuB.asal.jenisMasakanId);
    expect(majuA.porsiPenuh).toBe(majuB.porsiPenuh);
  });
});

// ---------------------------------------------------------------------------
// 2.3 / 2.14 — lebar rentang per kategori fisik
// ---------------------------------------------------------------------------

describe("hitungRentang — kategori fisik (2.3, 2.14)", () => {
  const dasar = {
    porsiEstimasi: porsiDariUtuh(100),
    perkiraan: false,
    isCampuran: false,
    sumber: "terkalibrasi" as const,
  };

  it("berkuah menghasilkan ±10%", () => {
    const r = hitungRentang({ ...dasar, kategoriFisik: "berkuah" });
    expect(porsiKeStringRingkas(r.bawah)).toBe("90");
    expect(porsiKeStringRingkas(r.atas)).toBe("110");
    expect(r.lebarPerseratusPersen).toBe(1000);
  });

  it("padat_rata menghasilkan ±20%", () => {
    const r = hitungRentang({ ...dasar, kategoriFisik: "padat_rata" });
    expect(porsiKeStringRingkas(r.bawah)).toBe("80");
    expect(porsiKeStringRingkas(r.atas)).toBe("120");
    expect(r.lebarPerseratusPersen).toBe(2000);
  });

  it("padat_menggunung menghasilkan ±35%", () => {
    const r = hitungRentang({ ...dasar, kategoriFisik: "padat_menggunung" });
    expect(porsiKeStringRingkas(r.bawah)).toBe("65");
    expect(porsiKeStringRingkas(r.atas)).toBe("135");
    expect(r.lebarPerseratusPersen).toBe(3500);
  });

  it("tiga kategori menghasilkan TIGA lebar yang berbeda (2.14)", () => {
    const lebar = (["berkuah", "padat_rata", "padat_menggunung"] as KategoriFisik[]).map(
      (kategoriFisik) => hitungRentang({ ...dasar, kategoriFisik }).lebarPerseratusPersen,
    );

    expect(new Set(lebar).size).toBe(3);
    // Urutannya mengikuti kesulitan membaca permukaan: kuah paling mudah.
    expect(lebar).toEqual([1000, 2000, 3500]);
    expect(lebar[0]).toBeLessThan(lebar[1]!);
    expect(lebar[1]).toBeLessThan(lebar[2]!);
  });
});

// ---------------------------------------------------------------------------
// 2.6 / 2.11 — cold start melebarkan rentang
// ---------------------------------------------------------------------------

describe("cold start (2.6, 2.11)", () => {
  it("kalibrasi awal memakai deklarasi operator dan belum punya koreksi", () => {
    const awal = buatKalibrasiAwal("panci", "nasi", porsiDariUtuh(180));

    expect(porsiKeStringRingkas(awal.porsiPenuh)).toBe("180");
    expect(awal.sumber).toBe("deklarasi");
    expect(awal.jumlahKoreksi).toBe(0);
  });

  it("menolak deklarasi nol atau negatif", () => {
    expect(() => buatKalibrasiAwal("panci", "nasi", porsiDariUtuh(0))).toThrow(
      GalatKalibrasiTidakSah,
    );
  });

  it("sumber deklarasi melebarkan rentang tepat 1.5x", () => {
    const terkalibrasi = hitungRentang({
      porsiEstimasi: porsiDariUtuh(100),
      kategoriFisik: "padat_rata",
      perkiraan: false,
      isCampuran: false,
      sumber: "terkalibrasi",
    });
    const deklarasi = hitungRentang({
      porsiEstimasi: porsiDariUtuh(100),
      kategoriFisik: "padat_rata",
      perkiraan: false,
      isCampuran: false,
      sumber: "deklarasi",
    });

    expect(terkalibrasi.lebarPerseratusPersen).toBe(2000); // ±20%
    expect(deklarasi.lebarPerseratusPersen).toBe(3000); // ±30%
    expect(deklarasi.lebarPerseratusPersen).toBe(
      (terkalibrasi.lebarPerseratusPersen * 3) / 2,
    );
    expect(porsiKeStringRingkas(deklarasi.bawah)).toBe("70");
    expect(porsiKeStringRingkas(deklarasi.atas)).toBe("130");
  });

  it("konstanta pinjaman juga melebarkan rentang 1.5x", () => {
    const r = hitungRentang({
      porsiEstimasi: porsiDariUtuh(100),
      kategoriFisik: "padat_rata",
      perkiraan: true,
      isCampuran: false,
      sumber: "terkalibrasi",
    });
    expect(r.lebarPerseratusPersen).toBe(3000);
  });

  it("pinjaman DAN deklarasi menumpuk: 20% x 1.5 x 1.5 = 45%", () => {
    /*
     * Keduanya menumpuk dengan sengaja. Konstanta pinjaman dari kalibrasi yang
     * belum teruji memang dua kali lebih tidak pasti daripada salah satunya
     * saja, dan rentang harus mengatakannya.
     */
    const r = hitungRentang({
      porsiEstimasi: porsiDariUtuh(100),
      kategoriFisik: "padat_rata",
      perkiraan: true,
      isCampuran: false,
      sumber: "deklarasi",
    });

    expect(r.lebarPerseratusPersen).toBe(4500);
    expect(porsiKeStringRingkas(r.bawah)).toBe("55");
    expect(porsiKeStringRingkas(r.atas)).toBe("145");
  });

  it("pelebaran pada padat_menggunung tetap eksak: 35% x 1.5 = 52.5%", () => {
    // 52.5% bukan persen bulat. Kalau lebar disimpan sebagai persen bilangan
    // bulat, angka ini akan terpotong menjadi 52% atau 53%.
    const r = hitungRentang({
      porsiEstimasi: porsiDariUtuh(100),
      kategoriFisik: "padat_menggunung",
      perkiraan: false,
      isCampuran: false,
      sumber: "deklarasi",
    });

    expect(r.lebarPerseratusPersen).toBe(5250);
    expect(porsiKeStringRingkas(r.bawah)).toBe("47.50");
    expect(porsiKeStringRingkas(r.atas)).toBe("152.50");
  });
});

// ---------------------------------------------------------------------------
// 2.7 / 2.13 — campuran
// ---------------------------------------------------------------------------

describe("campuran (2.7, 2.13)", () => {
  it("mengembalikan wajibManual=true dan rentang ±40%", () => {
    const r = hitungRentang({
      porsiEstimasi: porsiDariUtuh(100),
      kategoriFisik: "berkuah",
      perkiraan: false,
      isCampuran: true,
      sumber: "terkalibrasi",
    });

    expect(r.wajibManual).toBe(true);
    expect(r.lebarPerseratusPersen).toBe(4000);
    expect(porsiKeStringRingkas(r.bawah)).toBe("60");
    expect(porsiKeStringRingkas(r.atas)).toBe("140");
  });

  it("lebar campuran MENGGANTIKAN lebar kategori, bukan mengalikannya", () => {
    // Isi wadahnya memang bukan satu jenis, jadi kategori satu jenis tidak
    // berlaku. Ketiga kategori menghasilkan lebar campuran yang sama.
    const lebar = (["berkuah", "padat_rata", "padat_menggunung"] as KategoriFisik[]).map(
      (kategoriFisik) =>
        hitungRentang({
          porsiEstimasi: porsiDariUtuh(100),
          kategoriFisik,
          perkiraan: false,
          isCampuran: true,
          sumber: "terkalibrasi",
        }).lebarPerseratusPersen,
    );

    expect(new Set(lebar).size).toBe(1);
    expect(lebar[0]).toBe(4000);
  });

  it("wajibManual false untuk isi yang tidak campuran", () => {
    const r = hitungRentang({
      porsiEstimasi: porsiDariUtuh(100),
      kategoriFisik: "berkuah",
      perkiraan: false,
      isCampuran: false,
      sumber: "terkalibrasi",
    });
    expect(r.wajibManual).toBe(false);
  });

  it("batas bawah tidak pernah negatif meski rentangnya sangat lebar", () => {
    // Campuran + pinjaman + deklarasi = 40% x 1.5 x 1.5 = 90%.
    const r = hitungRentang({
      porsiEstimasi: porsiDariUtuh(10),
      kategoriFisik: "padat_menggunung",
      perkiraan: true,
      isCampuran: true,
      sumber: "deklarasi",
    });

    expect(r.lebarPerseratusPersen).toBe(9000);
    expect(porsiKeStringRingkas(r.bawah)).toBe("1");
    // "sisa antara -12 dan 60 porsi" bukan informasi.
    expect(r.bawah).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// 2.4 / 2.9 / 2.10 — pembaruan EWMA dengan pembatas
// ---------------------------------------------------------------------------

describe("perbaruiKalibrasi — EWMA (2.4, 2.9)", () => {
  it("menghitung konstanta teramati = porsiSesudah / fraksi", () => {
    // 30 porsi pada keterisian 0.5 berarti wadah penuh menampung 60.
    const hasil = perbaruiKalibrasi({
      konstantaLama: porsiDariUtuh(60),
      jumlahKoreksiLama: 0,
      sumberLama: "deklarasi",
      fraksiKeterisian: fraksiDariString("0.5"),
      porsiSesudah: porsiDariUtuh(30),
    });

    expect(porsiKeStringRingkas(hasil.konstantaTeramati)).toBe("60");
  });

  it("bergerak KE ARAH koreksi, tidak melompat ke sana", () => {
    /*
     * Dihitung tangan: teramati = 36 / 0.5 = 72.
     * mentah = 0.70 x 60 + 0.30 x 72 = 42 + 21.6 = 63.6
     * batas atas = 60 x 1.15 = 69 -> tidak menahan
     */
    const hasil = perbaruiKalibrasi({
      konstantaLama: porsiDariUtuh(60),
      jumlahKoreksiLama: 0,
      sumberLama: "deklarasi",
      fraksiKeterisian: fraksiDariString("0.5"),
      porsiSesudah: porsiDariUtuh(36),
    });

    expect(porsiKeStringRingkas(hasil.konstantaTeramati)).toBe("72");
    expect(porsiKeStringRingkas(hasil.porsiPenuh)).toBe("63.60");
    expect(hasil.dibatasi).toBe(false);

    // Ke arah yang benar, tapi tidak sampai ke nilai teramati.
    expect(hasil.porsiPenuh).toBeGreaterThan(porsiDariUtuh(60));
    expect(hasil.porsiPenuh).toBeLessThan(hasil.konstantaTeramati);
  });

  it("bergerak turun ketika koreksi menunjukkan konstanta lebih kecil", () => {
    /*
     * teramati = 24 / 0.5 = 48
     * mentah = 0.70 x 60 + 0.30 x 48 = 42 + 14.4 = 56.4
     * batas bawah = 60 x 0.85 = 51 -> tidak menahan
     */
    const hasil = perbaruiKalibrasi({
      konstantaLama: porsiDariUtuh(60),
      jumlahKoreksiLama: 0,
      sumberLama: "deklarasi",
      fraksiKeterisian: fraksiDariString("0.5"),
      porsiSesudah: porsiDariUtuh(24),
    });

    expect(porsiKeStringRingkas(hasil.porsiPenuh)).toBe("56.40");
    expect(hasil.dibatasi).toBe(false);
  });

  it("koreksi yang membenarkan konstanta tidak menggesernya", () => {
    const hasil = perbaruiKalibrasi({
      konstantaLama: porsiDariUtuh(60),
      jumlahKoreksiLama: 0,
      sumberLama: "deklarasi",
      fraksiKeterisian: fraksiDariString("0.5"),
      porsiSesudah: porsiDariUtuh(30),
    });
    expect(porsiKeStringRingkas(hasil.porsiPenuh)).toBe("60");
  });

  it("menolak pembaruan dari fraksi nol", () => {
    // Wadah yang terbaca kosong tidak memberi informasi apa pun tentang
    // kapasitasnya saat penuh, dan pembagiannya tidak terdefinisi.
    expect(() =>
      perbaruiKalibrasi({
        konstantaLama: porsiDariUtuh(60),
        jumlahKoreksiLama: 0,
        sumberLama: "deklarasi",
        fraksiKeterisian: fraksiDariString("0"),
        porsiSesudah: porsiDariUtuh(0),
      }),
    ).toThrow(GalatKalibrasiTidakSah);
  });
});

describe("perbaruiKalibrasi — pembatas 15% (2.10)", () => {
  it("CLAMP MENAHAN EKSTREM: konstanta 60, teramati 200 -> hasil <= 69", () => {
    /*
     * Ini tes terpenting di berkas ini.
     *
     * teramati = 100 / 0.5 = 200
     * mentah   = 0.70 x 60 + 0.30 x 200 = 42 + 60 = 102
     * batas atas = 60 x 1.15 = 69
     *
     * Tanpa pembatas, satu koreksi keliru melompatkan konstanta ke 102 dan
     * seluruh estimasi berikutnya ikut rusak.
     */
    const hasil = perbaruiKalibrasi({
      konstantaLama: porsiDariUtuh(60),
      jumlahKoreksiLama: 0,
      sumberLama: "deklarasi",
      fraksiKeterisian: fraksiDariString("0.5"),
      porsiSesudah: porsiDariUtuh(100),
    });

    expect(porsiKeStringRingkas(hasil.konstantaTeramati)).toBe("200");
    expect(porsiKeStringRingkas(hasil.konstantaSebelumPembatas)).toBe("102");
    expect(porsiKeStringRingkas(hasil.porsiPenuh)).toBe("69");
    expect(hasil.porsiPenuh).toBeLessThanOrEqual(porsiDariUtuh(69));
    expect(hasil.dibatasi).toBe(true);
  });

  it("clamp arah bawah: konstanta 60, teramati 5 -> hasil >= 51", () => {
    /*
     * teramati = 2.5 / 0.5 = 5
     * mentah   = 0.70 x 60 + 0.30 x 5 = 42 + 1.5 = 43.5
     * batas bawah = 60 x 0.85 = 51
     */
    const hasil = perbaruiKalibrasi({
      konstantaLama: porsiDariUtuh(60),
      jumlahKoreksiLama: 0,
      sumberLama: "deklarasi",
      fraksiKeterisian: fraksiDariString("0.5"),
      porsiSesudah: porsiDariString("2.50"),
    });

    expect(porsiKeStringRingkas(hasil.konstantaTeramati)).toBe("5");
    expect(porsiKeStringRingkas(hasil.konstantaSebelumPembatas)).toBe("43.50");
    expect(porsiKeStringRingkas(hasil.porsiPenuh)).toBe("51");
    expect(hasil.porsiPenuh).toBeGreaterThanOrEqual(porsiDariUtuh(51));
    expect(hasil.dibatasi).toBe(true);
  });

  it("menandai `dibatasi` supaya riwayat koreksi bisa menjelaskannya", () => {
    // Tanpa penanda ini, koreksi besar akan terasa diabaikan sistem.
    const ditahan = perbaruiKalibrasi({
      konstantaLama: porsiDariUtuh(60),
      jumlahKoreksiLama: 0,
      sumberLama: "deklarasi",
      fraksiKeterisian: fraksiDariString("0.5"),
      porsiSesudah: porsiDariUtuh(100),
    });
    const tidakDitahan = perbaruiKalibrasi({
      konstantaLama: porsiDariUtuh(60),
      jumlahKoreksiLama: 0,
      sumberLama: "deklarasi",
      fraksiKeterisian: fraksiDariString("0.5"),
      porsiSesudah: porsiDariUtuh(31),
    });

    expect(ditahan.dibatasi).toBe(true);
    expect(tidakDitahan.dibatasi).toBe(false);
  });

  it("koreksi ekstrem berulang tetap butuh banyak langkah, tidak melompat", () => {
    /*
     * Pembatas tidak menghalangi konstanta yang memang salah untuk membaik — ia
     * hanya memaksa perbaikannya butuh beberapa koreksi. Setelah lima koreksi
     * ekstrem berturut-turut, konstanta masih jauh dari 200.
     */
    let konstanta = porsiDariUtuh(60);
    for (let i = 0; i < 5; i++) {
      konstanta = perbaruiKalibrasi({
        konstantaLama: konstanta,
        jumlahKoreksiLama: i,
        sumberLama: "deklarasi",
        fraksiKeterisian: fraksiDariString("0.5"),
        porsiSesudah: porsiDariUtuh(100),
      }).porsiPenuh;
    }

    // 60 x 1.15^5 = 120.68...
    expect(porsiKeStringRingkas(konstanta)).toBe("120.68");
    expect(konstanta).toBeLessThan(porsiDariUtuh(200));
  });
});

// ---------------------------------------------------------------------------
// 2.5 — transisi sumber
// ---------------------------------------------------------------------------

describe("transisi sumber deklarasi -> terkalibrasi (2.5)", () => {
  function koreksiKe(nomor: number) {
    return perbaruiKalibrasi({
      konstantaLama: porsiDariUtuh(60),
      jumlahKoreksiLama: nomor - 1,
      sumberLama: "deklarasi",
      fraksiKeterisian: fraksiDariString("0.5"),
      porsiSesudah: porsiDariUtuh(30),
    });
  }

  it("masih deklarasi sampai koreksi ke-4", () => {
    for (let n = 1; n <= AMBANG_TERKALIBRASI - 1; n++) {
      const hasil = koreksiKe(n);
      expect(hasil.jumlahKoreksi).toBe(n);
      expect(hasil.sumber).toBe("deklarasi");
    }
  });

  it("berubah menjadi terkalibrasi TEPAT pada koreksi ke-5", () => {
    const hasil = koreksiKe(AMBANG_TERKALIBRASI);
    expect(hasil.jumlahKoreksi).toBe(5);
    expect(hasil.sumber).toBe("terkalibrasi");
  });

  it("tetap terkalibrasi pada koreksi berikutnya", () => {
    const hasil = koreksiKe(AMBANG_TERKALIBRASI + 3);
    expect(hasil.sumber).toBe("terkalibrasi");
  });

  it("transisinya satu arah — terkalibrasi tidak pernah kembali ke deklarasi", () => {
    const hasil = perbaruiKalibrasi({
      konstantaLama: porsiDariUtuh(60),
      jumlahKoreksiLama: 0,
      sumberLama: "terkalibrasi",
      fraksiKeterisian: fraksiDariString("0.5"),
      porsiSesudah: porsiDariUtuh(30),
    });
    expect(hasil.jumlahKoreksi).toBe(1);
    expect(hasil.sumber).toBe("terkalibrasi");
  });

  it("rentang menyempit setelah konstanta terkalibrasi", () => {
    /*
     * Inilah yang dirasakan operator dari seluruh mekanisme ini: angka menjadi
     * lebih tajam seiring dia mengoreksi.
     */
    const sebelum = hitungRentang({
      porsiEstimasi: porsiDariUtuh(100),
      kategoriFisik: "padat_rata",
      perkiraan: false,
      isCampuran: false,
      sumber: "deklarasi",
    });
    const sesudah = hitungRentang({
      porsiEstimasi: porsiDariUtuh(100),
      kategoriFisik: "padat_rata",
      perkiraan: false,
      isCampuran: false,
      sumber: "terkalibrasi",
    });

    expect(sesudah.lebarPerseratusPersen).toBeLessThan(sebelum.lebarPerseratusPersen);
  });
});

// ---------------------------------------------------------------------------
// Badge sumber di layar
// ---------------------------------------------------------------------------

describe("jelaskanSumber", () => {
  it("menjelaskan keadaan awal tanpa kata yang menghakimi", () => {
    const teks = jelaskanSumber("deklarasi", 0);
    expect(teks).toBe(
      "Belum terkalibrasi — angka akan membaik setelah beberapa koreksi.",
    );
    // CLAUDE.md bagian 5: tidak ada kata yang menghakimi untuk data dapur.
    expect(teks).not.toMatch(/salah|buruk|tidak akurat|gagal/i);
  });

  it("menyebut sisa koreksi yang dibutuhkan", () => {
    expect(jelaskanSumber("deklarasi", 3)).toContain("2 koreksi lagi");
  });

  it("menyebut jumlah koreksi setelah terkalibrasi", () => {
    expect(jelaskanSumber("terkalibrasi", 7)).toBe("Sudah terkalibrasi dari 7 koreksi.");
  });
});

// ---------------------------------------------------------------------------
// Alur menyeluruh
// ---------------------------------------------------------------------------

describe("alur kalibrasi dari pendaftaran sampai terkalibrasi", () => {
  it("konstanta membaik dan rentang menyempit setelah lima koreksi", () => {
    /*
     * Cerita yang diuji: operator mendeklarasikan panci menampung 60 porsi nasi.
     * Kenyataannya sekitar 72. Setelah lima koreksi, konstanta mendekati
     * kenyataan dan badge berubah menjadi terkalibrasi.
     */
    let kal = buatKalibrasiAwal("panci", "nasi", porsiDariUtuh(60));
    expect(kal.sumber).toBe("deklarasi");

    for (let i = 0; i < AMBANG_TERKALIBRASI; i++) {
      const hasil = perbaruiKalibrasi({
        konstantaLama: kal.porsiPenuh,
        jumlahKoreksiLama: kal.jumlahKoreksi,
        sumberLama: kal.sumber,
        fraksiKeterisian: fraksiDariPersen(50),
        porsiSesudah: porsiDariUtuh(36), // menyiratkan konstanta 72
      });
      kal = {
        ...kal,
        porsiPenuh: hasil.porsiPenuh,
        sumber: hasil.sumber,
        jumlahKoreksi: hasil.jumlahKoreksi,
      };
    }

    expect(kal.sumber).toBe("terkalibrasi");
    expect(kal.jumlahKoreksi).toBe(5);
    // Bergerak dari 60 ke arah 72, tanpa pernah melewatinya.
    expect(kal.porsiPenuh).toBeGreaterThan(porsiDariUtuh(69));
    expect(kal.porsiPenuh).toBeLessThanOrEqual(porsiDariUtuh(72));

    const estimasi = hitungPorsiTersisa(fraksiDariPersen(50), kal.porsiPenuh);
    const rentang = hitungRentang({
      porsiEstimasi: estimasi,
      kategoriFisik: "padat_menggunung",
      perkiraan: false,
      isCampuran: false,
      sumber: kal.sumber,
    });

    expect(rentang.lebarPerseratusPersen).toBe(3500); // tidak lagi dilebarkan
    expect(rentang.wajibManual).toBe(false);
  });
});
