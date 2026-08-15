import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { galat, KODE_GALAT, sukses, tangani } from "../_lib/respons";
import { pesanDariZod, skemaWadahBaru } from "../_lib/skema";
import { ambilDapurAktif } from "../_lib/data";

/*
 * 6.1 — POST /api/wadah
 *
 * Langkah 2 dan 3 dari alur pendaftaran: nama dan bentuk.
 *
 * Bentuk disimpan sebagai enum ikon, BUKAN sebagai dimensi. Ia tidak dipakai
 * untuk menebak kapasitas — menebak konstanta dari bentuk adalah persis yang
 * dilarang. Bentuk hanya dipakai untuk menampilkan ikon di kartu pemilihan
 * wadah, supaya operator mengenali pancinya sekilas saat wadah itu belum
 * berfoto.
 */

export async function POST(permintaan: Request) {
  return tangani(async () => {
    const badan: unknown = await permintaan.json().catch(() => null);
    const hasil = skemaWadahBaru.safeParse(badan);
    if (!hasil.success) {
      return galat(KODE_GALAT.VALIDASI_GAGAL, 422, pesanDariZod(hasil.error));
    }

    const dapur = await ambilDapurAktif();
    if (!dapur) return galat(KODE_GALAT.CATATAN_TIDAK_DITEMUKAN, 404);

    try {
      const wadah = await db.wadah.create({
        data: {
          dapurId: dapur.id,
          nama: hasil.data.nama,
          bentuk: hasil.data.bentuk,
          fotoAcuanUrl: hasil.data.fotoAcuanUrl ?? null,
          aktif: true,
        },
      });

      return sukses(
        {
          wadah: {
            id: wadah.id,
            nama: wadah.nama,
            bentuk: wadah.bentuk,
            fotoAcuanUrl: wadah.fotoAcuanUrl,
          },
        },
        201,
      );
    } catch (penyebab) {
      // UNIQUE(dapur_id, nama). Bukan teguran — dapur memang punya panci yang
      // mirip, dan yang dia butuhkan adalah tahu nama itu sudah dipakai.
      if (
        penyebab instanceof Prisma.PrismaClientKnownRequestError &&
        penyebab.code === "P2002"
      ) {
        return galat(
          KODE_GALAT.VALIDASI_GAGAL,
          409,
          "Sudah ada wadah dengan nama ini. Coba nama yang lain.",
        );
      }
      throw penyebab;
    }
  });
}
