import { galat, KODE_GALAT, sukses, tangani } from "@/app/api/_lib/respons";
import { ambilDataAkurasi } from "../_lib/akurasi";
import { pilihDapurPublik } from "../_lib/ringkasan";

/*
 * 8.1 — GET /api/publik/akurasi
 *
 * Tingkat kesalahan sistem kami sendiri, terbuka tanpa login.
 *
 * Tidak ada parameter yang bisa menyaring, membatasi jendela waktu, atau
 * memilih kategori. Itu disengaja: setiap parameter seperti itu adalah cara
 * untuk memilih angka yang paling bagus, dan halaman yang bisa memilih angka
 * terbaiknya sendiri tidak membuktikan apa pun.
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

    const akurasi = await ambilDataAkurasi(pilihan.dapur.id);

    return sukses({
      memakaiDapurContoh: pilihan.memakaiDapurContoh,
      totalEstimasi: akurasi.totalEstimasi,
      persenDikoreksi: akurasi.persenDikoreksi,
      simpanganRataPersen: akurasi.simpanganRataPersen,
      perKategoriFisik: akurasi.perKategoriFisik,
      jumlahDikecualikan: akurasi.jumlahDikecualikan,
      alasanDikecualikan: akurasi.alasanDikecualikan,
      tren: akurasi.tren,
    });
  });
}
