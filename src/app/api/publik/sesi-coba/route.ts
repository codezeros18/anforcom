import { cookies } from "next/headers";
import { galat, KODE_GALAT, sukses, tangani } from "@/app/api/_lib/respons";
import { COOKIE_SESI_COBA } from "@/app/api/_lib/data";
import { buatSesiCoba, GalatDapurContohTidakAda, UMUR_SESI_JAM } from "../_lib/sesi-coba";

/*
 * 8.1 — POST /api/publik/sesi-coba
 *
 * Masuk mode coba tanpa pendaftaran (8.5). Tidak meminta nama, surel, atau apa
 * pun: pengunjung booth yang harus mengisi formulir dulu tidak akan pernah
 * sampai ke layar yang ingin kita tunjukkan.
 *
 * Token dikembalikan di badan respons DAN dipasang sebagai cookie. Cookie-nya
 * yang bekerja — ia ikut otomatis ke setiap penulisan berikutnya, sehingga
 * seluruh alur layar 2-6 terisolasi tanpa satu pun route handler perlu diubah.
 */

export const dynamic = "force-dynamic";

export async function POST() {
  return tangani(async () => {
    try {
      const sesi = await buatSesiCoba();

      (await cookies()).set(COOKIE_SESI_COBA, sesi.token, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: UMUR_SESI_JAM * 60 * 60,
        secure: process.env.NODE_ENV === "production",
      });

      return sukses(sesi, 201);
    } catch (penyebab) {
      if (penyebab instanceof GalatDapurContohTidakAda) {
        return galat(
          KODE_GALAT.CATATAN_TIDAK_DITEMUKAN,
          503,
          "Mode coba belum siap. Dapur contohnya belum disiapkan.",
        );
      }
      throw penyebab;
    }
  });
}
