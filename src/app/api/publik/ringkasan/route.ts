import { galat, KODE_GALAT, sukses, tangani } from "@/app/api/_lib/respons";
import { porsiKeStringRingkas } from "@/core/porsi";
import { ambilRingkasanPublik } from "../_lib/ringkasan";

/*
 * 7.1 — GET /api/publik/ringkasan
 *
 * TANPA LOGIN, TANPA INPUT APA PUN (BLUEPRINT P1). Orang asing membuka tautan
 * ini di HP-nya sendiri dan langsung mendapat angka.
 *
 * Endpoint ini BUKAN jalur utama layar publik — halamannya dirender di server
 * dan memanggil `ambilRingkasanPublik()` langsung, supaya kontennya ada di HTML
 * pertama tanpa menunggu satu pun permintaan tambahan. Endpoint ini ada untuk
 * pemakaian lain: pembaruan berkala, salinan statis cadangan demo, dan siapa
 * pun yang ingin memeriksa angkanya sendiri.
 *
 * Nama dapur di sini SUDAH melewati `keDapurPublik()` di lapisan data — bentuk
 * `DapurPublik` tidak memuat nama asli sama sekali.
 */

export const dynamic = "force-dynamic";

export async function GET() {
  return tangani(async () => {
    const ringkasan = await ambilRingkasanPublik();

    if (!ringkasan) {
      /*
       * 503, bukan 404. Belum ada data bukan berarti alamatnya salah — ia
       * berarti layanannya belum punya apa pun untuk ditampilkan, dan itu
       * keadaan sementara.
       */
      return galat(
        KODE_GALAT.CATATAN_TIDAK_DITEMUKAN,
        503,
        "Belum ada data yang bisa ditampilkan.",
      );
    }

    const r = ringkasan.rekomendasi;

    return sukses({
      dapur: ringkasan.dapur,
      memakaiDapurContoh: ringkasan.memakaiDapurContoh,
      tanggal: ringkasan.tanggal,
      porsiDimasak: ringkasan.porsiDimasak,
      porsiTersisa: ringkasan.porsiTersisa,
      persenTersisa: ringkasan.persenTersisa,
      rupiahRentang: ringkasan.rupiahRentang,
      rekomendasiBesok:
        r.status === "siap"
          ? {
              status: "siap" as const,
              porsi: porsiKeStringRingkas(r.rekomendasi),
              lantaiKeras: porsiKeStringRingkas(r.lantaiKeras),
              aturanMenang: r.aturanMenang,
              catatanHarianIdDipakai: r.catatanHarianIdDipakai,
            }
          : {
              status: "belum_cukup_data" as const,
              jumlahData: r.jumlahData,
              sisaHari: r.sisaHari,
            },
      kalimatAlasan: r.status === "siap" ? r.kalimatAlasan : null,
      penimbanganTerakhir: ringkasan.penimbanganTerakhir,
      fotoUrl: ringkasan.fotoUrl,
    });
  });
}
