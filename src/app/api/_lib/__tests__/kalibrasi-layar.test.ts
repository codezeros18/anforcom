import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { skemaJenisMasakanBaru, skemaKalibrasiBaru, skemaWadahBaru } from "../skema";
import {
  teksBadge,
  TEKS_BELUM_TERKALIBRASI,
  TEKS_KONSTANTA_PINJAMAN,
} from "@/components/BadgeSumberKalibrasi";
import {
  ALASAN_PENOLAKAN,
  PESAN_PENOLAKAN,
} from "@/components/PenolakanWadahTakTerdaftar";

const AKAR = fileURLToPath(new URL("../../../../..", import.meta.url));
const LAYAR_DAFTAR = `${AKAR}/src/app/(kalibrasi)/wadah/baru/LayarPendaftaranWadah.tsx`;

function tanpaKomentar(jalur: string): string {
  return readFileSync(jalur, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

// ---------------------------------------------------------------------------
// 6.1 — skema pendaftaran
// ---------------------------------------------------------------------------

describe("skema pendaftaran (6.1)", () => {
  it("wadah menerima nama bebas dan bentuk dari daftar ikon", () => {
    const hasil = skemaWadahBaru.safeParse({ nama: "panci besar", bentuk: "panci" });
    expect(hasil.success).toBe(true);
  });

  it("menolak bentuk di luar daftar", () => {
    expect(skemaWadahBaru.safeParse({ nama: "x", bentuk: "tabung" }).success).toBe(false);
  });

  it("TIDAK ADA bidang dimensi di skema mana pun", () => {
    /*
     * Larangan paling penting di sprint ini. Operator tidak tahu diameter
     * pancinya dan tidak akan mengukurnya; pertanyaan itu akan menghentikan
     * pendaftaran di wadah pertama.
     *
     * Diuji pada bentuk skemanya, bukan pada niat: bidang yang tidak ada di
     * skema tidak bisa diminta layar mana pun.
     */
    const bidangTerlarang = [
      "diameter",
      "tinggi",
      "lebar",
      "volume",
      "liter",
      "cm",
      "sentimeter",
      "kapasitasMl",
    ];

    for (const bidang of bidangTerlarang) {
      const hasil = skemaWadahBaru.safeParse({
        nama: "panci",
        bentuk: "panci",
        [bidang]: 30,
      });
      // Zod membuang bidang tak dikenal; yang penting ia tidak pernah menjadi
      // bagian dari data yang tersimpan.
      if (hasil.success) {
        expect(Object.keys(hasil.data)).not.toContain(bidang);
      }
    }
  });

  it("layar pendaftaran tidak pernah menanyakan ukuran", () => {
    const isi = tanpaKomentar(LAYAR_DAFTAR);
    expect(/diameter|sentimeter|\bcm\b|berapa liter/i.test(isi)).toBe(false);
  });

  it("kalibrasi meminta porsi, bukan ukuran", () => {
    const hasil = skemaKalibrasiBaru.safeParse({
      wadahId: "w1",
      jenisMasakanId: "j1",
      porsiPenuh: "120",
    });
    expect(hasil.success).toBe(true);
    if (hasil.success)
      expect(Object.keys(hasil.data)).toEqual([
        "wadahId",
        "jenisMasakanId",
        "porsiPenuh",
      ]);
  });

  it("kalibrasi menolak porsi nol atau negatif", () => {
    // Konstanta nol akan membuat setiap estimasi menjadi nol tanpa penjelasan.
    for (const nilai of ["0", "-10", ""]) {
      expect(
        skemaKalibrasiBaru.safeParse({
          wadahId: "w",
          jenisMasakanId: "j",
          porsiPenuh: nilai,
        }).success,
      ).toBe(false);
    }
  });

  it("jenis masakan mewajibkan kategori fisik", () => {
    // Kategori fisik yang menentukan lebar rentang keyakinan; tanpa itu,
    // rentangnya akan memakai bawaan yang salah untuk sebagian besar masakan.
    expect(
      skemaJenisMasakanBaru.safeParse({ nama: "Nasi", kategoriFisik: "padat_menggunung" })
        .success,
    ).toBe(true);
    expect(skemaJenisMasakanBaru.safeParse({ nama: "Nasi" }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 6.2 / 6.3 — alur lima langkah
// ---------------------------------------------------------------------------

describe("alur lima langkah (6.2, 6.3)", () => {
  const isi = readFileSync(LAYAR_DAFTAR, "utf8");

  it("tepat lima langkah, tidak lebih", () => {
    expect(isi).toContain("const TOTAL_LANGKAH = 5;");
    // Tidak ada langkah 6 di mana pun.
    expect(/langkah === 6|langkah: 6/.test(isi)).toBe(false);
  });

  it("pertanyaan konstanta memakai kalimat dari BLUEPRINT", () => {
    // Bentuk pertanyaannya penting: ia menanyakan sesuatu yang operator TAHU,
    // bukan sesuatu yang harus dia ukur.
    expect(isi).toContain("penuh berisi");
    expect(isi).toContain("kira-kira berapa porsi?");
  });

  it("maksimal tiga jenis masakan per wadah", () => {
    expect(isi).toContain("const MAKS_JENIS = 3;");
  });

  it("memakai papan tombol numerik, bukan keyboard sistem", () => {
    expect(isi).toContain("<PapanTombolNumerik");
    expect(/type="number"|inputMode="numeric"/.test(isi)).toBe(false);
  });

  it("indikator progres terlihat di setiap langkah", () => {
    expect(isi).toContain("<IndikatorLangkah");
    expect(isi).toContain("total={TOTAL_LANGKAH}");
  });

  it("draf disimpan tanpa operator menekan apa pun (6.3)", () => {
    /*
     * Operator yang dipanggil ke dapur di tengah pendaftaran menutup HP-nya
     * begitu saja — tidak ada tombol "simpan draf" yang akan dia tekan lebih
     * dulu. Penyimpanan harus terjadi sebagai efek samping setiap perubahan.
     */
    expect(isi).toContain("localStorage.setItem(KUNCI_DRAF");
    expect(isi).toContain("useSyncExternalStore");
    // Dibersihkan saat selesai, supaya pendaftaran berikutnya mulai dari nol.
    expect(isi).toContain("localStorage.removeItem(KUNCI_DRAF)");
  });

  it("foto boleh dilewati", () => {
    // Memaksanya akan menggantung pendaftaran di dapur yang kameranya bermasalah.
    expect(isi).toContain("Lewati foto");
  });
});

// ---------------------------------------------------------------------------
// 6.4 — badge sumber kalibrasi
// ---------------------------------------------------------------------------

describe("badge sumber kalibrasi (6.4)", () => {
  it("tampil saat sumber masih deklarasi", () => {
    expect(teksBadge("deklarasi")).toBe(TEKS_BELUM_TERKALIBRASI);
    expect(TEKS_BELUM_TERKALIBRASI).toBe(
      "Belum terkalibrasi — angka akan membaik setelah beberapa koreksi.",
    );
  });

  it("HILANG setelah terkalibrasi", () => {
    // Badge yang menetap selamanya berhenti dibaca dalam seminggu.
    expect(teksBadge("terkalibrasi")).toBeNull();
  });

  it("tetap tampil untuk konstanta pinjaman meski sudah terkalibrasi", () => {
    expect(teksBadge("terkalibrasi", true)).toBe(TEKS_KONSTANTA_PINJAMAN);
  });

  it("kalimatnya menjanjikan perbaikan, bukan menyatakan kekurangan", () => {
    /*
     * "angka akan membaik setelah beberapa koreksi" memberi tahu bahwa
     * mengoreksi ada gunanya — dan koreksi itulah bahan mentah kalibrasi.
     * Badge ini bukan sekadar label; ia mengundang perilaku yang membuat
     * sistemnya membaik.
     */
    expect(TEKS_BELUM_TERKALIBRASI).toContain("akan membaik");
    expect(TEKS_BELUM_TERKALIBRASI.toLowerCase()).not.toMatch(
      /tidak akurat|salah|jangan dipercaya|buruk/,
    );
  });

  it("badge berwarna abu-abu, bukan merah atau kuning peringatan", () => {
    // Ini keterangan keadaan, bukan peringatan kesalahan.
    const komponen = readFileSync(
      `${AKAR}/src/components/BadgeSumberKalibrasi.tsx`,
      "utf8",
    );
    expect(komponen).toContain("bg-netral-100");
    expect(/bg-(red|rose|amber|yellow)-/.test(komponen)).toBe(false);
  });

  it("layar estimasi meneruskan sumber apa adanya, tidak merakit kalimatnya sendiri", () => {
    // Kalau layar merakit kalimatnya sendiri, akan ada dua versi teks badge
    // yang menyimpang pelan-pelan.
    const layar = readFileSync(`${AKAR}/src/components/KartuEstimasi.tsx`, "utf8");
    expect(layar).toContain("<BadgeSumberKalibrasi");
    expect(layar).not.toContain("Belum terkalibrasi —");
  });
});

// ---------------------------------------------------------------------------
// 6.5 — penolakan wadah tak terdaftar
// ---------------------------------------------------------------------------

describe("penolakan wadah tak terdaftar (6.5)", () => {
  it("kalimatnya persis seperti BLUEPRINT", () => {
    expect(PESAN_PENOLAKAN).toBe("Wadah ini belum terdaftar di dapur ini.");
    expect(ALASAN_PENOLAKAN).toBe(
      "Sistem hanya membaca wadah yang sudah dikalibrasi, supaya angkanya bisa dipertanggungjawabkan.",
    );
  });

  it("menjelaskan KENAPA sistem menolak", () => {
    /*
     * Tanpa kalimat kedua, penolakan terbaca sebagai kekurangan produk. Dengan
     * itu, ia terbaca sebagai kehati-hatian yang menguntungkan operator.
     */
    expect(ALASAN_PENOLAKAN).toContain("dipertanggungjawabkan");
  });

  it("menawarkan DUA jalan keluar, bukan jalan buntu", () => {
    const komponen = readFileSync(
      `${AKAR}/src/components/PenolakanWadahTakTerdaftar.tsx`,
      "utf8",
    );
    expect(komponen).toContain("Daftarkan wadah — 1 menit");
    expect(komponen).toContain("Masukkan manual");
  });

  it("layar pencatatan menampilkannya saat server menolak", () => {
    const layar = readFileSync(
      `${AKAR}/src/app/(operator)/catat/[id]/LayarPencatatan.tsx`,
      "utf8",
    );
    expect(layar).toContain("<PenolakanWadahTakTerdaftar");
    expect(layar).toContain('kode === "WADAH_TIDAK_TERDAFTAR"');
  });

  it("SISTEM TIDAK PERNAH MENEBAK konstanta dari bentuk wadah", () => {
    /*
     * Godaan yang harus ditolak. Panci "sedang" bisa menampung 80 porsi nasi
     * atau 150 porsi sayur berkuah; menebaknya menghasilkan angka yang terlihat
     * berwibawa dan salah secara SISTEMATIS — dan kesalahan sistematis tidak
     * bisa ditambal koreksi.
     */
    const berkas = [
      `${AKAR}/src/app/api/wadah/route.ts`,
      `${AKAR}/src/app/api/kalibrasi/route.ts`,
      `${AKAR}/src/app/api/_lib/estimasi.ts`,
    ];
    for (const jalur of berkas) {
      const isi = tanpaKomentar(jalur);
      // Tidak ada tabel bentuk -> porsi di mana pun.
      expect(/panci\s*:\s*\d|nampan\s*:\s*\d|baskom\s*:\s*\d/.test(isi)).toBe(false);
    }
  });
});
