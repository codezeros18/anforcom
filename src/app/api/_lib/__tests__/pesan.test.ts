import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { KODE_GALAT, PESAN_BAWAAN, type KodeGalatApi } from "../respons";

/*
 * PENJAGA ATURAN BAHASA — CLAUDE.md bagian 5.
 *
 * "Jangan pernah memakai kata yang menghakimi (boros, buruk, gagal, melebihi
 * target) untuk data dapur. Framing selalu perencanaan, bukan evaluasi."
 *
 * Aturan ini tidak bisa dijaga lewat ulasan kode. Ia dilanggar satu kata pada
 * satu waktu, oleh orang yang sedang terburu-buru menambahkan satu pesan galat
 * baru, tiga sprint dari sekarang. Karena itu ia dijaga tes yang memindai
 * pesan sungguhan — bukan diingat-ingat.
 */

const AKAR = fileURLToPath(new URL("../../../../..", import.meta.url));

/**
 * Kata yang menghakimi atau berbahasa sistem.
 *
 * Dua kelompok, dua alasan berbeda:
 * - MENGHAKIMI ("boros", "buruk") membuat operator merasa dinilai, dan operator
 *   yang merasa dinilai berhenti mencatat atau mulai memasukkan angka asal.
 * - BAHASA SISTEM ("invalid", "error 422") tidak memberi tahu orang yang
 *   tangannya basah apa yang harus dia lakukan berikutnya.
 */
const KATA_TERLARANG = [
  "boros",
  "buruk",
  "melebihi target",
  "terlalu banyak",
  "kesalahan anda",
  "anda salah",
  "invalid",
  "error",
  "failed",
  "unauthorized",
  "forbidden",
  "exception",
  "null",
  "undefined",
];

describe("pesan galat memakai bahasa manusia", () => {
  const semua = Object.entries(PESAN_BAWAAN) as Array<[KodeGalatApi, string]>;

  it("setiap kode punya pesannya sendiri", () => {
    for (const kode of Object.values(KODE_GALAT)) {
      expect(PESAN_BAWAAN[kode]).toBeTruthy();
    }
    expect(semua.length).toBe(Object.keys(KODE_GALAT).length);
  });

  it.each(semua)(
    "%s tidak memakai kata yang menghakimi atau bahasa sistem",
    (_kode, pesan) => {
      const kecil = pesan.toLowerCase();
      for (const kata of KATA_TERLARANG) {
        expect(kecil).not.toContain(kata);
      }
    },
  );

  it.each(semua)("%s adalah kalimat utuh berbahasa Indonesia", (_kode, pesan) => {
    // Bukan potongan kode, bukan singkatan sistem.
    expect(pesan.length).toBeGreaterThan(10);
    expect(pesan).toMatch(/[.?]$/);
    expect(pesan).not.toMatch(/^[A-Z_]+$/);
  });

  it("pesan timeout menawarkan jalan keluar DAN menjamin mutunya", () => {
    /*
     * Kalimat ini yang paling sering dibaca operator saat sinyal buruk, dan
     * bagian "hasilnya sama" adalah yang mencegahnya merasa baru saja menerima
     * hasil kelas dua. Tanpa itu, slider berhenti terasa setara.
     */
    expect(PESAN_BAWAAN.TIMEOUT_MODEL).toBe(
      "Sinyal lambat — pakai geser saja, hasilnya sama.",
    );
  });

  it("pesan wadah tak terdaftar menyebut keadaannya, bukan menyalahkan", () => {
    expect(PESAN_BAWAAN.WADAH_TIDAK_TERDAFTAR).toBe(
      "Wadah ini belum terdaftar di dapur ini.",
    );
  });

  it("pesan tanggal ganda memberi jalan ke depan", () => {
    // Bukan "Tanggal sudah ada" saja — itu jalan buntu.
    expect(PESAN_BAWAAN.TANGGAL_SUDAH_ADA).toContain("Buka catatannya");
  });
});

// ---------------------------------------------------------------------------
// Pemindaian teks yang benar-benar tampil di layar
// ---------------------------------------------------------------------------

function kumpulkanBerkas(direktori: string): string[] {
  const hasil: string[] = [];
  for (const entri of readdirSync(direktori)) {
    if (entri === "__tests__" || entri === "node_modules") continue;
    const jalur = join(direktori, entri);
    if (statSync(jalur).isDirectory()) {
      hasil.push(...kumpulkanBerkas(jalur));
      continue;
    }
    if (/\.tsx?$/.test(entri)) hasil.push(jalur);
  }
  return hasil;
}

const BERKAS_TAMPILAN = [
  ...kumpulkanBerkas(join(AKAR, "src/components")),
  ...kumpulkanBerkas(join(AKAR, "src/app")),
];

describe("teks di layar", () => {
  it("menemukan berkas untuk dipindai", () => {
    expect(BERKAS_TAMPILAN.length).toBeGreaterThan(8);
  });

  it("tidak ada teks berwarna merah untuk data dapur", () => {
    /*
     * CLAUDE.md bagian 5: "Tidak ada warna merah untuk angka sisa."
     *
     * Merah menandakan kesalahan. Sisa makanan bukan kesalahan operator — ia
     * angka perencanaan. Palet di globals.css memang tidak punya merah, dan
     * tes ini memastikan tidak ada yang memanggilnya lewat kelas bawaan
     * Tailwind.
     */
    const pelanggar: string[] = [];
    for (const jalur of BERKAS_TAMPILAN) {
      const isi = readFileSync(jalur, "utf8");
      if (/\b(?:text|bg|border)-(?:red|rose)-\d{3}\b/.test(isi)) {
        pelanggar.push(jalur.slice(AKAR.length));
      }
    }
    expect(pelanggar).toEqual([]);
  });

  it("tidak ada kata menghakimi pada teks yang tampil", () => {
    const dilarang = /\b(boros|buruk|gagal total|kesalahan anda|anda salah)\b/i;
    const pelanggar: string[] = [];

    for (const jalur of BERKAS_TAMPILAN) {
      const isi = readFileSync(jalur, "utf8");
      // Komentar dibuang lebih dulu — penjelasan boleh menyebut kata yang
      // dilarang tampil, dan memang harus, supaya alasannya terbaca.
      const tanpaKomentar = isi
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
      if (dilarang.test(tanpaKomentar)) pelanggar.push(jalur.slice(AKAR.length));
    }

    expect(pelanggar).toEqual([]);
  });

  it("tidak ada stack trace yang bocor ke layar", () => {
    /*
     * CLAUDE.md bagian 5: kesalahan tak terduga tidak menampilkan stack trace.
     * `tangani()` mencatat detailnya ke log server dan mengembalikan satu
     * kalimat ke layar.
     */
    const pelanggar: string[] = [];
    for (const jalur of BERKAS_TAMPILAN) {
      const isi = readFileSync(jalur, "utf8");
      if (/\{\s*(?:galat|penyebab|err(?:or)?)\.(?:stack|message)\s*\}/.test(isi)) {
        pelanggar.push(jalur.slice(AKAR.length));
      }
    }
    expect(pelanggar).toEqual([]);
  });
});
