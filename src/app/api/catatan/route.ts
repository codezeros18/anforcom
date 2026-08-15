import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { galat, KODE_GALAT, sukses, tangani } from "../_lib/respons";
import { pesanDariZod, skemaCatatanBaru } from "../_lib/skema";
import { ambilDapurAktif } from "../_lib/data";
import { tanggalUtc } from "../_lib/hitung";

/*
 * 5.1 — POST /api/catatan
 *
 * Membuat satu hari operasional. Ini ketukan pertama alur pencatatan, dan
 * layar yang memanggilnya sudah mengisi nilainya dengan rekomendasi kemarin —
 * jadi pada jalur normal operator hanya menekan "Simpan".
 */
export async function POST(permintaan: Request) {
  return tangani(async () => {
    const badan: unknown = await permintaan.json().catch(() => null);
    const hasil = skemaCatatanBaru.safeParse(badan);
    if (!hasil.success) {
      return galat(KODE_GALAT.VALIDASI_GAGAL, 422, pesanDariZod(hasil.error));
    }

    const dapur = await ambilDapurAktif();
    if (!dapur) return galat(KODE_GALAT.CATATAN_TIDAK_DITEMUKAN, 404);

    try {
      const catatan = await db.catatanHarian.create({
        data: {
          dapurId: dapur.id,
          tanggal: tanggalUtc(hasil.data.tanggal),
          porsiDimasak: hasil.data.porsiDimasak,
          // Ditandai, tidak dihukum. Lihat catatan di skema.
          dicatatMundur: hasil.data.dicatatMundur,
          peranPencatat: hasil.data.peranPencatat,
        },
      });

      return sukses(
        {
          catatan: {
            id: catatan.id,
            tanggal: catatan.tanggal.toISOString().slice(0, 10),
            porsiDimasak: catatan.porsiDimasak.toString(),
            dicatatMundur: catatan.dicatatMundur,
          },
        },
        201,
      );
    } catch (penyebab) {
      /*
       * Unique constraint (dapur_id, tanggal) — hari itu sudah pernah dicatat.
       *
       * Ini bukan kesalahan operator dan pesannya tidak boleh berbunyi seperti
       * teguran. Yang dia butuhkan adalah jalan ke depan: buka catatan yang
       * sudah ada dan tambahkan wadah di sana.
       */
      if (
        penyebab instanceof Prisma.PrismaClientKnownRequestError &&
        penyebab.code === "P2002"
      ) {
        return galat(KODE_GALAT.TANGGAL_SUDAH_ADA, 409);
      }
      throw penyebab;
    }
  });
}
