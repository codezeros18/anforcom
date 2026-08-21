import { galat, KODE_GALAT, sukses, tangani } from "@/app/api/_lib/respons";
import { pilihDapurPublik } from "../_lib/ringkasan";
import { ambilSebaranTebakan } from "../_lib/tebakan";

/*
 * 8.1 — GET /api/publik/tebakan
 *
 * 404 BILA BELUM ADA DATA, bukan 200 dengan nol.
 *
 * Bedanya penting. `{ n: 0, median: "0" }` akan dirender oleh klien yang tidak
 * teliti sebagai blok sebaran yang isinya nol — angka karangan di blok yang
 * justru dibuat untuk membuktikan kejujuran. 404 memaksa pemanggil mengambil
 * keputusan yang benar: hilangkan bloknya.
 */

export const dynamic = "force-dynamic";

export async function GET() {
  return tangani(async () => {
    const pilihan = await pilihDapurPublik();
    if (!pilihan) {
      return galat(
        KODE_GALAT.CATATAN_TIDAK_DITEMUKAN,
        503,
        "Belum ada data yang bisa ditampilkan.",
      );
    }

    const sebaran = await ambilSebaranTebakan(pilihan.dapur.id);
    if (!sebaran) {
      return galat(
        KODE_GALAT.CATATAN_TIDAK_DITEMUKAN,
        404,
        "Sebaran tebakan belum dikumpulkan.",
      );
    }

    return sukses({ ...sebaran, memakaiDapurContoh: pilihan.memakaiDapurContoh });
  });
}
