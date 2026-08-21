import { beforeEach, describe, expect, it } from "vitest";
import {
  bacaDraf,
  drafUntukTanggal,
  hapusDraf,
  KUNCI_DRAF,
  simpanDraf,
  UMUR_DRAF_MAKS_JAM,
  type PenyimpananSederhana,
} from "../draf-lokal";

/*
 * DRAF LOKAL — 9.1, 9.2, 9.19.
 *
 * Yang diuji di sini bukan "apakah fungsi menyimpan dan membaca". Yang diuji
 * adalah perilakunya pada keadaan yang justru membuat operator kehilangan data:
 * penyimpanan penuh, isi yang rusak, draf basi, dan draf untuk tanggal lain.
 *
 * Keempatnya nyata di lapangan, dan tiga di antaranya menghasilkan kerusakan
 * yang lebih parah daripada sekadar kehilangan ketikan — draf untuk tanggal
 * lain yang dipulihkan diam-diam akan mencatat angka hari kemarin sebagai hari
 * ini, dan tidak ada yang akan tahu.
 */

/** Penyimpanan palsu yang berperilaku seperti `localStorage`. */
function buatPenyimpanan(): PenyimpananSederhana & { isi: Map<string, string> } {
  const isi = new Map<string, string>();
  return {
    isi,
    getItem: (k) => isi.get(k) ?? null,
    setItem: (k, v) => {
      isi.set(k, v);
    },
    removeItem: (k) => {
      isi.delete(k);
    },
  };
}

/** Penyimpanan yang selalu menolak — mode penyamaran, atau kuota habis. */
const penyimpananRusak: PenyimpananSederhana = {
  getItem: () => {
    throw new Error("akses ditolak");
  },
  setItem: () => {
    throw new Error("kuota habis");
  },
  removeItem: () => {
    throw new Error("akses ditolak");
  },
};

const DRAF = {
  tanggal: "2026-08-21",
  porsiDimasak: "120.50",
  dicatatMundur: false,
  pernahGagalKirim: false,
};

let penyimpanan: ReturnType<typeof buatPenyimpanan>;

beforeEach(() => {
  penyimpanan = buatPenyimpanan();
});

describe("9.2 — draf tersimpan dan bisa dipulihkan", () => {
  it("draf yang baru disimpan bisa dibaca kembali utuh", () => {
    simpanDraf(penyimpanan, DRAF);
    const kembali = bacaDraf(penyimpanan);

    expect(kembali?.porsiDimasak).toBe("120.50");
    expect(kembali?.tanggal).toBe("2026-08-21");
    expect(kembali?.pernahGagalKirim).toBe(false);
  });

  it("tidak ada draf berarti null, bukan lemparan", () => {
    expect(bacaDraf(penyimpanan)).toBeNull();
  });

  it("draf terhapus sesudah dibuang", () => {
    simpanDraf(penyimpanan, DRAF);
    hapusDraf(penyimpanan);
    expect(bacaDraf(penyimpanan)).toBeNull();
  });
});

describe("9.1 — penanda belum terkirim", () => {
  it("draf yang gagal kirim membawa penandanya", () => {
    simpanDraf(penyimpanan, { ...DRAF, pernahGagalKirim: true });
    expect(bacaDraf(penyimpanan)?.pernahGagalKirim).toBe(true);
  });
});

describe("draf yang TIDAK BOLEH dipulihkan", () => {
  it("isi yang rusak diperlakukan seperti tidak ada draf", () => {
    /*
     * `localStorage` bisa berisi apa saja — versi aplikasi lama, ekstensi
     * peramban, atau tangan pengguna sendiri. Draf yang tidak bisa diurai
     * TIDAK BOLEH menjatuhkan layar yang mencoba membacanya.
     */
    penyimpanan.isi.set(KUNCI_DRAF, "{bukan json");
    expect(bacaDraf(penyimpanan)).toBeNull();
  });

  it("bentuk yang salah ditolak walau JSON-nya sah", () => {
    penyimpanan.isi.set(KUNCI_DRAF, JSON.stringify({ porsiDimasak: 120 }));
    expect(bacaDraf(penyimpanan)).toBeNull();
  });

  it("tanggal berformat aneh ditolak", () => {
    penyimpanan.isi.set(
      KUNCI_DRAF,
      JSON.stringify({
        ...DRAF,
        tanggal: "kemarin",
        disimpanPada: new Date().toISOString(),
      }),
    );
    expect(bacaDraf(penyimpanan)).toBeNull();
  });

  it("draf yang lebih tua dari batas umur dibuang diam-diam", () => {
    /*
     * Menawarkan angka porsi dari kemarin lebih berbahaya daripada tidak
     * menawarkan apa-apa: operator yang menerimanya begitu saja akan mencatat
     * angka hari lain sebagai hari ini.
     */
    const lama = new Date("2026-08-21T00:00:00.000Z");
    simpanDraf(penyimpanan, DRAF, lama);

    const sesudahBatas = new Date(lama.getTime() + (UMUR_DRAF_MAKS_JAM + 1) * 3_600_000);
    expect(bacaDraf(penyimpanan, sesudahBatas)).toBeNull();
  });

  it("draf yang masih dalam batas umur tetap ditawarkan", () => {
    const lama = new Date("2026-08-21T00:00:00.000Z");
    simpanDraf(penyimpanan, DRAF, lama);

    const masihMuda = new Date(lama.getTime() + (UMUR_DRAF_MAKS_JAM - 1) * 3_600_000);
    expect(bacaDraf(penyimpanan, masihMuda)).not.toBeNull();
  });

  it("draf untuk tanggal LAIN tidak pernah ditawarkan", () => {
    /*
     * Ini kesalahan yang paling mahal dari seluruh berkas ini. Draf kemarin
     * yang dipulihkan ke layar hari ini akan tersimpan sebagai angka hari ini,
     * dan sesudah itu tidak ada jejak bahwa angkanya berasal dari hari lain.
     */
    simpanDraf(penyimpanan, DRAF);
    const draf = bacaDraf(penyimpanan);

    expect(drafUntukTanggal(draf, "2026-08-21")).not.toBeNull();
    expect(drafUntukTanggal(draf, "2026-08-22")).toBeNull();
  });
});

describe("penyimpanan yang gagal TIDAK menjatuhkan alur utama", () => {
  it("simpan yang gagal tidak melempar", () => {
    /*
     * Draf lokal adalah JARING PENGAMAN. Kalau jaringnya sendiri gagal —
     * kuota habis, mode penyamaran — alur pengiriman utama tetap harus jalan.
     * Melempar di sini berarti jaring pengaman justru menjatuhkan orangnya.
     */
    expect(() => {
      simpanDraf(penyimpananRusak, DRAF);
    }).not.toThrow();
  });

  it("baca yang gagal menghasilkan null, bukan lemparan", () => {
    expect(() => bacaDraf(penyimpananRusak)).not.toThrow();
    expect(bacaDraf(penyimpananRusak)).toBeNull();
  });

  it("hapus yang gagal tidak melempar", () => {
    expect(() => {
      hapusDraf(penyimpananRusak);
    }).not.toThrow();
  });
});

describe("BATAS CAKUPAN — ini bukan mesin sinkronisasi (larangan Tingkat 3)", () => {
  it("hanya SATU draf yang disimpan, bukan antrean", () => {
    /*
     * Antrean banyak operasi memerlukan urutan kausal (estimasi butuh id
     * catatan yang belum ada), dan begitu itu masuk, yang terbangun adalah
     * mesin sinkronisasi offline — Tingkat 3, dilarang selamanya.
     *
     * Tes ini menjaga batas itu: draf kedua MENIMPA yang pertama.
     */
    simpanDraf(penyimpanan, DRAF);
    simpanDraf(penyimpanan, { ...DRAF, porsiDimasak: "88" });

    expect(penyimpanan.isi.size).toBe(1);
    expect(bacaDraf(penyimpanan)?.porsiDimasak).toBe("88");
  });
});
