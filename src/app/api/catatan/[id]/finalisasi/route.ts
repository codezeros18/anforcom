import { db } from "@/lib/db";
import { hitungPorsiFinal } from "@/core/audit";
import {
  porsiDariPerseratus,
  porsiDariString,
  porsiKePerseratus,
  porsiKeString,
} from "@/core/porsi";
import { galat, KODE_GALAT, sukses, tangani } from "../../../_lib/respons";
import { hitungRentangRupiah, keSen } from "../../../_lib/hitung";

/*
 * 5.5 — POST /api/catatan/:id/finalisasi
 *
 * Menutup satu hari: menjumlahkan nilai FINAL setiap estimasi menjadi
 * `porsiTersisaFinal`.
 *
 * "Nilai final" bukan nilai estimasi. Ia dihitung dari estimasi beserta jejak
 * koreksinya (`hitungPorsiFinal` di /core) — inilah bentuk konkret aturan 2:
 * nilai final DIHITUNG, bukan ditimpa. Baris estimasi asli tetap utuh dan bisa
 * dibandingkan dengan koreksinya di halaman Akurasi.
 */

export async function POST(
  _permintaan: Request,
  konteks: { params: Promise<{ id: string }> },
) {
  return tangani(async () => {
    const { id } = await konteks.params;

    const catatan = await db.catatanHarian.findUnique({
      where: { id },
      include: {
        dapur: true,
        estimasi: { include: { koreksi: { orderBy: { dibuatPada: "asc" } } } },
      },
    });
    if (!catatan) return galat(KODE_GALAT.CATATAN_TIDAK_DITEMUKAN, 404);

    if (catatan.estimasi.length === 0) {
      return galat(KODE_GALAT.BELUM_ADA_ESTIMASI, 409);
    }

    let totalPerseratus = 0;
    for (const e of catatan.estimasi) {
      const final = hitungPorsiFinal(
        { porsiEstimasi: porsiDariString(e.porsiEstimasi.toString()) },
        e.koreksi.map((k) => ({
          porsiSesudah: porsiDariString(k.porsiSesudah.toString()),
          dibuatPada: k.dibuatPada,
        })),
      );
      totalPerseratus += porsiKePerseratus(final);
    }

    const porsiTersisaFinal = porsiDariPerseratus(totalPerseratus);

    const tersimpan = await db.catatanHarian.update({
      where: { id: catatan.id },
      data: { porsiTersisaFinal: porsiKeString(porsiTersisaFinal) },
    });

    /*
     * PERINGATAN — LIHAT CATATAN DI PROGRESS.md "BUTUH KEPUTUSAN MANUSIA".
     *
     * CLAUDE.md aturan 5 berbunyi: angka dampak (rupiah, kilogram, persentase
     * sisa) TIDAK BOLEH dihitung dari tabel `estimasi`; hanya dari
     * `penimbangan_referensi`. Spesifikasi tugas 5.5 meminta endpoint ini
     * mengembalikan `rupiahRentang`, yang mau tidak mau dihitung dari estimasi.
     *
     * Yang dilakukan di sini: angkanya dikembalikan sesuai permintaan, tapi
     * dibungkus penanda `sumber: "estimasi_operasional"` dan
     * `bolehUntukKlaim: false` sehingga MUSTAHIL tertukar dengan angka klaim
     * oleh kode mana pun di hilir. Keputusan akhirnya ada di manusia.
     */
    const rupiahRentang = hitungRentangRupiah(
      porsiTersisaFinal,
      keSen(catatan.dapur.biayaBahanPerPorsiMin),
      keSen(catatan.dapur.biayaBahanPerPorsiMaks),
    );

    return sukses({
      catatan: {
        id: tersimpan.id,
        porsiDimasak: tersimpan.porsiDimasak.toString(),
        porsiTersisaFinal: porsiKeString(porsiTersisaFinal),
        jumlahWadah: catatan.estimasi.length,
      },
      rupiahRentang,
    });
  });
}
