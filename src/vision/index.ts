import { buatManualProvider } from "./manual-provider.ts";
import { buatModelProvider, type OpsiModelProvider } from "./model-provider.ts";
import type { PembacaFraksi } from "./provider.ts";

export type {
  AlasanPerluManual,
  BacaanPerluManual,
  BacaanTerbaca,
  HasilBaca,
  KonteksPembacaan,
  PembacaFraksi,
} from "./provider.ts";
export { TIMEOUT_MODEL_MS } from "./provider.ts";
export { buatManualProvider } from "./manual-provider.ts";
export { buatModelProvider } from "./model-provider.ts";

/*
 * Pemilih provider.
 *
 * SATU SAKELAR, SATU BARIS. `VISION_ENABLED=false` di env Vercel menukar
 * seluruh lapisan penglihatan menjadi jalur manual dalam waktu kurang dari satu
 * menit, tanpa deploy ulang dan tanpa menyentuh kode. Itu bukan kemewahan
 * operasional — itu bentuk yang membuat klaim "model bisa dicabut" bisa
 * ditunjukkan di depan orang, bukan dijelaskan.
 */

/**
 * Apakah model penglihatan aktif.
 *
 * Bawaan: AKTIF. Hanya string `"false"` yang mematikannya — variabel yang salah
 * ketik tidak boleh diam-diam mematikan model dan membuat seluruh dapur
 * mengira sistemnya rusak.
 */
export function modelPenglihatanAktif(env: PetaEnv = process.env): boolean {
  return (env.VISION_ENABLED ?? "true").trim().toLowerCase() !== "false";
}

/**
 * Bentuk minimal env yang dibutuhkan.
 *
 * Sengaja BUKAN `NodeJS.ProcessEnv`: tipe itu mewajibkan field seperti
 * `NODE_ENV` ada, sehingga setiap pemanggil yang ingin menguji satu variabel
 * saja terpaksa menulis cast. Cast di tes adalah tempat bug bersembunyi.
 */
export type PetaEnv = Record<string, string | undefined>;

/**
 * Mengembalikan provider yang sesuai keadaan lingkungan.
 *
 * Pemanggil tidak perlu tahu mana yang didapat — itu inti dari antarmuka
 * `PembacaFraksi`. Alur pencatatan di `/src/app` berjalan sama persis untuk
 * keduanya.
 */
export function ambilPembacaFraksi(
  opsi: OpsiModelProvider & { env?: PetaEnv } = {},
): PembacaFraksi {
  const { env, ...opsiModel } = opsi;
  return modelPenglihatanAktif(env) ? buatModelProvider(opsiModel) : buatManualProvider();
}
