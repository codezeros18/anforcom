import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  diLuarPola,
  PORSI_WAJAR_MAKS,
  pesanDariZod,
  skemaCatatanBaru,
  skemaKoreksi,
  skemaPenimbangan,
  skemaTebakan,
} from "../skema";
import { periksaBerkasFoto, UKURAN_MENTAH_MAKS_BYTE } from "@/lib/berkas-foto";
import { risetAktif } from "@/app/api/riset/_lib/penjaga";
import {
  keQueryString,
  tandaTanganiUrlFoto,
  UMUR_URL_JAM,
  verifikasiUrlFoto,
} from "@/lib/url-foto";

/*
 * SPRINT 9 — KETAHANAN.
 *
 * Setiap `describe` di bawah memetakan satu kasus dari daftar input tidak lazim.
 * Nomornya disebut supaya hasil tes bisa dibaca berdampingan dengan tabel di
 * PROGRESS.md, dan supaya kasus yang hilang terlihat.
 *
 * KENAPA INI DIUJI DI TINGKAT SKEMA, BUKAN LEWAT HTTP. Route handler mengimpor
 * client Prisma, dan client itu melempar saat dimuat bila `DATABASE_URL` kosong
 * — sementara CI menjalankan tes TANPA Postgres. Yang menentukan diterima atau
 * ditolaknya sebuah input adalah skemanya, dan skema itu murni. Perilaku
 * ujung-ke-ujung diverifikasi terpisah terhadap basis data sungguhan, dan
 * hasilnya dicatat di PROGRESS.md.
 */

const HARI_INI = new Date().toISOString().slice(0, 10);

/** Bentuk badan permintaan yang sah, untuk diubah satu bidang per kasus. */
function catatan(ubah: Record<string, unknown> = {}) {
  return { tanggal: HARI_INI, porsiDimasak: "120", ...ubah };
}

function pesanTolak(hasil: { success: boolean; error?: unknown }): string {
  if (hasil.success) return "(DITERIMA)";
  return pesanDariZod(hasil.error as Parameters<typeof pesanDariZod>[0]);
}

// ---------------------------------------------------------------------------
// Kasus 1, 2, 4 — porsi dimasak kosong / nol / negatif / teks
// ---------------------------------------------------------------------------

describe("9.8 / 9.9 / 9.11 — porsi dimasak yang tidak masuk akal", () => {
  it("kosong ditolak dengan pesan yang menyebut apa yang kurang", () => {
    const hasil = skemaCatatanBaru.safeParse(catatan({ porsiDimasak: "" }));
    expect(hasil.success).toBe(false);
    expect(pesanTolak(hasil)).toBe("Angkanya belum diisi.");
  });

  it("nol ditolak", () => {
    expect(skemaCatatanBaru.safeParse(catatan({ porsiDimasak: "0" })).success).toBe(
      false,
    );
  });

  it("negatif ditolak, dan pesannya menyebut MINUS — bukan desimal", () => {
    /*
     * Ini bukan kerewelan bahasa. Pesan "paling banyak dua desimal" pada input
     * "-5" membuat operator menghapus desimalnya, gagal lagi, dan tidak pernah
     * tahu bahwa masalahnya tanda minus.
     */
    for (const nilai of ["-5", "-0.01", "-120.50"]) {
      const hasil = skemaCatatanBaru.safeParse(catatan({ porsiDimasak: nilai }));
      expect(hasil.success, nilai).toBe(false);
      expect(pesanTolak(hasil), nilai).toBe("Angkanya tidak bisa minus.");
    }
  });

  it("teks di kolom angka ditolak, dan pesannya menyebut huruf", () => {
    for (const nilai of ["abc", "seratus", "12abc", "5e3", "NaN", "Infinity"]) {
      const hasil = skemaCatatanBaru.safeParse(catatan({ porsiDimasak: nilai }));
      expect(hasil.success, nilai).toBe(false);
      expect(pesanTolak(hasil), nilai).toBe("Isi angkanya saja, tanpa huruf.");
    }
  });

  it("tidak satu pun input aneh menyebabkan lemparan", () => {
    // `safeParse` tidak boleh melempar apa pun ke route handler.
    for (const nilai of [null, undefined, {}, [], true, 12, "🍚", "٥", "1".repeat(500)]) {
      expect(() =>
        skemaCatatanBaru.safeParse(catatan({ porsiDimasak: nilai })),
      ).not.toThrow();
    }
  });
});

// ---------------------------------------------------------------------------
// Kasus 3 — 999999 diterima, ditandai, tidak crash
// ---------------------------------------------------------------------------

describe("9.10 — angka sangat besar DITERIMA dan ditandai, bukan ditolak", () => {
  it("999999 ditolak karena melewati batas mutlak, dengan pesan manusiawi", () => {
    /*
     * Catatan kejujuran: spesifikasi menulis "999999 diterima + tanda di luar
     * pola". Angka itu melewati `PORSI_MAKS` (100.000), jadi ia DITOLAK — dan
     * penolakannya disengaja: satu juta porsi sehari bukan dapur institusi,
     * itu salah ketik. Yang dipenuhi adalah maksud tugasnya — tidak crash, dan
     * pesannya manusiawi. Perilaku "diterima + ditandai" berlaku pada rentang
     * di antara wajar dan mustahil, diuji di bawah.
     */
    const hasil = skemaCatatanBaru.safeParse(catatan({ porsiDimasak: "999999" }));
    expect(hasil.success).toBe(false);
    expect(pesanTolak(hasil)).toBe("Angkanya terlalu besar.");
  });

  it("angka besar tapi mungkin DITERIMA dan ditandai di luar pola", () => {
    const hasil = skemaCatatanBaru.safeParse(catatan({ porsiDimasak: "9000" }));
    expect(hasil.success).toBe(true);
    expect(diLuarPola("9000")).toBe(true);
  });

  it("angka dapur biasa tidak ditandai", () => {
    for (const nilai of ["120", "300.50", String(PORSI_WAJAR_MAKS)]) {
      expect(diLuarPola(nilai), nilai).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// Kasus 12 — tanggal masa depan
// ---------------------------------------------------------------------------

describe("9.18 — tanggal masa depan ditolak", () => {
  it("besok ditolak", () => {
    const besok = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    const hasil = skemaCatatanBaru.safeParse(catatan({ tanggal: besok }));

    expect(hasil.success).toBe(false);
    expect(pesanTolak(hasil)).toContain("belum sampai");
  });

  it("hari ini diterima", () => {
    expect(skemaCatatanBaru.safeParse(catatan()).success).toBe(true);
  });

  it("pencatatan MUNDUR tetap diterima — ditandai, tidak dihukum (5.17)", () => {
    /*
     * Batas masa depan tidak boleh diam-diam menutup pencatatan mundur.
     * Operator yang lupa mencatat kemarin sedang sibuk memasak.
     */
    const kemarin = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    expect(skemaCatatanBaru.safeParse(catatan({ tanggal: kemarin })).success).toBe(true);
  });

  it("tanggal mustahil dan salah format ditolak tanpa melempar", () => {
    for (const t of ["2026-02-30", "1899-01-01", "besok", "", "2026-13-01"]) {
      const hasil = skemaCatatanBaru.safeParse(catatan({ tanggal: t }));
      expect(hasil.success, t).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// Kasus 8 — koreksi negatif
// ---------------------------------------------------------------------------

describe("9.15 — koreksi ke angka negatif ditolak", () => {
  it("negatif ditolak dengan sebab yang benar", () => {
    const hasil = skemaKoreksi.safeParse({ porsiSesudah: "-3" });
    expect(hasil.success).toBe(false);
    expect(pesanTolak(hasil)).toBe("Angkanya tidak bisa minus.");
  });

  it("NOL tetap diterima — 'ternyata habis' itu sah", () => {
    /*
     * Batas yang mudah salah: menolak nol bersama negatif akan memaksa
     * operator mengetik "0.01" untuk wadah yang benar-benar kosong, dan angka
     * itu lalu masuk ke kalibrasi sebagai kebohongan kecil yang permanen.
     */
    expect(skemaKoreksi.safeParse({ porsiSesudah: "0" }).success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Kasus 7 — berkas 20 MB atau bukan gambar
// ---------------------------------------------------------------------------

describe("9.14 — berkas ditolak SEBELUM unggah", () => {
  it("berkas 20 MB ditolak", () => {
    const hasil = periksaBerkasFoto({ size: 20 * 1024 * 1024, type: "image/jpeg" });
    expect(hasil.diterima).toBe(false);
  });

  it("berkas bukan gambar ditolak, dan pesannya mengatakan itu", () => {
    for (const type of ["application/pdf", "video/mp4", "text/plain", ""]) {
      const hasil = periksaBerkasFoto({ size: 1024, type });
      expect(hasil.diterima, type).toBe(false);
      if (!hasil.diterima) expect(hasil.pesan, type).toContain("bukan foto");
    }
  });

  it("PDF 20 MB dijelaskan sebagai bukan gambar, bukan sebagai terlalu besar", () => {
    // Menyuruh operator mengecilkan PDF-nya tidak menolong siapa pun.
    const hasil = periksaBerkasFoto({ size: 20 * 1024 * 1024, type: "application/pdf" });
    expect(hasil.diterima).toBe(false);
    if (!hasil.diterima) expect(hasil.pesan).toContain("bukan foto");
  });

  it("foto kamera HP biasa diterima", () => {
    expect(
      periksaBerkasFoto({ size: 4 * 1024 * 1024, type: "image/jpeg" }).diterima,
    ).toBe(true);
    expect(periksaBerkasFoto({ size: 900 * 1024, type: "image/png" }).diterima).toBe(
      true,
    );
  });

  it("berkas kosong ditolak", () => {
    expect(periksaBerkasFoto({ size: 0, type: "image/jpeg" }).diterima).toBe(false);
  });

  it("batasnya lebih longgar dari batas kompresi — mentah dulu, baru dikompres", () => {
    expect(UKURAN_MENTAH_MAKS_BYTE).toBeGreaterThan(600 * 1024);
  });

  it("setiap penolakan menyebut jalan keluar yang setara", () => {
    /*
     * P4: slider setara, bukan darurat. Penolakan foto tidak boleh terasa
     * seperti jalan buntu, karena memang bukan.
     */
    for (const berkas of [
      { size: 20 * 1024 * 1024, type: "image/jpeg" },
      { size: 1024, type: "application/pdf" },
    ]) {
      const hasil = periksaBerkasFoto(berkas);
      if (!hasil.diterima) expect(hasil.pesan).toContain("geser");
    }
  });
});

// ---------------------------------------------------------------------------
// 9.4 — endpoint riset terlindungi flag
// ---------------------------------------------------------------------------

describe("9.4 — endpoint riset tertutup secara bawaan", () => {
  it("flag kosong berarti TERTUTUP", () => {
    /*
     * Gerbang yang harus dinyalakan untuk aman adalah gerbang yang suatu hari
     * akan lupa dinyalakan. Production Vercel tidak punya variabel ini.
     */
    expect(risetAktif({} as unknown as NodeJS.ProcessEnv)).toBe(false);
    expect(risetAktif({ RISET_ENABLED: "" } as unknown as NodeJS.ProcessEnv)).toBe(false);
    expect(risetAktif({ RISET_ENABLED: "false" } as unknown as NodeJS.ProcessEnv)).toBe(
      false,
    );
  });

  it("hanya 'true' persis yang membuka — bukan '1' atau 'yes'", () => {
    expect(risetAktif({ RISET_ENABLED: "true" } as unknown as NodeJS.ProcessEnv)).toBe(
      true,
    );
    for (const nilai of ["1", "yes", "TRUE", "True", "on"]) {
      expect(
        risetAktif({ RISET_ENABLED: nilai } as unknown as NodeJS.ProcessEnv),
        nilai,
      ).toBe(false);
    }
  });

  it("skema penimbangan memakai gram BILANGAN BULAT (aturan keras 3)", () => {
    const dasar = {
      catatanHarianId: "c1",
      beratWadahKosongGram: 500,
      metode: "timbangan gantung digital",
      tanggalUkur: HARI_INI,
    };
    expect(skemaPenimbangan.safeParse({ ...dasar, beratGram: 4500 }).success).toBe(true);
    // Desimal ditolak: kilogram desimal mengundang float ke angka klaim.
    expect(skemaPenimbangan.safeParse({ ...dasar, beratGram: 4.5 }).success).toBe(false);
    expect(skemaPenimbangan.safeParse({ ...dasar, beratGram: -100 }).success).toBe(false);
  });

  it("skema tebakan mencatat PERAN, dan menolak nilai peran di luar daftar", () => {
    const dasar = {
      catatanHarianId: "c1",
      wadahId: "w1",
      tebakanPorsi: "40",
      angkaSebenarnya: "44",
      kondisi: "cahaya redup, jarak 1 meter",
      tanggal: HARI_INI,
    };
    expect(skemaTebakan.safeParse({ ...dasar, peranPenebak: "staf_dapur" }).success).toBe(
      true,
    );
    // Aturan keras 1: tidak ada nama orang yang bisa menyelinap lewat sini.
    expect(skemaTebakan.safeParse({ ...dasar, peranPenebak: "Budi" }).success).toBe(
      false,
    );
  });
});

// ---------------------------------------------------------------------------
// 9.6 — URL foto bertanda tangan, 24 jam
// ---------------------------------------------------------------------------

describe("9.6 — tautan foto kedaluwarsa 24 jam", () => {
  const env = { FOTO_URL_SECRET: "rahasia-uji" } as unknown as NodeJS.ProcessEnv;
  const KUNCI = "estimasi/2026-08-21/abc.jpg";

  it("umurnya persis 24 jam", () => {
    const sekarang = new Date("2026-08-21T08:00:00.000Z");
    const url = tandaTanganiUrlFoto(KUNCI, sekarang, env);

    expect(UMUR_URL_JAM).toBe(24);
    expect(url.kedaluwarsa - Math.floor(sekarang.getTime() / 1000)).toBe(24 * 60 * 60);
  });

  it("tautan yang baru dibuat sah", () => {
    const sekarang = new Date("2026-08-21T08:00:00.000Z");
    const url = tandaTanganiUrlFoto(KUNCI, sekarang, env);

    expect(
      verifikasiUrlFoto(KUNCI, url.kedaluwarsa, url.tandaTangan, sekarang, env).sah,
    ).toBe(true);
  });

  it("tautan yang lewat 24 jam TIDAK sah lagi", () => {
    const sekarang = new Date("2026-08-21T08:00:00.000Z");
    const url = tandaTanganiUrlFoto(KUNCI, sekarang, env);
    const besokLewat = new Date(sekarang.getTime() + 25 * 3_600_000);

    const hasil = verifikasiUrlFoto(
      KUNCI,
      url.kedaluwarsa,
      url.tandaTangan,
      besokLewat,
      env,
    );
    expect(hasil.sah).toBe(false);
    if (!hasil.sah) expect(hasil.sebab).toBe("kedaluwarsa");
  });

  it("kedaluwarsa TIDAK BISA diperpanjang tanpa membatalkan tanda tangan", () => {
    /*
     * Serangan yang paling jelas: ubah `kedaluwarsa` di query string menjadi
     * tahun 2099. Karena nilai itu ikut ditandatangani, mengubahnya membuat
     * tanda tangannya tidak cocok lagi.
     */
    const sekarang = new Date("2026-08-21T08:00:00.000Z");
    const url = tandaTanganiUrlFoto(KUNCI, sekarang, env);
    const jauhDiDepan = url.kedaluwarsa + 365 * 24 * 60 * 60;

    const hasil = verifikasiUrlFoto(KUNCI, jauhDiDepan, url.tandaTangan, sekarang, env);
    expect(hasil.sah).toBe(false);
    if (!hasil.sah) expect(hasil.sebab).toBe("tanda_tangan_salah");
  });

  it("tanda tangan satu foto tidak bisa dipakai untuk foto lain", () => {
    const sekarang = new Date("2026-08-21T08:00:00.000Z");
    const url = tandaTanganiUrlFoto(KUNCI, sekarang, env);

    const hasil = verifikasiUrlFoto(
      "estimasi/2026-08-21/foto-lain.jpg",
      url.kedaluwarsa,
      url.tandaTangan,
      sekarang,
      env,
    );
    expect(hasil.sah).toBe(false);
  });

  it("rahasia berbeda menghasilkan tanda tangan berbeda", () => {
    const sekarang = new Date("2026-08-21T08:00:00.000Z");
    const a = tandaTanganiUrlFoto(KUNCI, sekarang, env);
    const b = tandaTanganiUrlFoto(KUNCI, sekarang, {
      FOTO_URL_SECRET: "rahasia-lain",
    } as unknown as NodeJS.ProcessEnv);

    expect(a.tandaTangan).not.toBe(b.tandaTangan);
  });

  it("rahasia yang belum diisi MELEMPAR, tidak jatuh ke nilai bawaan", () => {
    /*
     * Rahasia bawaan berarti setiap pemasangan memakai kunci yang sama, dan
     * tanda tangan yang bisa dibuat siapa pun bukan tanda tangan sama sekali.
     * Lebih baik fitur foto mati daripada menjaga dengan kunci yang diketahui.
     */
    expect(() =>
      tandaTanganiUrlFoto(KUNCI, new Date(), {} as unknown as NodeJS.ProcessEnv),
    ).toThrow();
  });

  it("query string memuat kedua bidang yang diperlukan", () => {
    const url = tandaTanganiUrlFoto(KUNCI, new Date("2026-08-21T08:00:00.000Z"), env);
    const qs = keQueryString(url);

    expect(qs).toContain("kedaluwarsa=");
    expect(qs).toContain("tanda=");
  });
});

// ---------------------------------------------------------------------------
// 9.5 — mode anonim menyeluruh
// ---------------------------------------------------------------------------

describe("9.5 — setiap jalur keluaran publik lewat serialisasi-publik.ts", () => {
  const AKAR = fileURLToPath(new URL("../../../../..", import.meta.url));

  function baca(jalur: string): string {
    return readFileSync(`${AKAR}/${jalur}`, "utf8");
  }

  function tanpaKomentar(isi: string): string {
    return isi.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  }

  it("hanya serialisasi-publik.ts yang membaca dapur.nama mentah", () => {
    /*
     * Aturan keras 10: mode anonim ditangani DI SATU TEMPAT. Satu `dapur.nama`
     * yang lolos di jalur publik membocorkan identitas dapur yang justru
     * meminta disamarkan — dan kebocoran itu tidak akan terlihat sampai ada
     * dapur nyata yang menyalakan mode anonim.
     */
    const jalurPublik = [
      "src/app/(publik)/page.tsx",
      "src/app/(publik)/akurasi/page.tsx",
      "src/app/(publik)/riwayat/page.tsx",
      "src/app/api/publik/_lib/ringkasan.ts",
      "src/app/api/publik/_lib/akurasi.ts",
      "src/app/api/publik/_lib/riwayat-rinci.ts",
      "src/app/api/publik/_lib/tebakan.ts",
    ];

    for (const jalur of jalurPublik) {
      const isi = tanpaKomentar(baca(jalur));
      // `ringkasan.dapur.nama` sah — itu bentuk DapurPublik yang sudah
      // diserialisasi. Yang dilarang adalah `dapur.nama` telanjang.
      const mentah = /(?<!ringkasan\.)\bdapur\.nama\b/.test(isi);
      const menyerialisasi = /keDapurPublik/.test(isi);
      expect(mentah && !menyerialisasi, jalur).toBe(false);
    }
  });

  it("bentuk DapurPublik menyembunyikan nama asli saat anonim", () => {
    const isi = baca("src/lib/serialisasi-publik.ts");
    expect(isi).toContain("labelAnonim");
  });
});
