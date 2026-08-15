import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  fraksiTeks,
  porsiTeks,
  porsiTeksBolehNol,
  skemaAnomali,
  skemaCatatanBaru,
  skemaEstimasiManual,
  skemaKoreksi,
  skemaPenyaluran,
  tanggalTeks,
} from "../skema";
import { hitungRentangRupiah, keSen } from "../hitung";
import { porsiDariString } from "@/core/porsi";
import {
  AMBANG_SINYAL_LAMBAT_MS,
  AMBANG_TAWARKAN_GESER_MS,
  faseDariLama,
  sliderAktifPada,
  TEKS_FASE,
} from "@/components/PesanTransisi";

const AKAR = fileURLToPath(new URL("../../../../..", import.meta.url));

// ---------------------------------------------------------------------------
// 5.8 — validasi di batas sistem
// ---------------------------------------------------------------------------

describe("validasi rentang, bukan hanya tipe (5.8)", () => {
  it("menerima porsi yang wajar", () => {
    for (const nilai of ["1", "280", "296.19", "0.5"]) {
      expect(porsiTeks.safeParse(nilai).success).toBe(true);
    }
  });

  it("menolak porsi yang mustahil", () => {
    // Angka bertipe benar tapi mustahil secara fisik akan merusak perhitungan
    // di hilir tanpa ada yang tahu penyebabnya.
    for (const nilai of ["0", "-5", "999999", "12.345", "abc", ""]) {
      expect(porsiTeks.safeParse(nilai).success).toBe(false);
    }
  });

  it("porsi hasil koreksi boleh nol — 'ternyata habis' itu sah", () => {
    expect(porsiTeksBolehNol.safeParse("0").success).toBe(true);
    expect(porsiTeks.safeParse("0").success).toBe(false);
  });

  it("fraksi dibatasi 0..1 dengan empat desimal", () => {
    for (const nilai of ["0", "1", "0.45", "0.4500"]) {
      expect(fraksiTeks.safeParse(nilai).success).toBe(true);
    }
    for (const nilai of ["1.3", "-0.1", "0.45678", "50%"]) {
      expect(fraksiTeks.safeParse(nilai).success).toBe(false);
    }
  });

  it("tanggal harus ada di kalender", () => {
    expect(tanggalTeks.safeParse("2026-08-15").success).toBe(true);
    // 31 Februari lolos regex tapi tidak ada di kalender.
    expect(tanggalTeks.safeParse("2026-02-31").success).toBe(false);
    expect(tanggalTeks.safeParse("1899-01-01").success).toBe(false);
    expect(tanggalTeks.safeParse("15-08-2026").success).toBe(false);
  });

  it("pesan validasi berbahasa manusia, bukan bahasa Zod", () => {
    const hasil = porsiTeks.safeParse("");
    expect(hasil.success).toBe(false);
    if (hasil.success) return;
    const pesan = hasil.error.issues[0]?.message ?? "";
    expect(pesan).not.toMatch(/invalid|string|regex/i);
  });
});

// ---------------------------------------------------------------------------
// 5.17 — pencatatan mundur tanpa hukuman
// ---------------------------------------------------------------------------

describe("pencatatan mundur (5.17)", () => {
  it("diterima tanpa syarat tambahan", () => {
    const hasil = skemaCatatanBaru.safeParse({
      tanggal: "2026-08-10",
      porsiDimasak: "280",
      dicatatMundur: true,
    });
    expect(hasil.success).toBe(true);
  });

  it("bawaan `false` bila tidak disebut — tidak ada yang dipaksa mengaku", () => {
    const hasil = skemaCatatanBaru.parse({ tanggal: "2026-08-15", porsiDimasak: "280" });
    expect(hasil.dicatatMundur).toBe(false);
  });

  it("TIDAK ADA kata hukuman di seluruh alur pencatatan", () => {
    /*
     * "Streak hilang", "terlambat", "lupa mencatat" — semuanya membuat
     * pencatatan terasa seperti kewajiban yang bisa dilanggar. Operator yang
     * lupa mencatat kemarin sedang sibuk memasak.
     */
    const berkas = [
      "src/app/(operator)/catat/LayarPorsiDimasak.tsx",
      "src/app/(operator)/catat/[id]/LayarPencatatan.tsx",
      "src/app/api/_lib/skema.ts",
    ];
    const dilarang = /\b(streak|terlambat|telat|lalai|lupa mencatat|denda)\b/i;

    for (const jalur of berkas) {
      const isi = readFileSync(`${AKAR}/${jalur}`, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
      expect(dilarang.test(isi), `${jalur} memuat kata hukuman`).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// 5.15 — teks transisi timeout
// ---------------------------------------------------------------------------

describe("teks transisi timeout, persis seperti spesifikasi (5.15)", () => {
  it("0–1,5 detik: Membaca foto…", () => {
    expect(faseDariLama(0)).toBe("membaca");
    expect(faseDariLama(1_499)).toBe("membaca");
    expect(TEKS_FASE.membaca).toBe("Membaca foto…");
  });

  it("1,5–6 detik: menawarkan geser sebagai PILIHAN", () => {
    expect(faseDariLama(AMBANG_TAWARKAN_GESER_MS)).toBe("masih_membaca");
    expect(faseDariLama(5_999)).toBe("masih_membaca");
    expect(TEKS_FASE.masih_membaca).toBe("Masih membaca… atau geser sendiri di bawah");
    // Kata "atau" yang menanggung seluruh beban kalimat ini.
    expect(TEKS_FASE.masih_membaca).toContain("atau");
  });

  it("lebih dari 6 detik: menyebut penyebab dan menjamin mutunya", () => {
    expect(faseDariLama(AMBANG_SINYAL_LAMBAT_MS)).toBe("sinyal_lambat");
    expect(TEKS_FASE.sinyal_lambat).toBe(
      "Sinyal lambat — pakai geser saja, hasilnya sama.",
    );
    // Tanpa "hasilnya sama", operator mengira dia menerima hasil kelas dua.
    expect(TEKS_FASE.sinyal_lambat).toContain("hasilnya sama");
  });

  it("SLIDER AKTIF SEJAK DETIK 1,5, bukan sejak model menyerah", () => {
    // Ini yang membedakan "pilihan" dari "kerusakan" (BLUEPRINT P4).
    expect(sliderAktifPada("membaca")).toBe(false);
    expect(sliderAktifPada("masih_membaca")).toBe(true);
    expect(sliderAktifPada("sinyal_lambat")).toBe(true);
  });

  it("tidak ada kata kegagalan di ketiga kalimat", () => {
    for (const teks of Object.values(TEKS_FASE)) {
      expect(teks.toLowerCase()).not.toMatch(/gagal|error|timeout|coba lagi/);
    }
  });
});

// ---------------------------------------------------------------------------
// 5.18 — hitungan ketukan jalur normal
// ---------------------------------------------------------------------------

describe("hitungan ketukan jalur normal (5.18)", () => {
  /*
   * Hitungan ini diambil dari kode, bukan dari niat. Setiap baris menunjuk
   * elemen yang benar-benar ada di `LayarPencatatan.tsx`.
   */
  const JALUR_NORMAL = [
    { ketukan: 1, tindakan: "Pilih wadah (kartu berfoto)", detik: 3 },
    { ketukan: 1, tindakan: "Pilih jenis masakan (chip)", detik: 2 },
    { ketukan: 1, tindakan: "Rana kamera", detik: 4 },
    { ketukan: 0, tindakan: "Menunggu estimasi muncul (bukan ketukan)", detik: 3 },
    { ketukan: 1, tindakan: 'Tombol "Benar" (atau geser lalu "Simpan")', detik: 5 },
    { ketukan: 1, tindakan: 'Tombol "Selesai" lalu pilih penyaluran', detik: 2 },
  ];

  it("tepat 5 ketukan", () => {
    const total = JALUR_NORMAL.reduce((n, l) => n + l.ketukan, 0);
    expect(total).toBe(5);
    expect(total).toBeLessThanOrEqual(5);
  });

  it("perkiraan waktu di bawah 20 detik", () => {
    const total = JALUR_NORMAL.reduce((n, l) => n + l.detik, 0);
    expect(total).toBe(19);
    expect(total).toBeLessThanOrEqual(20);
  });

  it("jalur geser memakai jumlah ketukan yang SAMA dengan jalur foto", () => {
    /*
     * Inilah yang membuat slider setara. Kalau jalur geser butuh navigasi
     * tambahan — buka menu, pindah layar — ia menjadi jalur kelas dua meski
     * hasil angkanya identik.
     *
     * Di layar 3, slider dirender bersama kamera, bukan menggantikannya.
     */
    const layar = readFileSync(
      `${AKAR}/src/app/(operator)/catat/[id]/LayarPencatatan.tsx`,
      "utf8",
    );

    expect(layar).toContain("<SliderFraksi");
    expect(layar).toContain("<BingkaiKamera");
    // Keduanya di cabang yang sama — slider tidak menunggu kamera gagal.
    const posisiKamera = layar.indexOf("<BingkaiKamera");
    const posisiSlider = layar.indexOf("<SliderFraksi");
    const posisiKartu = layar.indexOf("<KartuEstimasi");
    expect(posisiKamera).toBeGreaterThan(0);
    expect(posisiSlider).toBeGreaterThan(posisiKamera);
    expect(posisiKartu).toBeGreaterThan(posisiSlider);
  });

  it("TIDAK ADA langkah konfirmasi tambahan di alur", () => {
    // Setiap "Yakin?" menggandakan ketukan pada langkah yang dijaganya.
    const berkas = [
      "src/app/(operator)/catat/[id]/LayarPencatatan.tsx",
      "src/app/(operator)/catat/[id]/penyaluran/LayarPenyaluran.tsx",
      "src/components/KartuPenyaluran.tsx",
    ];
    for (const jalur of berkas) {
      const isi = readFileSync(`${AKAR}/${jalur}`, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
      expect(/yakin\?|konfirmasi|apakah anda/i.test(isi), jalur).toBe(false);
    }
  });

  it("input angka TIDAK memakai keyboard sistem", () => {
    /*
     * Keyboard sistem memakan separuh layar 360 px, menampilkan huruf dan
     * emoji untuk field yang hanya menerima angka, dan tombolnya terlalu kecil
     * untuk tangan yang basah.
     */
    const layar = readFileSync(
      `${AKAR}/src/app/(operator)/catat/LayarPorsiDimasak.tsx`,
      "utf8",
    );
    expect(layar).toContain("<PapanTombolNumerik");
    expect(layar).not.toMatch(/type="number"|inputMode="numeric"/);
  });

  it("tombol Benar dan Koreksi berukuran sama", () => {
    /*
     * Koreksi bukan tindakan menyimpang. Tombol yang lebih kecil akan membuat
     * operator menekan "Benar" pada angka yang dia tahu salah — dan jejak
     * koreksi itulah bahan mentah kalibrasi.
     */
    const kartu = readFileSync(`${AKAR}/src/components/KartuEstimasi.tsx`, "utf8");
    expect(kartu).toContain("grid-cols-2");

    const tinggi = [...kartu.matchAll(/h-14/g)];
    expect(tinggi.length).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// Skema endpoint lain
// ---------------------------------------------------------------------------

describe("skema endpoint", () => {
  it("estimasi manual menerima fraksi sebagai teks", () => {
    const hasil = skemaEstimasiManual.safeParse({
      wadahId: "w1",
      jenisMasakanId: "j1",
      fraksiKeterisian: "0.4500",
    });
    expect(hasil.success).toBe(true);
    if (hasil.success) expect(hasil.data.isCampuran).toBe(false);
  });

  it("koreksi bawaannya peran operator", () => {
    const hasil = skemaKoreksi.parse({ porsiSesudah: "24.00" });
    expect(hasil.peranPengoreksi).toBe("operator");
  });

  it("penyaluran hanya menerima tiga tujuan", () => {
    for (const tujuan of ["ternak", "kompos", "tpa"]) {
      expect(skemaPenyaluran.safeParse({ tujuan }).success).toBe(true);
    }
    expect(skemaPenyaluran.safeParse({ tujuan: "dibuang" }).success).toBe(false);
  });

  it("anomali MEWAJIBKAN alasan", () => {
    // Satu-satunya kewajiban di seluruh alur. Pengecualian yang bertahan dua
    // minggu harus bisa dijelaskan kembali.
    expect(skemaAnomali.safeParse({ alasan: "Acara haul" }).success).toBe(true);
    expect(skemaAnomali.safeParse({ alasan: "" }).success).toBe(false);
    expect(skemaAnomali.safeParse({}).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Aturan 5 — angka rupiah tidak boleh tertukar dengan angka klaim
// ---------------------------------------------------------------------------

describe("rentang rupiah ditandai sebagai angka operasional", () => {
  it("selalu membawa penanda bahwa ia BUKAN bahan klaim", () => {
    /*
     * CLAUDE.md aturan 5: angka dampak hanya dari `penimbangan_referensi`.
     * Angka ini dihitung dari estimasi, jadi penandanya ikut di setiap respons
     * supaya kode di hilir tidak bisa memakainya tanpa melihat peringatannya.
     */
    const hasil = hitungRentangRupiah(porsiDariString("30.00"), 450_000, 620_000);

    expect(hasil.sumber).toBe("estimasi_operasional");
    expect(hasil.bolehUntukKlaim).toBe(false);
  });

  it("dihitung dengan bilangan bulat sen", () => {
    expect(keSen({ toString: () => "4500.00" })).toBe(450_000);
    expect(keSen({ toString: () => "6200.50" })).toBe(620_050);
    expect(keSen({ toString: () => "12" })).toBe(1_200);
  });

  it("rentangnya naik seiring porsi", () => {
    const kecil = hitungRentangRupiah(porsiDariString("10.00"), 450_000, 620_000);
    const besar = hitungRentangRupiah(porsiDariString("30.00"), 450_000, 620_000);

    expect(Number(besar.bawah)).toBeGreaterThan(Number(kecil.bawah));
    expect(Number(besar.atas)).toBeGreaterThan(Number(besar.bawah));
  });
});
