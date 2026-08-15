import { describe, expect, it } from "vitest";
import {
  bolehTampilPublik,
  keDapurPublik,
  type DapurUntukSerialisasi,
} from "../serialisasi-publik";

const NAMA_ASLI = "Dapur Pesantren Al-Hikmah";
const LABEL = "Dapur Pesantren di Kabupaten Bogor";

function dapurContoh(ubah: Partial<DapurUntukSerialisasi> = {}): DapurUntukSerialisasi {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    nama: NAMA_ASLI,
    labelAnonim: LABEL,
    modeAnonim: false,
    kecamatan: "Ciomas",
    jenis: "pesantren",
    biayaBahanPerPorsiMin: "4500.00",
    biayaBahanPerPorsiMaks: "6200.00",
    izinTampilPublik: true,
    izinBerlakuSampai: null,
    isContoh: false,
    ...ubah,
  };
}

describe("keDapurPublik — mode anonim mati", () => {
  it("memakai nama asli", () => {
    const hasil = keDapurPublik(dapurContoh({ modeAnonim: false }));
    expect(hasil.nama).toBe(NAMA_ASLI);
    expect(hasil.anonim).toBe(false);
  });
});

describe("keDapurPublik — mode anonim hidup", () => {
  it("mengganti nama dengan label anonim", () => {
    const hasil = keDapurPublik(dapurContoh({ modeAnonim: true }));
    expect(hasil.nama).toBe(LABEL);
    expect(hasil.anonim).toBe(true);
  });

  /*
   * Ini tes terpenting di berkas ini.
   *
   * Tidak cukup memeriksa bahwa field `nama` sudah benar — yang harus dijamin
   * adalah nama asli tidak muncul di JALUR KELUARAN MANA PUN. Kalau suatu hari
   * ada yang menambah field baru ke `DapurPublik` dan lupa menyaringnya, tes
   * di atas tetap hijau sementara identitas dapur bocor lewat field baru itu.
   *
   * Karena itu seluruh keluaran diserialisasi menjadi teks dan diperiksa
   * sebagai satu kesatuan.
   */
  it("tidak membocorkan nama asli di seluruh keluaran, bukan hanya di field nama", () => {
    const hasil = keDapurPublik(dapurContoh({ modeAnonim: true }));
    const seluruhKeluaran = JSON.stringify(hasil);

    expect(seluruhKeluaran).not.toContain(NAMA_ASLI);
    expect(seluruhKeluaran).not.toContain("Al-Hikmah");
  });

  it("tidak membawa labelAnonim maupun modeAnonim sebagai field mentah", () => {
    const hasil = keDapurPublik(dapurContoh({ modeAnonim: true }));

    // Bentuk publik hanya boleh punya `nama` yang sudah diselesaikan. Kalau
    // `labelAnonim` ikut terbawa, kode di hilir bisa memilih field yang salah.
    expect(Object.keys(hasil).sort()).toEqual(
      [
        "anonim",
        "biayaBahanPerPorsiMaks",
        "biayaBahanPerPorsiMin",
        "id",
        "isContoh",
        "jenis",
        "kecamatan",
        "nama",
      ].sort(),
    );
  });

  it("jatuh ke label cadangan bila labelAnonim kosong, TIDAK ke nama asli", () => {
    const kosong = keDapurPublik(dapurContoh({ modeAnonim: true, labelAnonim: "" }));
    const spasiSaja = keDapurPublik(
      dapurContoh({ modeAnonim: true, labelAnonim: "   " }),
    );

    expect(kosong.nama).not.toBe(NAMA_ASLI);
    expect(kosong.nama).toBe("Dapur (nama disamarkan)");
    expect(spasiSaja.nama).toBe("Dapur (nama disamarkan)");
    expect(JSON.stringify([kosong, spasiSaja])).not.toContain(NAMA_ASLI);
  });
});

describe("keDapurPublik — presisi uang", () => {
  /*
   * Uang tidak pernah melewati float (CLAUDE.md aturan 3). Serialisasi adalah
   * tempat paling mudah untuk melanggarnya tanpa sadar, karena `Number()`
   * terlihat wajar saat menyiapkan data untuk JSON.
   */
  it("mengembalikan uang sebagai string, bukan number", () => {
    const hasil = keDapurPublik(dapurContoh());

    expect(typeof hasil.biayaBahanPerPorsiMin).toBe("string");
    expect(typeof hasil.biayaBahanPerPorsiMaks).toBe("string");
    expect(hasil.biayaBahanPerPorsiMin).toBe("4500.00");
  });

  it("mempertahankan nol di belakang koma", () => {
    // 4500.00 menjadi 4500 kalau sempat melewati number. Dua desimal itu bagian
    // dari kontrak DECIMAL(12,2), bukan hiasan tampilan.
    const hasil = keDapurPublik(dapurContoh({ biayaBahanPerPorsiMin: "4500.00" }));
    expect(hasil.biayaBahanPerPorsiMin).toBe("4500.00");
  });

  it("menerima objek bergaya Prisma.Decimal", () => {
    const desimalPalsu = { toString: () => "7250.50" };
    const hasil = keDapurPublik(dapurContoh({ biayaBahanPerPorsiMin: desimalPalsu }));
    expect(hasil.biayaBahanPerPorsiMin).toBe("7250.50");
  });
});

describe("keDapurPublik — penanda dapur contoh", () => {
  it("meneruskan isContoh supaya UI bisa menampilkan badge", () => {
    expect(keDapurPublik(dapurContoh({ isContoh: true })).isContoh).toBe(true);
    expect(keDapurPublik(dapurContoh({ isContoh: false })).isContoh).toBe(false);
  });
});

describe("bolehTampilPublik", () => {
  it("menolak dapur tanpa izin tampil", () => {
    expect(bolehTampilPublik({ izinTampilPublik: false, izinBerlakuSampai: null })).toBe(
      false,
    );
  });

  it("mengizinkan dapur berizin tanpa masa berlaku", () => {
    expect(bolehTampilPublik({ izinTampilPublik: true, izinBerlakuSampai: null })).toBe(
      true,
    );
  });

  it("mengizinkan sepanjang hari terakhir masa berlaku", () => {
    // Izin sampai 30 September berarti 30 September masih boleh — bukan berhenti
    // pada tengah malam awal hari itu.
    const berlakuSampai = new Date("2026-09-30T00:00:00.000Z");
    const sianganHariTerakhir = new Date("2026-09-30T14:00:00.000Z");

    expect(
      bolehTampilPublik(
        { izinTampilPublik: true, izinBerlakuSampai: berlakuSampai },
        sianganHariTerakhir,
      ),
    ).toBe(true);
  });

  it("menolak setelah masa berlaku lewat", () => {
    const berlakuSampai = new Date("2026-09-30T00:00:00.000Z");
    const keesokanHarinya = new Date("2026-10-01T00:00:01.000Z");

    expect(
      bolehTampilPublik(
        { izinTampilPublik: true, izinBerlakuSampai: berlakuSampai },
        keesokanHarinya,
      ),
    ).toBe(false);
  });

  it("izin kedaluwarsa sama artinya dengan tidak ada izin", () => {
    const lama = new Date("2020-01-01T00:00:00.000Z");
    expect(
      bolehTampilPublik(
        { izinTampilPublik: true, izinBerlakuSampai: lama },
        new Date("2026-08-15T00:00:00.000Z"),
      ),
    ).toBe(false);
  });
});
