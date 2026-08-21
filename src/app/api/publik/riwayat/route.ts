import { galat, KODE_GALAT, sukses, tangani } from "@/app/api/_lib/respons";
import { ambilRingkasanPublik } from "../_lib/ringkasan";

/*
 * 7.2 — GET /api/publik/riwayat?hari=14
 *
 * Deret 14 hari untuk grafik. Sama seperti ringkasan: tanpa login, tanpa input.
 *
 * Tidak ada `dapurId` di parameter — dan itu disengaja. Menerima id dapur dari
 * luar berarti siapa pun bisa membaca riwayat dapur mana pun, termasuk dapur
 * yang belum memberi izin tampil publik. Dapur yang ditampilkan dipilih di
 * server berdasarkan izinnya.
 */

export const dynamic = "force-dynamic";

const HARI_MAKS = 14;

export async function GET(permintaan: Request) {
  return tangani(async () => {
    const diminta = new URL(permintaan.url).searchParams.get("hari");
    const hari = Math.min(
      HARI_MAKS,
      Math.max(1, Number.isFinite(Number(diminta)) ? Number(diminta) : HARI_MAKS),
    );

    const ringkasan = await ambilRingkasanPublik();
    if (!ringkasan) {
      return galat(
        KODE_GALAT.CATATAN_TIDAK_DITEMUKAN,
        503,
        "Belum ada data yang bisa ditampilkan.",
      );
    }

    return sukses({
      memakaiDapurContoh: ringkasan.memakaiDapurContoh,
      hari: ringkasan.riwayat.slice(-hari),
    });
  });
}
