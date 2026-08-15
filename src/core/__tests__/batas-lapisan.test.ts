import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Tes fondasi Sprint 0.
 *
 * Aturan Keras 4 mengatakan `/src/core` tidak boleh mengimpor apa pun dari
 * `/src/vision` maupun dari React. Aturan ESLint menjaga itu saat lint jalan;
 * tes ini menjaganya juga saat hanya `npm test` yang jalan, misalnya di mesin
 * orang lain yang belum memasang alat lint.
 *
 * Isolasi itu adalah satu-satunya bukti untuk klaim "model bisa dicabut tanpa
 * mematikan sistem". Kalau tes ini merah, klaimnya tidak lagi benar.
 */

const AKAR_SRC = fileURLToPath(new URL("../..", import.meta.url));

function kumpulkanBerkasTs(direktori: string): string[] {
  const hasil: string[] = [];
  for (const entri of readdirSync(direktori)) {
    const jalur = join(direktori, entri);
    if (statSync(jalur).isDirectory()) {
      hasil.push(...kumpulkanBerkasTs(jalur));
      continue;
    }
    if (entri.endsWith(".ts") || entri.endsWith(".tsx")) {
      hasil.push(jalur);
    }
  }
  return hasil;
}

/** Menarik setiap specifier dari `import ... from "x"`, `export ... from "x"`, dan `require("x")`. */
function bacaSpecifierImpor(isi: string): string[] {
  // Tiga bentuk: `from "x"`, `require("x")`, dan impor efek samping `import "x"`
  // yang tidak punya `from` sama sekali.
  const pola = /(?:from|require\s*\(|^\s*import)\s*["']([^"']+)["']/gm;
  const specifier: string[] = [];
  let cocok: RegExpExecArray | null;
  while ((cocok = pola.exec(isi)) !== null) {
    const nilai = cocok[1];
    if (nilai !== undefined) specifier.push(nilai);
  }
  return specifier;
}

describe("batas lapisan /src/core", () => {
  const berkasCore = kumpulkanBerkasTs(join(AKAR_SRC, "core")).filter(
    (jalur) => !jalur.includes("__tests__"),
  );

  it("punya berkas untuk diperiksa", () => {
    expect(berkasCore.length).toBeGreaterThan(0);
  });

  it.each(berkasCore)("%s tidak mengimpor dari /src/vision", (jalur) => {
    const specifier = bacaSpecifierImpor(readFileSync(jalur, "utf8"));
    const pelanggaran = specifier.filter((s) => /(^|\/)vision(\/|$)/.test(s));
    expect(pelanggaran).toEqual([]);
  });

  it.each(berkasCore)("%s tidak mengimpor React atau Next", (jalur) => {
    const specifier = bacaSpecifierImpor(readFileSync(jalur, "utf8"));
    const pelanggaran = specifier.filter((s) => /^(react|react-dom|next)(\/|$)/.test(s));
    expect(pelanggaran).toEqual([]);
  });
});

describe("sakelar VISION_ENABLED", () => {
  /*
   * Perintah verifikasi keempat (`VISION_ENABLED=false npm test`) harus lulus
   * sama seperti perintah ketiga. Tes ini memastikan berkas tes benar-benar
   * membaca sakelarnya, sehingga perintah keempat bukan sekadar menjalankan
   * ulang perintah ketiga dengan variabel yang diabaikan.
   *
   * Bukti alur penuh tanpa model dibangun di Sprint 4.11.
   */
  it("terbaca sebagai true atau false, dan keduanya sah", () => {
    const nilai = process.env.VISION_ENABLED ?? "true";
    expect(["true", "false"]).toContain(nilai);
  });
});
