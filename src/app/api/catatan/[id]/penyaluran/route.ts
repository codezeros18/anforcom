import { db } from "@/lib/db";
import { galat, KODE_GALAT, sukses, tangani } from "../../../_lib/respons";
import { pesanDariZod, skemaPenyaluran } from "../../../_lib/skema";

/*
 * 5.6 — POST /api/catatan/:id/penyaluran
 *
 * Ketukan kelima, sekaligus yang terakhir. Tiga pilihan, satu ketukan, catatan
 * opsional yang hampir tidak pernah diisi — dan memang tidak perlu.
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
    const hasil = skemaPenyaluran.safeParse(badan);
    if (!hasil.success) {
      return galat(KODE_GALAT.VALIDASI_GAGAL, 422, pesanDariZod(hasil.error));
    }

    const penyaluran = await db.penyaluran.create({
      data: {
        catatanHarianId: catatan.id,
        tujuan: hasil.data.tujuan,
        catatan: hasil.data.catatan ?? null,
      },
    });

    return sukses(
      {
        penyaluran: {
          id: penyaluran.id,
          tujuan: penyaluran.tujuan,
          catatan: penyaluran.catatan,
        },
      },
      201,
    );
  });
}
