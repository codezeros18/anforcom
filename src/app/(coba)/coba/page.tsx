import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { COOKIE_SESI_COBA } from "@/app/api/_lib/data";
import {
  buatSesiCoba,
  GalatDapurContohTidakAda,
  UMUR_SESI_JAM,
} from "@/app/api/publik/_lib/sesi-coba";

/*
 * LAYAR 10 — MASUK MODE COBA (8.5).
 *
 * TANPA PENDAFTARAN. Tidak ada nama, surel, atau kotak centang. Pengunjung
 * booth yang harus mengisi formulir dulu tidak akan pernah sampai ke layar yang
 * ingin kita tunjukkan, dan meminta identitas juga bertabrakan dengan aturan 1.
 *
 * KENAPA HALAMAN, BUKAN TOMBOL FETCH DI LAYAR PUBLIK. Halaman ini adalah
 * <form> yang di-POST ke server, jadi ia bekerja dengan JavaScript dimatikan —
 * konsisten dengan layar 1. Kalau pintu masuk mode coba butuh JavaScript, ia
 * akan mati persis pada HP lambat yang paling mungkin dipakai di pameran.
 *
 * Sesudah sesi dibuat, cookie terpasang dan seluruh alur layar 2-6 otomatis
 * menulis ke dapur contoh — lihat `ambilDapurAktif()` di `api/_lib/data.ts`.
 */

export const dynamic = "force-dynamic";

async function mulaiSesiCoba() {
  "use server";

  try {
    const sesi = await buatSesiCoba();
    (await cookies()).set(COOKIE_SESI_COBA, sesi.token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: UMUR_SESI_JAM * 60 * 60,
      secure: process.env.NODE_ENV === "production",
    });
  } catch (penyebab) {
    if (penyebab instanceof GalatDapurContohTidakAda) {
      redirect("/coba?siap=0");
    }
    throw penyebab;
  }

  redirect("/catat");
}

export default async function HalamanMulaiCoba({
  searchParams,
}: {
  searchParams: Promise<{ siap?: string }>;
}) {
  const { siap } = await searchParams;

  return (
    <main className="mx-auto flex max-w-md flex-col gap-5 p-6">
      <h1 className="text-badan font-semibold text-netral-900">Coba sebagai operator</h1>

      <p className="text-badan text-netral-700">
        Anda akan mencatat di <strong>dapur contoh</strong>, bukan dapur sungguhan.
        Seluruh alurnya sama persis: catat porsi dimasak, potret atau geser untuk menaksir
        sisa, koreksi bila tidak cocok, lalu lihat rekomendasi besok.
      </p>

      <p className="text-konteks text-netral-600">
        Tidak perlu mendaftar dan tidak ada data pribadi yang diminta. Sesinya berlaku{" "}
        {UMUR_SESI_JAM} jam, dan apa pun yang Anda catat tidak menyentuh data dapur nyata.
      </p>

      {siap === "0" && (
        <p className="text-badan rounded-xl bg-perhatian-100 px-4 py-3 text-perhatian-700">
          Mode coba belum siap — dapur contohnya belum disiapkan.
        </p>
      )}

      <form action={mulaiSesiCoba}>
        <button
          type="submit"
          className="text-badan h-14 w-full rounded-xl bg-aksen-500 font-semibold text-white"
        >
          Mulai mode coba
        </button>
      </form>

      <Link href="/" className="text-konteks text-center text-netral-600 underline">
        Kembali ke ringkasan
      </Link>
    </main>
  );
}
