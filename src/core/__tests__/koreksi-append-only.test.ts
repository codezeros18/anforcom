import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/*
 * PENJAGA ATURAN 2 DI TINGKAT BASIS KODE.
 *
 * DoD Sprint 3: "tidak ada operasi update atau delete pada tabel `koreksi` di
 * seluruh basis kode."
 *
 * Tes unit di `audit.test.ts` membuktikan `catatKoreksi()` tidak menimpa apa
 * pun. Tapi aturan ini bisa dilanggar dari tempat lain — satu `db.koreksi.
 * update(...)` di route handler Sprint 5 sudah cukup untuk menghapus jejak yang
 * dibutuhkan halaman Akurasi, dan tidak ada tes unit yang akan menangkapnya.
 *
 * Karena itu penjaga ini memindai berkas sumber, bukan memanggil fungsi.
 */

const AKAR = fileURLToPath(new URL("../../..", import.meta.url));
const FOLDER_DIPINDAI = ["src", "prisma"];

/** Operasi Prisma yang mengubah atau menghapus baris. */
const OPERASI_TERLARANG = [
  "update",
  "updateMany",
  "updateManyAndReturn",
  "upsert",
  "delete",
  "deleteMany",
];

function kumpulkanBerkas(direktori: string): string[] {
  const hasil: string[] = [];
  for (const entri of readdirSync(direktori)) {
    if (entri === "node_modules" || entri === "migrations") continue;
    const jalur = join(direktori, entri);
    if (statSync(jalur).isDirectory()) {
      hasil.push(...kumpulkanBerkas(jalur));
      continue;
    }
    if (/\.(ts|tsx|mts|js|mjs)$/.test(entri)) hasil.push(jalur);
  }
  return hasil;
}

const BERKAS = FOLDER_DIPINDAI.flatMap((f) => kumpulkanBerkas(join(AKAR, f)));

describe("tabel koreksi hanya menerima INSERT", () => {
  it("menemukan berkas untuk dipindai", () => {
    // Tanpa ini, penjaga bisa hijau hanya karena tidak memeriksa apa pun.
    expect(BERKAS.length).toBeGreaterThan(5);
  });

  it.each(OPERASI_TERLARANG)(
    "tidak ada pemanggilan `koreksi.%s(` di mana pun",
    (operasi) => {
      const pola = new RegExp(`koreksi\\s*\\.\\s*${operasi}\\s*\\(`, "i");
      const pelanggar: string[] = [];

      for (const jalur of BERKAS) {
        // Berkas tes ini sendiri memuat nama operasi sebagai data, bukan sebagai
        // pemanggilan. Ia dilewati supaya tidak menuduh dirinya sendiri.
        if (jalur.endsWith("koreksi-append-only.test.ts")) continue;
        if (pola.test(readFileSync(jalur, "utf8"))) {
          pelanggar.push(jalur.slice(AKAR.length));
        }
      }

      expect(pelanggar).toEqual([]);
    },
  );

  it("modul audit tidak mengekspor fungsi yang namanya menjanjikan perubahan", async () => {
    /*
     * Nama fungsi adalah dokumentasi yang paling sering dibaca. `ubahKoreksi`
     * atau `hapusKoreksi` yang diekspor akan mengundang pemakaian yang melanggar
     * aturan, bahkan sebelum implementasinya ditulis.
     */
    const audit = await import("../audit.ts");
    const namaTerlarang = Object.keys(audit).filter((nama) =>
      /^(ubah|perbarui|hapus|timpa)/i.test(nama),
    );
    expect(namaTerlarang).toEqual([]);
  });
});
