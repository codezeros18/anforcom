import { db } from "@/lib/db";
import { hapusMetadataFoto } from "@/lib/exif";
import { ambilPembacaFraksi } from "@/vision";
import { galat, KODE_GALAT, sukses, tangani } from "../../../_lib/respons";
import { pesanDariZod, skemaEstimasiFoto } from "../../../_lib/skema";
import { rakitEstimasi } from "../../../_lib/estimasi";

/*
 * 5.2 — POST /api/catatan/:id/estimasi
 *
 * Jalur foto. Ketukan ketiga alur normal.
 *
 * URUTAN YANG TIDAK BOLEH DITUKAR:
 *   1. Baca foto
 *   2. HAPUS METADATA — sebelum apa pun yang lain
 *   3. Baca fraksi lewat model
 *   4. Rakit estimasi
 *
 * Langkah 2 mendahului langkah 3 dengan sengaja. Metadata EXIF foto HP memuat
 * koordinat GPS dapur; ia dibuang sebelum byte-nya dikirim ke mana pun, bukan
 * sesudahnya.
 */

const UKURAN_FOTO_MAKS = 8 * 1024 * 1024;

export async function POST(
  permintaan: Request,
  konteks: { params: Promise<{ id: string }> },
) {
  return tangani(async () => {
    const { id } = await konteks.params;

    const catatan = await db.catatanHarian.findUnique({ where: { id } });
    if (!catatan) return galat(KODE_GALAT.CATATAN_TIDAK_DITEMUKAN, 404);

    const formulir = await permintaan.formData().catch(() => null);
    if (!formulir)
      return galat(KODE_GALAT.VALIDASI_GAGAL, 422, "Fotonya belum terkirim.");

    const bidang = skemaEstimasiFoto.safeParse({
      wadahId: formulir.get("wadahId"),
      jenisMasakanId: formulir.get("jenisMasakanId"),
      isCampuran: formulir.get("isCampuran") ?? false,
    });
    if (!bidang.success) {
      return galat(KODE_GALAT.VALIDASI_GAGAL, 422, pesanDariZod(bidang.error));
    }

    const berkas = formulir.get("foto");
    if (!(berkas instanceof Blob) || berkas.size === 0) {
      return galat(KODE_GALAT.VALIDASI_GAGAL, 422, "Fotonya belum terkirim.");
    }
    if (berkas.size > UKURAN_FOTO_MAKS) {
      return galat(
        KODE_GALAT.VALIDASI_GAGAL,
        422,
        "Fotonya terlalu besar — coba potret ulang.",
      );
    }

    const mentah = new Uint8Array(await berkas.arrayBuffer());

    // 4.7 — metadata dibuang di server, sebelum foto dipakai atau disimpan.
    const bersih = hapusMetadataFoto(mentah);
    if (bersih.format === "tidak_dikenal") {
      /*
       * Berkas yang tidak bisa kita bersihkan TIDAK dipakai dan tidak disimpan.
       * Menyimpan berkas yang metadatanya tak terjangkau sama saja dengan tidak
       * membersihkan sama sekali.
       */
      return galat(
        KODE_GALAT.FOTO_TIDAK_TERBACA,
        422,
        "Jenis berkasnya belum didukung — pakai geser saja, hasilnya sama.",
      );
    }

    const bacaan = await ambilPembacaFraksi().baca(bersih.data, {
      wadahId: bidang.data.wadahId,
      jenisMasakanId: bidang.data.jenisMasakanId,
    });

    if (bacaan.status === "perlu_manual") {
      /*
       * Bukan kegagalan sistem — sinyal bahwa jalur geser yang dipakai. Slider
       * sudah terlihat di layar sejak detik 1,5, jadi operator tidak sedang
       * menunggu apa pun saat pesan ini tiba.
       *
       * Timeout memakai 504 sesuai spesifikasi; sebab lain memakai 422 karena
       * permintaannya sampai dan dijawab — hanya jawabannya yang tidak terpakai.
       */
      const timeout = bacaan.alasan === "timeout";
      return galat(
        timeout ? KODE_GALAT.TIMEOUT_MODEL : KODE_GALAT.FOTO_TIDAK_TERBACA,
        timeout ? 504 : 422,
      );
    }

    const hasil = await rakitEstimasi({
      catatanHarianId: catatan.id,
      dapurId: catatan.dapurId,
      wadahId: bidang.data.wadahId,
      jenisMasakanId: bidang.data.jenisMasakanId,
      // Kuantisasi ke empat desimal DI BATAS SISTEM — sesudah baris ini tidak
      // ada lagi float di jalur perhitungan mana pun (CLAUDE.md aturan 3).
      fraksiTeks: bacaan.fraksi.toFixed(4),
      metode: "model",
      isCampuran: bidang.data.isCampuran,
      latensiMs: bacaan.latensiMs,
      // Penyimpanan foto ke object storage adalah Sprint 12; sampai saat itu
      // foto dibaca lalu dilepas, tidak disimpan di mana pun.
      fotoUrl: null,
    });

    if (!hasil.ok) return galat(KODE_GALAT.WADAH_TIDAK_TERDAFTAR, 422);

    return sukses({ estimasi: hasil.estimasi }, 201);
  });
}
