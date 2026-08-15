import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    // Seluruh tes proyek ini adalah tes unit murni terhadap /src/core dan
    // /src/lib. Tidak ada tes DOM, jadi environment `node` cukup dan lebih
    // cepat. Bila nanti benar-benar perlu DOM, catat alasannya di PROGRESS.md
    // sebelum menambah jsdom.
    environment: "node",
    include: ["src/**/__tests__/**/*.test.ts", "src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
