import { db } from "@/lib/db";
import { galat, KODE_GALAT, sukses, tangani } from "@/app/api/_lib/respons";
import { pesanDariZod, skemaTebakan } from "@/app/api/_lib/skema";
import { tanggalUtc } from "@/app/api/_lib/hitung";
import { risetAktif } from "../_lib/penjaga";

/*
 * 9.4 — POST /api/riset/tebakan
 *
 * Mengumpulkan tebakan MANUSIA terhadap isi wadah, dicatat SEBELUM penimbangan.
 * Gunanya membandingkan galat sistem dengan galat manusia pada tugas yang sama
 * — itulah yang membuat angka simpangan di halaman Akurasi punya pembanding.
 *
 * Peran penebak dicatat sebagai KATEGORI, bukan sebagai orang (aturan keras 1).
 * Tidak ada nama, tidak ada inisial, tidak ada pengenal apa pun.
 */

export const dynamic = "force-dynamic";

export async function POST(permintaan: Request) {
  return tangani(async () => {
    if (!risetAktif()) {
      return galat(KODE_GALAT.CATATAN_TIDAK_DITEMUKAN, 404, "Halaman tidak ditemukan.");
    }

    const badan: unknown = await permintaan.json().catch(() => null);
    const hasil = skemaTebakan.safeParse(badan);
    if (!hasil.success) {
      return galat(KODE_GALAT.VALIDASI_GAGAL, 422, pesanDariZod(hasil.error));
    }

    const catatan = await db.catatanHarian.findUnique({
      where: { id: hasil.data.catatanHarianId },
    });
    if (!catatan) return galat(KODE_GALAT.CATATAN_TIDAK_DITEMUKAN, 404);

    const baris = await db.sebaranTebakan.create({
      data: {
        catatanHarianId: hasil.data.catatanHarianId,
        wadahId: hasil.data.wadahId,
        peranPenebak: hasil.data.peranPenebak,
        tebakanPorsi: hasil.data.tebakanPorsi,
        angkaSebenarnya: hasil.data.angkaSebenarnya,
        kondisi: hasil.data.kondisi,
        tanggal: tanggalUtc(hasil.data.tanggal),
      },
    });

    return sukses({ tebakan: { id: baris.id } }, 201);
  });
}
