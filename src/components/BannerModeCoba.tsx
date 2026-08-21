import { cookies } from "next/headers";
import { COOKIE_SESI_COBA } from "@/app/api/_lib/data";
import { dapurDariToken } from "@/app/api/publik/_lib/sesi-coba";

/*
 * Banner mode coba — 8.5, dan ATURAN KERAS 8.
 *
 * "Data dapur contoh tidak pernah bercampur dengan data dapur nyata... dan
 * diberi badge yang terlihat di UI."
 *
 * KENAPA DI LAYOUT, BUKAN DI TIAP HALAMAN. Spesifikasi memintanya "tetap di
 * atas" sepanjang alur layar 2-6. Kalau banner dipasang per halaman, satu
 * halaman baru yang lupa memasangnya menghasilkan layar yang terlihat persis
 * seperti dapur sungguhan — dan pengunjung booth tidak punya cara untuk tahu
 * bedanya. Dipasang sekali di layout, seluruh halaman di bawahnya ikut, dan
 * halaman yang belum ada pun ikut.
 *
 * Ia menghilang sendiri saat sesi kedaluwarsa, karena `dapurDariToken()`
 * mengembalikan `null` — sumber kebenarannya sama persis dengan yang menentukan
 * ke dapur mana data ditulis. Jadi banner tidak bisa berbohong: kalau ia
 * tampil, tulisan memang masuk ke dapur contoh, dan sebaliknya.
 */

export async function BannerModeCoba() {
  const token = (await cookies()).get(COOKIE_SESI_COBA)?.value;
  const dapurCoba = await dapurDariToken(token);
  if (!dapurCoba) return null;

  return (
    <div className="sticky top-0 z-50 bg-perhatian-100 px-4 py-2 text-center">
      <p className="text-konteks font-medium text-perhatian-700">
        Mode coba — dapur contoh
      </p>
    </div>
  );
}
