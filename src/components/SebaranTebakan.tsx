import type { SebaranTebakanPublik } from "@/app/api/publik/_lib/tebakan";

/*
 * Sebaran tebakan manusia — 8.8.
 *
 * KENAPA BLOK INI ADA DI LAYAR PUBLIK. Halaman Akurasi mengatakan seberapa
 * sering sistem salah, tapi angka itu sendirian tidak punya pembanding:
 * simpangan 12% itu bagus atau buruk? Blok ini menjawabnya dengan menunjukkan
 * seberapa jauh MANUSIA meleset pada tugas yang persis sama — melihat wadah
 * yang sama, lalu menebak isinya.
 *
 * ATURAN YANG MEMBENTUK KOMPONEN INI: ia hanya dirender kalau datanya sudah
 * ada. Pemanggilnya melewatkan `null` bila belum, dan seluruh blok hilang —
 * bukan tampil dengan nol, bukan dengan "menyusul", bukan dengan angka contoh.
 * Angka karangan di blok yang justru dibuat untuk membuktikan kejujuran akan
 * merobek seluruh klaim halaman ini dalam satu pertanyaan.
 *
 * Peran penebak ditampilkan sebagai KATEGORI, bukan orang (aturan 1).
 */

const NAMA_PERAN: Readonly<Record<string, string>> = {
  staf_dapur: "staf dapur",
  pengunjung_lokasi: "pengunjung lokasi",
  lainnya: "lainnya",
};

export function SebaranTebakan({ sebaran }: { sebaran: SebaranTebakanPublik }) {
  const komposisi = sebaran.komposisiPeran
    .map((k) => `${String(k.jumlah)} ${NAMA_PERAN[k.peran] ?? k.peran}`)
    .join(", ");

  return (
    <section
      aria-label="Sebaran tebakan manusia"
      className="rounded-xl bg-netral-100 p-4"
    >
      <h2 className="text-badan font-semibold text-netral-900">
        Kalau manusia yang menebak
      </h2>
      <p className="text-konteks mt-1 text-netral-600">
        {sebaran.n} orang menebak isi wadah yang sama sebelum ditimbang, {sebaran.tanggal}
        .
      </p>

      <dl className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <dt className="text-konteks text-netral-600">Tebakan terendah</dt>
          <dd className="text-badan font-semibold text-netral-900">{sebaran.min}</dd>
        </div>
        <div>
          <dt className="text-konteks text-netral-600">Tebakan tertinggi</dt>
          <dd className="text-badan font-semibold text-netral-900">{sebaran.maks}</dd>
        </div>
        <div>
          <dt className="text-konteks text-netral-600">Median tebakan</dt>
          <dd className="text-badan font-semibold text-netral-900">{sebaran.median}</dd>
        </div>
        <div>
          <dt className="text-konteks text-netral-600">Angka sebenarnya</dt>
          <dd className="text-badan font-semibold text-netral-900">
            {sebaran.angkaSebenarnya}
          </dd>
        </div>
      </dl>

      <p className="text-konteks mt-3 text-netral-600">
        Penebak: {komposisi}. Angka sebenarnya berasal dari timbangan tim di lokasi.
      </p>
    </section>
  );
}
