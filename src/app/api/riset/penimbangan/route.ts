import { db } from "@/lib/db";
import { galat, KODE_GALAT, sukses, tangani } from "@/app/api/_lib/respons";
import { pesanDariZod, skemaPenimbangan } from "@/app/api/_lib/skema";
import { tanggalUtc } from "@/app/api/_lib/hitung";
import { risetAktif } from "../_lib/penjaga";

/*
 * 9.4 — POST /api/riset/penimbangan
 *
 * ALAT KERJA LAPANGAN TIM, BUKAN LAYAR OPERATOR. Tidak ada halaman yang
 * memanggilnya, dan itu disengaja — lihat `_lib/penjaga.ts`.
 *
 * Yang ditulis di sini adalah SUMBER TUNGGAL angka dampak (aturan keras 5):
 * rupiah, kilogram, dan persentase sisa untuk klaim dihitung dari tabel ini,
 * tidak pernah dari `estimasi`. Karena itu jalur tulisnya dijaga flag, dan
 * gerbangnya tertutup secara bawaan.
 */

export const dynamic = "force-dynamic";

export async function POST(permintaan: Request) {
  return tangani(async () => {
    /*
     * Gerbang diperiksa SEBELUM badan permintaan dibaca. Saat riset mati,
     * endpoint ini berperilaku seolah tidak ada — 404, bukan 403. Menjawab 403
     * memberi tahu penanya bahwa ada sesuatu di balik pintu ini.
     */
    if (!risetAktif()) {
      return galat(KODE_GALAT.CATATAN_TIDAK_DITEMUKAN, 404, "Halaman tidak ditemukan.");
    }

    const badan: unknown = await permintaan.json().catch(() => null);
    const hasil = skemaPenimbangan.safeParse(badan);
    if (!hasil.success) {
      return galat(KODE_GALAT.VALIDASI_GAGAL, 422, pesanDariZod(hasil.error));
    }

    const catatan = await db.catatanHarian.findUnique({
      where: { id: hasil.data.catatanHarianId },
    });
    if (!catatan) return galat(KODE_GALAT.CATATAN_TIDAK_DITEMUKAN, 404);

    const baris = await db.penimbanganReferensi.create({
      data: {
        catatanHarianId: hasil.data.catatanHarianId,
        wadahId: hasil.data.wadahId ?? null,
        beratGram: hasil.data.beratGram,
        beratWadahKosongGram: hasil.data.beratWadahKosongGram,
        porsiSetara: hasil.data.porsiSetara ?? null,
        // Satu-satunya nilai yang mungkin: tabel ini memang hanya untuk tim.
        diukurOleh: "tim_riset",
        metode: hasil.data.metode,
        tanggalUkur: tanggalUtc(hasil.data.tanggalUkur),
      },
    });

    return sukses(
      {
        penimbangan: {
          id: baris.id,
          // Berat bersih dihitung, bukan diketik ulang — supaya tidak ada dua
          // versi angka yang bisa berbeda.
          beratBersihGram: baris.beratGram - baris.beratWadahKosongGram,
        },
      },
      201,
    );
  });
}
