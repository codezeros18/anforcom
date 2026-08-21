import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/*
 * PENJAGA HALAMAN AKURASI DAN SEBARAN TEBAKAN.
 *
 * Halaman Akurasi adalah klaim, bukan sekadar layar: "kami menampilkan tingkat
 * kesalahan kami sendiri". Klaim itu runtuh dengan satu angka yang di-hardcode
 * atau satu blok yang menampilkan data karangan — dan justru dua hal itulah
 * yang paling mudah menyelinap masuk saat seseorang buru-buru membuat halaman
 * terlihat bagus untuk demo.
 *
 * Karena itu keduanya dijaga tes, bukan dijaga niat baik.
 */

const AKAR = fileURLToPath(new URL("../../../../../..", import.meta.url));

function baca(jalur: string): string {
  return readFileSync(`${AKAR}/${jalur}`, "utf8");
}

function tanpaKomentar(isi: string): string {
  return isi.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

const HALAMAN_AKURASI = "src/app/(publik)/akurasi/page.tsx";
const LIB_AKURASI = "src/app/api/publik/_lib/akurasi.ts";

// ---------------------------------------------------------------------------
// 8.4 — semua angka dari audit log, tidak ada yang di-hardcode
// ---------------------------------------------------------------------------

describe("8.4 — angka halaman Akurasi dihitung dari audit log", () => {
  it("seluruh angka berasal dari agregasiAkurasi di core/audit", () => {
    // Satu-satunya sumber angka. Kalau halaman ini menghitung simpangannya
    // sendiri, ia bisa menyimpang dari angka yang sungguh dipakai sistem —
    // dan halaman kejujuran yang angkanya berbeda dari mesinnya lebih buruk
    // daripada tidak ada halaman sama sekali.
    expect(baca(LIB_AKURASI)).toContain("agregasiAkurasi");
    expect(baca(LIB_AKURASI)).toContain('from "@/core/audit"');
  });

  it("TIDAK ADA persentase yang ditulis langsung di halaman", () => {
    /*
     * Yang dicari adalah angka yang menyamar sebagai hasil pengukuran —
     * "12.5%", "akurasi 94%". Angka tata letak (grid-cols-3, py-2, pl-5) tidak
     * termasuk: ia tidak pernah dibaca orang sebagai klaim.
     */
    const isi = tanpaKomentar(baca(HALAMAN_AKURASI));

    // Persentase literal di dalam teks JSX, misalnya `>94%<` atau `"12.5%"`.
    const persenLiteral = isi.match(/[>"'\s]\d+([.,]\d+)?%/g) ?? [];
    expect(persenLiteral).toEqual([]);
  });

  it("halaman tidak menghitung simpangan sendiri", () => {
    /*
     * Rumus kedua di halaman akan menyimpang dari rumus pertama di `/core`
     * begitu salah satunya berubah, dan yang tampil ke publik adalah yang
     * salah.
     */
    const isi = tanpaKomentar(baca(HALAMAN_AKURASI));

    for (const terlarang of ["reduce(", "Math.round", "/ 100", "* 100"]) {
      expect(isi, terlarang).not.toContain(terlarang);
    }
  });

  it("angka yang belum terdefinisi ditulis 'belum ada', bukan 0", () => {
    /*
     * "0% dikoreksi" terbaca sebagai sistem yang tidak pernah salah, padahal
     * artinya belum ada yang diukur. Ini kebohongan yang paling mudah dibuat
     * tanpa sengaja di halaman ini.
     */
    expect(baca(HALAMAN_AKURASI)).toContain('"belum ada"');
  });
});

// ---------------------------------------------------------------------------
// 8.3 — struktur lima blok dan kalimat penutup
// ---------------------------------------------------------------------------

describe("8.3 — halaman Akurasi lengkap dan berurutan", () => {
  const isi = baca(HALAMAN_AKURASI);
  const jsx = tanpaKomentar(isi);

  it("kalimat penutup PERSIS seperti spesifikasi", () => {
    // Kalimat ini adalah inti klaimnya. Ia tidak boleh diparafrase.
    const bersih = jsx.replace(/\s+/g, " ");
    expect(bersih).toContain(
      "Kami menampilkan tingkat kesalahan kami sendiri karena angka yang tidak bisa diperiksa tidak bisa dipercaya.",
    );
  });

  it("kelima blok ada dan urutannya sesuai spesifikasi", () => {
    const posisi = [
      jsx.indexOf("Ringkasan akurasi"),
      jsx.indexOf("Per jenis permukaan"),
      jsx.indexOf("Apakah membaik seiring koreksi"),
      jsx.indexOf("Yang tidak dihitung"),
      jsx.indexOf("Kami menampilkan tingkat kesalahan"),
    ];

    for (const p of posisi) expect(p).toBeGreaterThan(0);
    for (let i = 1; i < posisi.length; i += 1) {
      expect(posisi[i - 1] ?? -1).toBeLessThan(posisi[i] ?? -1);
    }
  });

  it("ketiga kategori fisik punya nama yang bisa dibaca orang", () => {
    for (const kategori of ["padat_rata", "padat_menggunung", "berkuah"]) {
      expect(jsx).toContain(kategori);
    }
    expect(jsx).toContain("Padat menggunung");
    expect(jsx).toContain("Berkuah");
  });

  it("jumlah dikecualikan DAN alasannya sama-sama ditampilkan", () => {
    // Pengecualian yang jumlahnya disebut tapi alasannya tidak adalah cara
    // paling halus untuk memperindah angka.
    expect(jsx).toContain("jumlahDikecualikan");
    expect(jsx).toContain("alasanDikecualikan");
  });

  it("tren tidak ditampilkan saat koreksinya belum cukup", () => {
    expect(baca(LIB_AKURASI)).toContain("MINIMUM_KOREKSI_UNTUK_TREN");
    expect(jsx).toContain("a.tren === null");
  });

  it("simpangan yang memburuk tetap ditampilkan, tidak disembunyikan", () => {
    // LARANGAN sprint ini: jangan memperhalus angka kesalahan.
    const bersih = jsx.replace(/\s+/g, " ");
    expect(bersih).toContain("Simpangan belum mengecil");
  });

  it("tidak ada warna merah di halaman ini", () => {
    // Angka kesalahan bukan tuduhan kepada siapa pun (CLAUDE.md bagian 5).
    expect(jsx).not.toMatch(/\b(text|bg|border)-(red|rose|orange)-/);
  });
});

// ---------------------------------------------------------------------------
// 8.8 — sebaran tebakan tidak pernah dikarang
// ---------------------------------------------------------------------------

describe("8.8 — sebaran tebakan hilang seluruhnya bila datanya belum ada", () => {
  it("layar publik merender blok itu hanya bila sebaran tidak null", () => {
    const jsx = tanpaKomentar(baca("src/app/(publik)/page.tsx"));
    expect(jsx).toContain("{sebaran && <SebaranTebakan");
  });

  it("lapisan data mengembalikan null, bukan objek berisi nol", () => {
    const isi = baca("src/app/api/publik/_lib/tebakan.ts");
    expect(isi).toContain("if (!terbaru) return null;");
    expect(isi).toContain("if (semua.length === 0) return null;");
  });

  it("endpoint menjawab 404 saat belum ada data, bukan 200 dengan n: 0", () => {
    /*
     * 200 dengan nol akan dirender oleh klien yang tidak teliti sebagai blok
     * sebaran berisi nol — angka karangan di blok yang justru dibuat untuk
     * membuktikan kejujuran.
     */
    const isi = tanpaKomentar(baca("src/app/api/publik/tebakan/route.ts"));
    expect(isi).toContain("404");
    expect(isi).toContain("if (!sebaran)");
  });

  it("komponen sebaran tidak punya nilai bawaan yang bisa tampil tanpa data", () => {
    const isi = tanpaKomentar(baca("src/components/SebaranTebakan.tsx"));
    // Tidak ada `?? 0`, `|| 0`, atau angka contoh yang menutupi data kosong.
    expect(isi).not.toMatch(/\?\?\s*0\b/);
    expect(isi).not.toMatch(/\|\|\s*0\b/);
  });

  it("median dihitung dalam bilangan bulat perseratus, tanpa float", () => {
    // Aturan keras 3: porsi tidak pernah menyentuh float.
    const isi = baca("src/app/api/publik/_lib/tebakan.ts");
    expect(isi).toContain("medianPerseratus");
    expect(isi).toContain("Math.round((kiri + kanan) / 2)");
  });

  it("peran penebak ditampilkan sebagai kategori, bukan orang", () => {
    // Aturan keras 1.
    const isi = baca("src/components/SebaranTebakan.tsx");
    expect(isi).toContain("staf_dapur");
    expect(isi).not.toMatch(/\bnama(Penebak|Orang)\b/);
  });
});

// ---------------------------------------------------------------------------
// 8.2 — riwayat: anomali dicoret, bukan dihapus
// ---------------------------------------------------------------------------

describe("8.2 — layar riwayat menampilkan yang dikecualikan, tidak menyembunyikannya", () => {
  const isi = baca("src/app/(publik)/riwayat/page.tsx");
  const jsx = tanpaKomentar(isi);

  it("hari anomali DICORET secara visual", () => {
    expect(jsx).toContain("line-through");
  });

  it("alasan anomali ikut terlihat", () => {
    expect(jsx).toContain("alasanAnomali");
  });

  it("hari anomali tidak disaring keluar dari daftar", () => {
    /*
     * Kalau baris ini pernah menjadi `.filter((h) => !h.isAnomali)`, riwayat
     * akan tampak lebih rapi daripada kenyataannya — dan yang hilang justru
     * bagian yang paling perlu dijelaskan.
     */
    expect(jsx).not.toMatch(/filter\([^)]*!\s*\w+\.isAnomali/);
  });

  it("setiap baris bisa dibuka tanpa JavaScript", () => {
    // <details>, bukan useState: layar ini ikut dibuka orang luar di HP lambat.
    expect(jsx).toContain("<details");
    expect(jsx).not.toContain("useState");
    expect(isi).not.toContain('"use client"');
  });

  it("nilai final DIHITUNG dari koreksi, tidak dibaca dari kolom yang ditimpa", () => {
    // Aturan keras 2, dan ini layar tempat aturan itu terlihat orang luar.
    expect(baca("src/app/api/publik/_lib/riwayat-rinci.ts")).toContain(
      "hitungPorsiFinal",
    );
  });
});
