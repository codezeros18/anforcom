import { db } from "@/lib/db";
import { galat, KODE_GALAT, sukses, tangani } from "../../../_lib/respons";
import { pesanDariZod, skemaAnomali } from "../../../_lib/skema";

/*
 * 5.7 — POST /api/catatan/:id/anomali
 *
 * Menandai hari yang tidak mewakili operasi biasa: acara, libur, jumlah
 * penerima berubah.
 *
 * Pengaruhnya besar dan bertahan dua minggu — hari anomali dikecualikan dari
 * basis DAN dari lantai keras rekomendasi. Tanpa pengecualian itu, satu hari
 * acara berkonsumsi 500 akan mengunci rekomendasi di 500 selama 14 hari, dan
 * produk yang dirancang menekan sisa justru memproduksinya.
 *
 * Karena itu alasannya wajib diisi — satu-satunya kewajiban di seluruh alur
 * pencatatan. Pengecualian sebesar ini harus bisa dijelaskan kembali kepada
 * siapa pun yang membaca angkanya nanti.
 */

export async function POST(
  permintaan: Request,
  konteks: { params: Promise<{ id: string }> },
) {
  return tangani(async () => {
    const { id } = await konteks.params;

    const catatan = await db.catatanHarian.findUnique({ where: { id } });
    if (!catatan) return galat(KODE_GALAT.CATATAN_TIDAK_DITEMUKAN, 404);

    const badan: unknown = await permintaan.json().catch(() => null);
    const hasil = skemaAnomali.safeParse(badan);
    if (!hasil.success) {
      return galat(KODE_GALAT.VALIDASI_GAGAL, 422, pesanDariZod(hasil.error));
    }

    const tersimpan = await db.catatanHarian.update({
      where: { id: catatan.id },
      data: { isAnomali: true, alasanAnomali: hasil.data.alasan },
    });

    return sukses({
      catatan: {
        id: tersimpan.id,
        isAnomali: tersimpan.isAnomali,
        alasanAnomali: tersimpan.alasanAnomali,
      },
    });
  });
}
