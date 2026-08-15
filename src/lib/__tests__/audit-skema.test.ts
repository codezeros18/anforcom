import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/*
 * AUDIT SKEMA — CLAUDE.md bagian 3 aturan 1.
 *
 * "Tidak ada kolom, kueri, ekspor, atau tampilan yang memuat identitas orang."
 *
 * Ini tugas 1.6, dan sengaja ditulis sebagai TES, bukan sebagai pemeriksaan
 * mata satu kali yang hasilnya dicatat di PROGRESS.md lalu dilupakan. Skema
 * akan tumbuh di sprint-sprint berikutnya oleh tiga agen yang bekerja paralel;
 * pemeriksaan sekali di Sprint 1 tidak melindungi kolom yang ditambahkan di
 * Sprint 6.
 *
 * Alasan aturannya, supaya tidak ada yang tergoda melonggarkannya: ketakutan
 * terbesar operator adalah datanya dipakai untuk memarahi dia. Sistem yang bisa
 * menjawab "siapa yang mencatat sisa terbanyak bulan ini" akan dipakai persis
 * untuk itu, terlepas dari niat siapa pun yang membangunnya. Satu-satunya
 * jaminan yang bertahan adalah data itu tidak pernah ada.
 */

const SKEMA = readFileSync(
  fileURLToPath(new URL("../../../prisma/schema.prisma", import.meta.url)),
  "utf8",
);

/** Baris definisi field saja — komentar dan blok enum tidak ikut. */
function bacaNamaField(skema: string): string[] {
  const field: string[] = [];
  for (const barisMentah of skema.split("\n")) {
    const baris = barisMentah.trim();
    if (baris === "" || baris.startsWith("//") || baris.startsWith("///")) continue;
    if (baris.startsWith("@@") || baris.startsWith("}")) continue;

    // Bentuk field Prisma: `namaField  Tipe  ...`
    const cocok = /^([a-zA-Z][a-zA-Z0-9_]*)\s+[A-Z]/.exec(baris);
    if (cocok?.[1]) field.push(cocok[1]);
  }
  return field;
}

const NAMA_FIELD = bacaNamaField(SKEMA);

describe("audit skema — tidak ada identitas orang", () => {
  it("berhasil membaca field dari schema.prisma", () => {
    // Kalau parser gagal, seluruh tes di bawah akan hijau palsu karena tidak
    // ada yang diperiksa.
    expect(NAMA_FIELD.length).toBeGreaterThan(40);
  });

  /*
   * Kata yang menandakan identitas orang. `nama` sendiri TIDAK dilarang —
   * `dapur.nama`, `wadah.nama`, dan `jenisMasakan.nama` adalah nama benda dan
   * tempat, bukan orang. Yang dilarang adalah kata yang hanya masuk akal untuk
   * manusia.
   */
  const KATA_TERLARANG = [
    "namaOperator",
    "namaPengelola",
    "namaPencatat",
    "namaPengguna",
    "namaLengkap",
    "userId",
    "penggunaId",
    "operatorId",
    "pengelolaId",
    "pencatatId",
    "pengoreksiId",
    "email",
    "telepon",
    "noHp",
    "nomorHp",
    "whatsapp",
    "nik",
    "alamat",
    "fotoProfil",
    "avatar",
    "createdBy",
    "dibuatOleh",
    "diubahOleh",
    "pemilik",
    "karyawan",
    "staf",
    "akun",
    "sandi",
    "password",
  ];

  it.each(KATA_TERLARANG)("tidak ada field bernama `%s`", (terlarang) => {
    const cocok = NAMA_FIELD.filter((f) => f.toLowerCase() === terlarang.toLowerCase());
    expect(cocok).toEqual([]);
  });

  it("tidak ada field yang berakhiran `Oleh` selain `diukurOleh` (yang bertipe peran)", () => {
    /*
     * `diukurOleh` adalah pengecualian yang disengaja: tipenya enum
     * `DiukurOleh` yang hanya punya satu nilai, `tim_riset`. Ia menyatakan
     * KATEGORI pengukur, bukan orangnya — dan enum satu nilai itu justru yang
     * menegakkan aturan bahwa angka dampak hanya boleh dari timbangan tim.
     */
    const berakhiranOleh = NAMA_FIELD.filter((f) => /Oleh$/.test(f));
    expect(berakhiranOleh).toEqual(["diukurOleh"]);
  });

  it("setiap atribusi memakai tipe enum peran, bukan teks bebas", () => {
    /*
     * Ini penjaga yang paling penting. Kolom bertipe String bernama
     * `peranPencatat` akan lolos semua tes di atas, lalu perlahan terisi nama
     * orang karena tidak ada yang mencegahnya. Tipe enum membuat basis data
     * sendiri yang menolak.
     */
    const barisAtribusi = SKEMA.split("\n")
      .map((b) => b.trim())
      .filter((b) => /^peran[A-Z]/.test(b));

    expect(barisAtribusi.length).toBeGreaterThanOrEqual(3);
    for (const baris of barisAtribusi) {
      expect(baris).toMatch(/^peran[A-Za-z]*\s+(Peran|PeranPenebak)\b/);
    }
  });

  it("tidak ada model bernama pengguna, akun, atau sejenisnya", () => {
    const namaModel = [...SKEMA.matchAll(/^model\s+([A-Za-z0-9_]+)\s*\{/gm)].map(
      (m) => m[1]!,
    );

    expect(namaModel.length).toBeGreaterThan(5);
    for (const model of namaModel) {
      expect(model.toLowerCase()).not.toMatch(
        /^(user|pengguna|akun|account|orang|person|karyawan|staf|profil)$/,
      );
    }
  });
});

describe("audit skema — presisi angka", () => {
  /*
   * CLAUDE.md aturan 3. Float membuat total bergantung pada urutan penjumlahan,
   * dan angka yang tidak bisa direproduksi tidak bisa dipertanggungjawabkan di
   * depan orang yang anggarannya kita hitung.
   */
  it("tidak ada Float atau Double di seluruh skema", () => {
    const barisFloat = SKEMA.split("\n")
      .map((b) => b.trim())
      .filter((b) => !b.startsWith("//"))
      .filter((b) => /\b(Float|Double)\b/.test(b));

    expect(barisFloat).toEqual([]);
  });

  it("berat disimpan sebagai Int gram, bukan desimal kilogram", () => {
    expect(SKEMA).toMatch(/beratGram\s+Int/);
    expect(SKEMA).toMatch(/beratWadahKosongGram\s+Int/);
  });

  it("uang memakai Decimal(12,2)", () => {
    const barisUang = SKEMA.split("\n").filter((b) => /biayaBahanPerPorsi/.test(b));
    expect(barisUang.length).toBe(2);
    for (const baris of barisUang) {
      expect(baris).toMatch(/@db\.Decimal\(12, 2\)/);
    }
  });

  it("porsi memakai Decimal(8,2) dan fraksi Decimal(5,4)", () => {
    expect(SKEMA).toMatch(
      /porsiPenuh\s+Decimal\s+@map\("porsi_penuh"\) @db\.Decimal\(8, 2\)/,
    );
    expect(SKEMA).toMatch(
      /fraksiKeterisian\s+Decimal\s+@map\("fraksi_keterisian"\) @db\.Decimal\(5, 4\)/,
    );
  });
});

describe("audit skema — jaminan struktural", () => {
  it("kalibrasi dikunci unik per pasangan wadah x jenis masakan", () => {
    // Inilah yang membuat "kalibrasi dua dimensi" menjadi jaminan basis data,
    // bukan konvensi yang bisa dilanggar kode.
    expect(SKEMA).toMatch(/@@unique\(\[wadahId, jenisMasakanId\]\)/);
  });

  it("catatan harian dikunci unik per dapur per tanggal", () => {
    expect(SKEMA).toMatch(/@@unique\(\[dapurId, tanggal\]\)/);
  });

  it("indeks yang diminta Sprint 1.4 semuanya ada", () => {
    expect(SKEMA).toMatch(/@@index\(\[dapurId, tanggal\(sort: Desc\)\]\)/);
    expect(SKEMA).toMatch(/@@index\(\[dapurId, isAnomali\]\)/);
    expect(SKEMA).toMatch(/@@index\(\[dapurId, aktif\]\)/);
    expect(SKEMA).toMatch(/@@index\(\[estimasiId\]\)/);
  });
});
