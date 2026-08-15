import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { galat, KODE_GALAT, sukses, tangani } from "../_lib/respons";
import { pesanDariZod, skemaJenisMasakanBaru } from "../_lib/skema";
import { ambilDapurAktif } from "../_lib/data";

/*
 * 6.1 — POST /api/jenis-masakan
 *
 * Dipanggil dari DALAM langkah 4, bukan sebagai langkah tersendiri.
 *
 * Alasannya: dapur yang baru mendaftar belum punya satu pun jenis masakan, jadi
 * langkah 4 ("kalau wadah ini penuh berisi apa?") tidak punya pilihan untuk
 * ditawarkan. Menambahkan langkah "daftarkan jenis masakan dulu" akan
 * menjadikannya enam langkah dan memindahkan pekerjaan ke tempat yang tidak
 * masuk akal bagi operator — dia sedang memikirkan pancinya, bukan taksonomi
 * masakan.
 *
 * Jadi mengetik nama masakan baru di langkah 4 langsung membuatnya.
 */

export async function POST(permintaan: Request) {
  return tangani(async () => {
    const badan: unknown = await permintaan.json().catch(() => null);
    const hasil = skemaJenisMasakanBaru.safeParse(badan);
    if (!hasil.success) {
      return galat(KODE_GALAT.VALIDASI_GAGAL, 422, pesanDariZod(hasil.error));
    }

    const dapur = await ambilDapurAktif();
    if (!dapur) return galat(KODE_GALAT.CATATAN_TIDAK_DITEMUKAN, 404);

    try {
      const jenis = await db.jenisMasakan.create({
        data: {
          dapurId: dapur.id,
          nama: hasil.data.nama,
          kategoriFisik: hasil.data.kategoriFisik,
        },
      });

      return sukses(
        {
          jenisMasakan: {
            id: jenis.id,
            nama: jenis.nama,
            kategoriFisik: jenis.kategoriFisik,
          },
        },
        201,
      );
    } catch (penyebab) {
      /*
       * UNIQUE(dapur_id, nama) — jenis masakan ini sudah ada.
       *
       * Yang dikembalikan adalah baris yang SUDAH ADA, bukan galat. Operator
       * yang mengetik "Nasi" untuk panci kedua bermaksud memakai jenis yang
       * sama, bukan membuat yang baru. Menolaknya di sini akan menghentikan
       * pendaftaran karena alasan yang tidak dia mengerti.
       */
      if (
        penyebab instanceof Prisma.PrismaClientKnownRequestError &&
        penyebab.code === "P2002"
      ) {
        const adaDuluan = await db.jenisMasakan.findFirst({
          where: { dapurId: dapur.id, nama: hasil.data.nama },
        });
        if (adaDuluan) {
          return sukses({
            jenisMasakan: {
              id: adaDuluan.id,
              nama: adaDuluan.nama,
              kategoriFisik: adaDuluan.kategoriFisik,
            },
          });
        }
      }
      throw penyebab;
    }
  });
}
