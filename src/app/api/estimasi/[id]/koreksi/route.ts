import { db } from "@/lib/db";
import { catatKoreksi } from "@/core/audit";
import { perbaruiKalibrasi } from "@/core/kalibrasi";
import { fraksiDariString } from "@/core/fraksi";
import { porsiDariString, porsiKeString, porsiKePerseratus } from "@/core/porsi";
import { galat, KODE_GALAT, sukses, tangani } from "../../../_lib/respons";
import { pesanDariZod, skemaKoreksi } from "../../../_lib/skema";

/*
 * 5.4 — POST /api/estimasi/:id/koreksi
 *
 * ATURAN KERAS 2 BERLAKU PENUH DI SINI: koreksi selalu baris baru. Baris
 * `estimasi` tidak pernah disentuh — tidak ada satu pun `db.estimasi.update`
 * di berkas ini, dan tidak boleh pernah ada.
 *
 * Satu koreksi memicu dua penulisan: baris koreksi baru, dan pembaruan
 * konstanta kalibrasi. Keduanya dibungkus satu transaksi — konstanta yang
 * bergerak tanpa jejak koreksinya adalah angka yang tidak bisa
 * dipertanggungjawabkan.
 */

export async function POST(
  permintaan: Request,
  konteks: { params: Promise<{ id: string }> },
) {
  return tangani(async () => {
    const { id } = await konteks.params;

    const badan: unknown = await permintaan.json().catch(() => null);
    const hasil = skemaKoreksi.safeParse(badan);
    if (!hasil.success) {
      return galat(KODE_GALAT.VALIDASI_GAGAL, 422, pesanDariZod(hasil.error));
    }

    const estimasi = await db.estimasi.findUnique({
      where: { id },
      include: { koreksi: { orderBy: { dibuatPada: "asc" } } },
    });
    if (!estimasi) return galat(KODE_GALAT.ESTIMASI_TIDAK_DITEMUKAN, 404);

    const kalibrasi = await db.kalibrasi.findUnique({
      where: {
        wadahId_jenisMasakanId: {
          wadahId: estimasi.wadahId,
          jenisMasakanId: estimasi.jenisMasakanId,
        },
      },
    });
    if (!kalibrasi) return galat(KODE_GALAT.WADAH_TIDAK_TERDAFTAR, 422);

    const porsiSesudah = porsiDariString(hasil.data.porsiSesudah);
    const porsiPenuh = porsiDariString(kalibrasi.porsiPenuh.toString());

    /*
     * Batas wajar: sisa tidak bisa melebihi muatan wadah saat penuh.
     *
     * Pesannya menyebut penyebabnya dan mengajak memeriksa, bukan menyalahkan.
     * Angka yang terlalu besar biasanya salah ketik, bukan kecerobohan.
     */
    if (porsiKePerseratus(porsiSesudah) > porsiKePerseratus(porsiPenuh)) {
      return galat(
        KODE_GALAT.KOREKSI_DI_LUAR_BATAS,
        422,
        `Wadah ini menampung sekitar ${porsiKeString(porsiPenuh)} porsi saat penuh. Coba periksa lagi.`,
      );
    }

    const koreksiSebelumnya = estimasi.koreksi.map((k) => ({
      porsiSesudah: porsiDariString(k.porsiSesudah.toString()),
      dibuatPada: k.dibuatPada,
    }));

    // /core yang menyusun barisnya; route handler hanya menyisipkan.
    const baris = catatKoreksi({
      estimasi: {
        id: estimasi.id,
        porsiEstimasi: porsiDariString(estimasi.porsiEstimasi.toString()),
      },
      koreksiSebelumnya,
      porsiSesudah,
      peranPengoreksi: hasil.data.peranPengoreksi,
    });

    const pembaruan = perbaruiKalibrasi({
      konstantaLama: porsiPenuh,
      jumlahKoreksiLama: kalibrasi.jumlahKoreksi,
      sumberLama: kalibrasi.sumber,
      fraksiKeterisian: fraksiDariString(estimasi.fraksiKeterisian.toString()),
      porsiSesudah,
    });

    const [koreksiTersimpan] = await db.$transaction([
      // INSERT saja. Tidak pernah update, tidak pernah delete.
      db.koreksi.create({
        data: {
          estimasiId: baris.estimasiId,
          porsiSebelum: porsiKeString(baris.porsiSebelum),
          porsiSesudah: porsiKeString(baris.porsiSesudah),
          selisihAbsolut: porsiKeString(baris.selisihAbsolut),
          peranPengoreksi: baris.peranPengoreksi,
        },
      }),
      db.kalibrasi.update({
        where: { id: kalibrasi.id },
        data: {
          porsiPenuh: porsiKeString(pembaruan.porsiPenuh),
          sumber: pembaruan.sumber,
          jumlahKoreksi: pembaruan.jumlahKoreksi,
          diperbaruiPada: new Date(),
        },
      }),
    ]);

    return sukses(
      {
        koreksi: {
          id: koreksiTersimpan.id,
          porsiSebelum: porsiKeString(baris.porsiSebelum),
          porsiSesudah: porsiKeString(baris.porsiSesudah),
          selisihAbsolut: porsiKeString(baris.selisihAbsolut),
        },
        konstantaBaru: {
          porsiPenuh: porsiKeString(pembaruan.porsiPenuh),
          sumber: pembaruan.sumber,
          jumlahKoreksi: pembaruan.jumlahKoreksi,
          /*
           * Ditampilkan supaya operator tahu kenapa konstanta tidak bergerak
           * sejauh yang dia harapkan. Tanpa penanda ini, koreksi besar terasa
           * diabaikan sistem.
           */
          dibatasi: pembaruan.dibatasi,
        },
      },
      201,
    );
  });
}
