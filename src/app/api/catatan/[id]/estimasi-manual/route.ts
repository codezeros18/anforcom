import { db } from "@/lib/db";
import { galat, KODE_GALAT, sukses, tangani } from "../../../_lib/respons";
import { pesanDariZod, skemaEstimasiManual } from "../../../_lib/skema";
import { rakitEstimasi } from "../../../_lib/estimasi";

/*
 * 5.3 — POST /api/catatan/:id/estimasi-manual
 *
 * Jalur geser. Perhatikan bahwa berkas ini memanggil `rakitEstimasi` yang SAMA
 * dengan jalur foto, dengan satu-satunya perbedaan: dari mana fraksinya datang.
 *
 * Tidak ada foto, tidak ada model, tidak ada latensi — dan tidak ada satu pun
 * penanda di respons yang menyebutnya jalur cadangan. Hasilnya setara, dan
 * bentuk datanya mengatakan begitu (BLUEPRINT P4).
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
    const hasil = skemaEstimasiManual.safeParse(badan);
    if (!hasil.success) {
      return galat(KODE_GALAT.VALIDASI_GAGAL, 422, pesanDariZod(hasil.error));
    }

    const dirakit = await rakitEstimasi({
      catatanHarianId: catatan.id,
      dapurId: catatan.dapurId,
      wadahId: hasil.data.wadahId,
      jenisMasakanId: hasil.data.jenisMasakanId,
      fraksiTeks: hasil.data.fraksiKeterisian,
      metode: "slider",
      isCampuran: hasil.data.isCampuran,
      latensiMs: null,
      fotoUrl: null,
    });

    if (!dirakit.ok) return galat(KODE_GALAT.WADAH_TIDAK_TERDAFTAR, 422);

    return sukses({ estimasi: dirakit.estimasi }, 201);
  });
}
