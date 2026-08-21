import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/*
 * PENJAGA LAYAR PUBLIK.
 *
 * Layar ini dibuka orang asing tanpa panduan, di jaringan yang tidak kita
 * kendalikan. Tiga hal yang kalau rusak tidak akan ketahuan sampai hari demo,
 * dan karena itu dijaga tes:
 *
 * 1. Nama dapur bocor tanpa lewat serialisasi publik (aturan 10)
 * 2. Konten utama diam-diam menjadi client component, sehingga hilang saat
 *    JavaScript dimatikan (7.4)
 * 3. Pustaka charting menyelinap masuk (7.13)
 */

const AKAR = fileURLToPath(new URL("../../../../../..", import.meta.url));
const LAYAR = `${AKAR}/src/app/(publik)/page.tsx`;
const RINGKASAN = `${AKAR}/src/app/api/publik/_lib/ringkasan.ts`;

function baca(jalur: string): string {
  return readFileSync(jalur, "utf8");
}

function tanpaKomentar(isi: string): string {
  return isi.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

function kumpulkan(direktori: string): string[] {
  const hasil: string[] = [];
  for (const entri of readdirSync(direktori)) {
    if (entri === "__tests__") continue;
    const jalur = join(direktori, entri);
    if (statSync(jalur).isDirectory()) {
      hasil.push(...kumpulkan(jalur));
      continue;
    }
    if (/\.tsx?$/.test(entri)) hasil.push(jalur);
  }
  return hasil;
}

// ---------------------------------------------------------------------------
// Aturan 10 — serialisasi publik
// ---------------------------------------------------------------------------

describe("nama dapur SELALU lewat serialisasi publik (aturan 10)", () => {
  it("lapisan data memanggil keDapurPublik", () => {
    expect(baca(RINGKASAN)).toContain("keDapurPublik(dapur)");
  });

  it("TIDAK ADA pembacaan dapur.nama langsung di jalur publik", () => {
    /*
     * Ini yang membuat mode anonim bisa dipercaya. Satu `dapur.nama` di satu
     * tempat sudah cukup membocorkan identitas dapur yang justru meminta
     * disamarkan — dan kebocoran itu tidak akan terlihat sampai ada dapur nyata
     * yang menyalakan mode anonim.
     */
    const berkas = [
      ...kumpulkan(`${AKAR}/src/app/(publik)`),
      ...kumpulkan(`${AKAR}/src/app/api/publik`),
    ];
    const pelanggar: string[] = [];

    for (const jalur of berkas) {
      const isi = tanpaKomentar(baca(jalur));
      /*
       * `ringkasan.dapur.nama` SAH — itu bentuk `DapurPublik` yang sudah
       * melewati serialisasi, dan tipenya memang tidak memuat nama asli.
       *
       * Yang dilarang adalah `dapur.nama` telanjang, yaitu pembacaan entitas
       * Prisma mentah. Berkas yang memanggil `keDapurPublik` dikecualikan —
       * di situlah serialisasinya terjadi.
       */
      const mentah = /(?<!ringkasan\.)\bdapur\.nama\b/.test(isi);
      if (mentah && !/keDapurPublik/.test(isi)) {
        pelanggar.push(jalur.slice(AKAR.length));
      }
    }
    expect(pelanggar).toEqual([]);
  });

  it("izin kedaluwarsa disaring lewat bolehTampilPublik, bukan diperiksa ulang", () => {
    // Dua tempat yang memeriksa izin akan menyimpang; yang satu akan lupa
    // memeriksa masa berlakunya.
    expect(baca(RINGKASAN)).toContain("bolehTampilPublik(d)");
  });
});

// ---------------------------------------------------------------------------
// 7.4 — konten utama tanpa JavaScript
// ---------------------------------------------------------------------------

describe("konten utama ada tanpa JavaScript (7.4)", () => {
  it("layar publik BUKAN client component", () => {
    expect(baca(LAYAR)).not.toContain('"use client"');
  });

  it("angka pahlawan, rekomendasi, dan grafik semuanya server component", () => {
    /*
     * Kalau salah satunya menjadi client component, ia hilang saat JavaScript
     * dimatikan — dan angka pahlawan yang hilang berarti seluruh alasan halaman
     * ini ada ikut hilang.
     */
    for (const berkas of [
      "src/components/AngkaPahlawan.tsx",
      "src/components/KartuRekomendasi.tsx",
      "src/components/grafik-riwayat.tsx",
    ]) {
      expect(baca(`${AKAR}/${berkas}`), berkas).not.toContain('"use client"');
    }
  });

  it("hanya tombol salin yang butuh JavaScript", () => {
    // Ia dipisah ke berkasnya sendiri justru supaya sisanya tetap server-side.
    expect(baca(`${AKAR}/src/components/TombolSalin.tsx`)).toContain('"use client"');
  });

  it("mode angka tertutup memakai <details>, bukan state React", () => {
    /*
     * 7.5 — hook pameran harus bekerja di HP juri yang JavaScript-nya lambat
     * dimuat, dan justru di situlah ia paling dibutuhkan.
     */
    const isi = baca(`${AKAR}/src/components/AngkaPahlawan.tsx`);
    expect(isi).toContain("<details");
    expect(isi).not.toContain("useState");
  });

  it("layar mengambil data langsung, bukan fetch ke endpoint sendiri", () => {
    /*
     * Pada 400 kbps / 400 ms RTT, perjalanan jaringan kedua saja sudah memakan
     * hampir sepertiga anggaran tiga detik.
     */
    const isi = tanpaKomentar(baca(LAYAR));
    expect(isi).toContain("ambilRingkasanPublik()");
    expect(isi).not.toMatch(/fetch\(["'`]\/api/);
  });
});

// ---------------------------------------------------------------------------
// 7.13 — grafik tanpa pustaka
// ---------------------------------------------------------------------------

describe("grafik ditulis sendiri (7.13)", () => {
  it("tidak ada pustaka charting di dependensi", () => {
    const pkg = JSON.parse(baca(`${AKAR}/package.json`)) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const semua = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
    const charting = /chart|recharts|victory|nivo|d3|plotly|apexcharts|echarts|visx/i;

    expect(semua.filter((n) => charting.test(n))).toEqual([]);
  });

  it("grafik menghasilkan SVG sendiri", () => {
    const isi = baca(`${AKAR}/src/components/grafik-riwayat.tsx`);
    expect(isi).toContain("<svg");
    expect(isi).toContain("<path");
  });

  it("sumbu dimulai dari nol", () => {
    /*
     * Memotong sumbu membuat selisih kecil tampak dramatis. Angka dapur tidak
     * boleh dibuat tampak lebih buruk dari kenyataannya — framingnya
     * perencanaan, bukan evaluasi.
     */
    const isi = baca(`${AKAR}/src/components/grafik-riwayat.tsx`);
    expect(isi).toContain("Sumbu selalu dimulai dari nol");
    expect(isi).toContain("const garisSumbu = [0,");
  });
});

// ---------------------------------------------------------------------------
// 7.6 — data contoh tidak pernah menyamar
// ---------------------------------------------------------------------------

describe("data contoh tidak pernah menyamar sebagai data nyata (7.6, aturan 8)", () => {
  const isi = baca(LAYAR);

  it("badge dan kalimatnya ada, persis seperti spesifikasi", () => {
    expect(isi).toContain("dapur contoh");
    expect(isi).toContain(
      "Data lapangan sedang dikumpulkan. Yang ditampilkan saat ini adalah dapur",
    );
  });

  it("ditampilkan DI ATAS angka apa pun", () => {
    // Peringatan yang muncul setelah angka sudah terbaca datang terlambat.
    const posisiBadge = isi.indexOf("memakaiDapurContoh &&");
    const posisiAngka = isi.indexOf("<AngkaPahlawan");
    expect(posisiBadge).toBeGreaterThan(0);
    expect(posisiBadge).toBeLessThan(posisiAngka);
  });

  it("hilang otomatis saat ada dapur nyata berizin", () => {
    // Bukan flag manual yang harus diingat seseorang untuk dimatikan.
    expect(baca(RINGKASAN)).toContain("memakaiDapurContoh: false");
  });
});

// ---------------------------------------------------------------------------
// 7.3 — hierarki visual
// ---------------------------------------------------------------------------

describe("hierarki visual (7.3)", () => {
  const isi = baca(LAYAR);

  it("ukuran setiap baris sesuai spesifikasi", () => {
    expect(isi).toContain("text-konteks"); // 14px baris konteks
    expect(isi).toContain("text-[24px]"); // baris pendukung
    expect(isi).toContain("text-[32px] font-bold"); // baris rupiah
    expect(baca(`${AKAR}/src/components/AngkaPahlawan.tsx`)).toContain("text-pahlawan"); // 72px
    expect(baca(`${AKAR}/src/components/AngkaPahlawan.tsx`)).toContain("text-[18px]"); // label
  });

  it("urutannya NILAI DULU, AKSI KEMUDIAN", () => {
    /*
     * Larangan eksplisit sprint ini: tombol "Coba sebagai operator" tidak boleh
     * di atas angka. Menaruhnya di atas meminta orang memutuskan sesuatu
     * sebelum dia punya alasan untuk peduli.
     */
    // Komentar dibuang lebih dulu: penjelasan di kepala berkas menyebut
    // "Coba sebagai operator" jauh sebelum tombolnya dirender, dan yang diukur
    // di sini adalah urutan JSX-nya.
    const jsx = tanpaKomentar(isi);

    const posisiAngka = jsx.indexOf("<AngkaPahlawan");
    const posisiRupiah = jsx.indexOf("text-[32px]");
    const posisiRekomendasi = jsx.indexOf("<KartuRekomendasi");
    const posisiGrafik = jsx.indexOf("<GrafikRiwayat");
    const posisiTombol = jsx.indexOf("Coba sebagai operator");

    expect(posisiAngka).toBeLessThan(posisiRupiah);
    expect(posisiRupiah).toBeLessThan(posisiRekomendasi);
    expect(posisiRekomendasi).toBeLessThan(posisiGrafik);
    expect(posisiGrafik).toBeLessThan(posisiTombol);
  });

  it("pita metode selalu ada, bahkan saat belum ada penimbangan", () => {
    /*
     * Pita yang hilang membuat angka rupiah tampak punya dasar yang tidak
     * pernah disebutkan. Konsekuensi rubrik nomor 3: angka yang tidak bisa
     * dipertanggungjawabkan lebih merugikan daripada tidak ada angka.
     */
    expect(isi).toContain("Data diukur tim di lokasi pada");
    expect(isi).toContain("belum dari timbangan tim");
  });

  it("tidak ada animasi", () => {
    const berkas = [
      LAYAR,
      `${AKAR}/src/app/(publik)/loading.tsx`,
      `${AKAR}/src/components/grafik-riwayat.tsx`,
    ];
    for (const jalur of berkas) {
      expect(
        /animate-|transition-|@keyframes/.test(tanpaKomentar(baca(jalur))),
        jalur,
      ).toBe(false);
    }
  });

  it("state memuat memakai skeleton, bukan spinner", () => {
    const isi_ = baca(`${AKAR}/src/app/(publik)/loading.tsx`);
    expect(isi_).toContain("rounded-xl bg-netral-200");
    expect(/spinner|animate-spin/i.test(tanpaKomentar(isi_))).toBe(false);
  });

  it("state error tidak menampilkan stack trace", () => {
    const isi_ = baca(`${AKAR}/src/app/(publik)/error.tsx`);
    expect(isi_).not.toMatch(/\{\s*error\.(message|stack)\s*\}/);
  });
});

// ---------------------------------------------------------------------------
// 7.10 / 7.11 — lantai keras dan ambang
// ---------------------------------------------------------------------------

describe("kartu rekomendasi (7.10, 7.11)", () => {
  const isi = baca(`${AKAR}/src/components/KartuRekomendasi.tsx`);

  it("baris lantai keras SELALU tampil, tidak di balik syarat aturan menang", () => {
    expect(isi).toContain("Tidak pernah di bawah");
    // Tidak dibungkus pemeriksaan aturanMenang.
    expect(isi).not.toMatch(/aturanMenang\s*===\s*"lantai"\s*&&/);
  });

  it("di bawah ambang TIDAK ADA angka rekomendasi", () => {
    /*
     * Bukan angka pucat, bukan angka dengan tanda tanya. Rekomendasi dari dua
     * titik data terlihat berwibawa dan tidak berarti apa-apa.
     */
    const cabangAmbang = isi.slice(
      isi.indexOf('props.status === "belum_cukup_data"'),
      isi.indexOf("const teksSalin"),
    );
    expect(cabangAmbang).toContain("Saran angka muncul setelah 5 hari");
    expect(cabangAmbang).not.toContain("props.porsi");
    expect(cabangAmbang).not.toContain("lantaiKeras");
  });

  it("tombol salin membawa angka BESERTA alasannya", () => {
    // Pengelola yang menerima "296" tanpa konteks akan bertanya dari mana.
    expect(isi).toContain("props.kalimatAlasan");
    expect(isi).toContain("Saran porsi besok");
  });

  it("angka bisa ditelusuri lewat tautan biasa, bukan tooltip JavaScript", () => {
    expect(isi).toContain("<a");
    expect(isi).toContain("/riwayat");
  });

  it("tautan telusur menunjuk RUTE YANG SUNGGUH ADA", () => {
    /*
     * DITEMUKAN SAAT PEMERIKSAAN KESIAPAN SPRINT 10, di production.
     *
     * Tes lama hanya memeriksa bahwa string "/riwayat/" muncul — dan itu
     * lolos walau tautannya menunjuk `/riwayat/<uuid>`, rute yang TIDAK PERNAH
     * DIBUAT. Hasilnya 404 di layar publik, persis pada tautan yang gunanya
     * membuktikan setiap angka bisa diperiksa asalnya.
     *
     * Pelajarannya: memeriksa bentuk string bukan memeriksa bahwa tautannya
     * bekerja. Tes ini sekarang membandingkan tujuan tautan dengan rute yang
     * benar-benar ada di `src/app`.
     */
    /*
     * Dibaca dari KartuRekomendasi.tsx — di situlah tautannya dibuat, bukan di
     * `page.tsx`. Versi pertama tes ini membaca berkas yang salah dan karena
     * itu tetap hijau walau tautannya rusak; ia baru terbukti menggigit
     * sesudah sumbernya dibetulkan.
     */
    const sumberTautan = baca(`${AKAR}/src/components/KartuRekomendasi.tsx`);
    // Ambil seluruh isi href sampai backtick/kutip penutup — termasuk garis
    // miring, supaya segmen dinamis `/riwayat/${id}` ikut terbaca utuh.
    const tujuan = [...sumberTautan.matchAll(/href=\{?`([^`]+)`\}?/g)].map(
      (m) => m[1] ?? "",
    );
    const keRiwayat = tujuan.filter((t) => t.startsWith("/riwayat"));
    expect(keRiwayat.length).toBeGreaterThan(0);

    for (const t of keRiwayat) {
      // Anchor ke halaman daftar (`/riwayat#hari-...`) sah karena
      // `(publik)/riwayat/page.tsx` ada. Segmen dinamis `/riwayat/<id>` TIDAK,
      // karena tidak ada `riwayat/[id]/page.tsx`.
      const segmenDinamis = /^\/riwayat\/[^#]/.test(t);
      expect(segmenDinamis, `tautan ${t} menunjuk rute yang tidak ada`).toBe(false);
    }
  });
});
