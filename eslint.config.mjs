import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,

  /*
   * Batas impor `/src/core` — CLAUDE.md bagian 3 aturan 4.
   *
   * `/core` adalah logika domain murni. Ia tidak boleh tahu apa pun tentang
   * model penglihatan maupun tentang React. Inilah yang membuat klaim "model
   * bisa dicabut tanpa mematikan sistem" bisa dibuktikan alat, bukan dijanjikan
   * lewat disiplin.
   *
   * Aturan ini wajib GAGAL bila dilanggar. Jangan turunkan ke "warn".
   */
  {
    files: ["src/core/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/vision", "**/vision/**", "@/vision", "@/vision/**"],
              message:
                "/src/core tidak boleh mengimpor dari /src/vision. Arah impor satu jalan: app -> core, app -> vision.",
            },
            {
              group: [
                "react",
                "react-dom",
                "react/**",
                "react-dom/**",
                "next",
                "next/**",
              ],
              message:
                "/src/core adalah logika domain murni. Tidak boleh mengimpor React, Next, atau apa pun dari lapisan UI.",
            },
          ],
        },
      ],
    },
  },

  /*
   * `/src/vision` tidak mengimpor ke mana-mana selain dirinya sendiri dan
   * pustaka luar. Ia tidak boleh menarik `/core` maupun `/app` ke dalamnya.
   */
  {
    files: ["src/vision/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "**/core",
                "**/core/**",
                "@/core",
                "@/core/**",
                "@/app",
                "@/app/**",
              ],
              message:
                "/src/vision tidak mengimpor dari lapisan lain. Ia hanya menyediakan antarmuka pembaca fraksi.",
            },
          ],
        },
      ],
    },
  },

  globalIgnores([".next/**", "out/**", "build/**", "coverage/**", "next-env.d.ts"]),
]);

export default eslintConfig;
