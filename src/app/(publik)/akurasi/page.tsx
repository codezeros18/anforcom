import Link from "next/link";
import { ambilDataAkurasi } from "@/app/api/publik/_lib/akurasi";
import { pilihDapurPublik } from "@/app/api/publik/_lib/ringkasan";
import type { KategoriFisik } from "@/core/tipe";

/*
 * LAYAR 8 — HALAMAN AKURASI.
 *
 * Ini keputusan strategis, bukan fitur biasa. Pertanyaan juri yang paling
 * sering muncul adalah "kalau AI-nya salah bagaimana?" (BLUEPRINT P3). Jawaban
 * terbaiknya bukan penjelasan lisan yang harus dipercaya, melainkan halaman
 * yang bisa dibuka orang lain dan diperiksa sendiri.
 *
 * TIGA HAL YANG MEMBUAT HALAMAN INI BERARTI — dan yang hilang kalau salah satu
 * dilanggar:
 *
 * 1. TIDAK ADA ANGKA YANG DI-HARDCODE (8.4). Seluruhnya dari `agregasiAkurasi()`
 *    di `core/audit.ts` — fungsi yang sama yang dipakai sistem sungguhan.
 * 2. TIDAK ADA ANGKA YANG DIPERHALUS. Simpangan ditampilkan apa adanya. Halaman
 *    yang memilih angka terbaiknya sendiri tidak membuktikan apa pun.
 * 3. YANG DIKECUALIKAN IKUT DIHITUNG DAN DISEBUT ALASANNYA. Pengecualian yang
 *    tidak diumumkan adalah cara paling halus untuk memperindah angka.
 *
 * Catatan warna: tidak ada merah di sini, sama seperti seluruh produk. Angka
 * kesalahan bukan tuduhan kepada siapa pun — ia keterangan tentang sistem kami.
 */

export const dynamic = "force-dynamic";

const NAMA_KATEGORI: Readonly<Record<KategoriFisik, string>> = {
  padat_rata: "Padat rata",
  padat_menggunung: "Padat menggunung",
  berkuah: "Berkuah",
};

/** Angka yang belum terdefinisi ditulis "belum ada", bukan "0". */
function teksAngka(nilai: string | null, satuan = "%"): string {
  return nilai === null ? "belum ada" : `${nilai}${satuan}`;
}

export default async function HalamanAkurasi() {
  const pilihan = await pilihDapurPublik();

  if (!pilihan) {
    return (
      <main className="mx-auto max-w-md p-6">
        <h1 className="text-badan font-semibold text-netral-900">Akurasi</h1>
        <p className="text-badan mt-3 text-netral-700">
          Belum ada pencatatan yang bisa diukur. Angka akurasi muncul di sini setelah
          estimasi pertama dikoreksi.
        </p>
      </main>
    );
  }

  const a = await ambilDataAkurasi(pilihan.dapur.id);

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 p-4 pb-10">
      <header>
        <h1 className="text-badan font-semibold text-netral-900">
          Seberapa sering sistem ini salah
        </h1>
        {pilihan.memakaiDapurContoh && (
          <p className="text-konteks mt-2 inline-block rounded bg-perhatian-100 px-2 py-1 text-perhatian-700">
            dapur contoh
          </p>
        )}
      </header>

      {/* BLOK 1 — ringkasan */}
      <section className="grid grid-cols-3 gap-3" aria-label="Ringkasan akurasi">
        <div>
          <p className="text-sekunder text-netral-900">{a.totalEstimasi}</p>
          <p className="text-konteks text-netral-600">estimasi tercatat</p>
        </div>
        <div>
          <p className="text-sekunder text-netral-900">{teksAngka(a.persenDikoreksi)}</p>
          <p className="text-konteks text-netral-600">dikoreksi manusia</p>
        </div>
        <div>
          <p className="text-sekunder text-netral-900">
            {teksAngka(a.simpanganRataPersen)}
          </p>
          <p className="text-konteks text-netral-600">simpangan rata-rata</p>
        </div>
      </section>

      <p className="text-konteks text-netral-600">
        Simpangan diukur terhadap angka hasil koreksi operator — orang yang melihat
        wadahnya langsung. Estimasi yang tidak pernah dikoreksi tidak dihitung sebagai
        simpangan nol.
      </p>

      {/* BLOK 2 — per kategori fisik */}
      <section aria-label="Akurasi per jenis permukaan">
        <h2 className="text-badan mb-2 font-semibold text-netral-900">
          Per jenis permukaan
        </h2>
        <div className="overflow-x-auto">
          <table className="text-konteks w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-netral-300 text-netral-600">
                <th className="py-2 font-medium">Permukaan</th>
                <th className="py-2 text-right font-medium">Estimasi</th>
                <th className="py-2 text-right font-medium">Dikoreksi</th>
                <th className="py-2 text-right font-medium">Simpangan</th>
              </tr>
            </thead>
            <tbody>
              {a.perKategoriFisik.map((k) => (
                <tr key={k.kategoriFisik} className="border-b border-netral-200">
                  <td className="py-2 text-netral-800">
                    {NAMA_KATEGORI[k.kategoriFisik]}
                  </td>
                  <td className="py-2 text-right text-netral-800">{k.totalEstimasi}</td>
                  <td className="py-2 text-right text-netral-800">
                    {teksAngka(k.persenDikoreksi)}
                  </td>
                  <td className="py-2 text-right text-netral-800">
                    {teksAngka(k.simpanganRataPersen)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-konteks mt-2 text-netral-600">
          Permukaan menggunung dan berkuah memang lebih sulit dibaca daripada permukaan
          rata. Rentang keyakinannya sudah dilebarkan sejak awal karena itu.
        </p>
      </section>

      {/* BLOK 3 — tren */}
      <section aria-label="Tren simpangan">
        <h2 className="text-badan mb-2 font-semibold text-netral-900">
          Apakah membaik seiring koreksi
        </h2>
        {a.tren === null ? (
          <p className="text-konteks text-netral-700">
            Koreksinya belum cukup untuk menyimpulkan arah. Tren muncul di sini setelah
            ada lebih banyak pencatatan — dua titik data yang kebetulan berbeda bukan
            tren.
          </p>
        ) : (
          <>
            <p className="text-badan text-netral-800">
              Paruh awal <span className="font-semibold">{a.tren.simpanganAwal}%</span> (
              {a.tren.jumlahKoreksiAwal} koreksi) → paruh terakhir{" "}
              <span className="font-semibold">{a.tren.simpanganAkhir}%</span> (
              {a.tren.jumlahKoreksiAkhir} koreksi)
            </p>
            <p className="text-konteks mt-1 text-netral-600">
              {a.tren.membaik
                ? "Simpangan mengecil seiring bertambahnya koreksi — konstanta wadah ikut diperbarui dari koreksi itu."
                : "Simpangan belum mengecil. Kami menampilkannya apa adanya; angka yang hanya ditampilkan saat bagus tidak bisa diperiksa."}
            </p>
          </>
        )}
      </section>

      {/* BLOK 4 — dikecualikan */}
      <section aria-label="Data yang dikecualikan">
        <h2 className="text-badan mb-2 font-semibold text-netral-900">
          Yang tidak dihitung
        </h2>
        <p className="text-badan text-netral-800">
          <span className="font-semibold">{a.jumlahDikecualikan}</span> estimasi
          dikecualikan.
        </p>
        {a.jumlahDikecualikan > 0 && (
          <>
            <p className="text-konteks mt-1 text-netral-600">
              Semuanya berasal dari hari yang ditandai anomali. Hari acara punya kondisi
              visual yang tidak mewakili operasi sehari-hari, jadi memasukkannya akan
              membuat angka di atas menjelaskan sesuatu yang bukan pemakaian normal.
            </p>
            {a.alasanDikecualikan.length > 0 && (
              <ul className="text-konteks mt-2 list-disc pl-5 text-netral-700">
                {a.alasanDikecualikan.map((alasan) => (
                  <li key={alasan}>{alasan}</li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>

      {/* BLOK 5 — kalimat penutup, persis seperti spesifikasi 8.3 */}
      <p className="text-badan border-t border-netral-200 pt-5 font-medium text-netral-900">
        Kami menampilkan tingkat kesalahan kami sendiri karena angka yang tidak bisa
        diperiksa tidak bisa dipercaya.
      </p>

      <Link href="/" className="text-konteks text-center text-netral-600 underline">
        Kembali ke ringkasan
      </Link>
    </main>
  );
}
