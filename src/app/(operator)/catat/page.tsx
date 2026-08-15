import { db } from "@/lib/db";
import { hitungRekomendasi, type CatatanUntukRekomendasi } from "@/core/rekomendasi";
import { porsiDariString, porsiKeStringRingkas } from "@/core/porsi";
import { ambilDapurAktif } from "@/app/api/_lib/data";
import { LayarPorsiDimasak } from "./LayarPorsiDimasak";

/*
 * Layar 2 dirender di server supaya angka bawaan sudah ada di HTML pertama.
 *
 * Kalau rekomendasi diambil lewat fetch sesudah halaman muncul, operator di
 * jaringan dapur akan melihat field kosong lebih dulu, mengetik angkanya
 * sendiri, lalu angka bawaan datang dan menimpanya. Merender di server
 * menghilangkan seluruh kelas masalah itu.
 */

export const dynamic = "force-dynamic";

export default async function HalamanCatat() {
  const dapur = await ambilDapurAktif();

  const hariIni = new Date();
  const tanggalHariIni = new Date(
    Date.UTC(hariIni.getUTCFullYear(), hariIni.getUTCMonth(), hariIni.getUTCDate()),
  );
  const tanggalTeks = tanggalHariIni.toISOString().slice(0, 10);

  if (!dapur) {
    // State kosong. Tidak menyalahkan siapa pun, dan menyebut langkah berikutnya.
    return (
      <main className="mx-auto max-w-md p-6">
        <p className="text-badan text-netral-700">
          Dapur belum disiapkan. Hubungi pendamping untuk mendaftarkannya.
        </p>
      </main>
    );
  }

  const baris = await db.catatanHarian.findMany({
    where: { dapurId: dapur.id },
    orderBy: { tanggal: "desc" },
    take: 30,
  });

  const catatan: CatatanUntukRekomendasi[] = baris.map((c) => ({
    id: c.id,
    tanggal: c.tanggal,
    porsiDimasak: porsiDariString(c.porsiDimasak.toString()),
    porsiTersisaFinal:
      c.porsiTersisaFinal === null
        ? null
        : porsiDariString(c.porsiTersisaFinal.toString()),
    isAnomali: c.isAnomali,
    alasanAnomali: c.alasanAnomali,
  }));

  const rekomendasi = hitungRekomendasi(catatan, tanggalHariIni);

  /*
   * Di bawah ambang data minimum TIDAK ADA ANGKA — bukan angka pucat, bukan
   * angka dengan tanda tanya. Pesan ambangnya menyebut berapa hari lagi, supaya
   * operator tahu ini sementara dan bukan kerusakan (CLAUDE.md aturan 7).
   */
  const nilaiAwal =
    rekomendasi.status === "siap" ? porsiKeStringRingkas(rekomendasi.rekomendasi) : null;

  const kalimatAlasan =
    rekomendasi.status === "siap"
      ? rekomendasi.kalimatAlasan
      : `Data masih ${String(rekomendasi.jumlahData)} hari. Saran angka muncul setelah 5 hari pencatatan.`;

  return (
    <LayarPorsiDimasak
      tanggalHariIni={tanggalTeks}
      nilaiAwal={nilaiAwal}
      kalimatAlasan={kalimatAlasan}
    />
  );
}
