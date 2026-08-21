import Link from "next/link";
import { GrafikRiwayat } from "@/components/grafik-riwayat";
import { pilihDapurPublik } from "@/app/api/publik/_lib/ringkasan";
import { ambilRiwayatRinci, type HariRinci } from "@/app/api/publik/_lib/riwayat-rinci";

/*
 * LAYAR 7 — RIWAYAT 14 HARI.
 *
 * DUA HAL YANG MENENTUKAN APAKAH LAYAR INI BERGUNA:
 *
 * 1. HARI ANOMALI DICORET, BUKAN DIHAPUS (8.2). Ia tetap ada di tabel dengan
 *    garis coret dan alasannya terlihat. Menghapusnya akan membuat riwayat
 *    tampak lebih rapi daripada kenyataannya — dan justru menyembunyikan hal
 *    yang paling perlu dijelaskan: kenapa hari itu tidak ikut dihitung.
 *
 * 2. SETIAP BARIS BISA DIBUKA sampai estimasi dan koreksinya. Itu yang mengubah
 *    "percayalah angkanya benar" menjadi "buka sendiri dan lihat". Dibuat
 *    dengan <details>, bukan state React, supaya tetap bisa dibuka saat
 *    JavaScript belum dimuat.
 *
 * Tidak ada warna merah di sini. Hari dengan sisa besar bukan kesalahan
 * siapa pun — framingnya perencanaan, bukan evaluasi (CLAUDE.md bagian 5).
 */

export const dynamic = "force-dynamic";

const NAMA_METODE: Readonly<Record<string, string>> = {
  model: "foto",
  slider: "geser",
  manual: "ketik",
};

function BarisHari({ hari }: { hari: HariRinci }) {
  const adaKoreksi = hari.estimasi.some((e) => e.koreksi.length > 0);

  return (
    /*
     * `id` dan `open` dipakai bersama oleh tautan "Angka itu dari hari mana?"
     * di kartu rekomendasi: `/riwayat#hari-<id>` melompat ke baris ini, dan
     * `:target` di bawah membukanya. Tidak perlu halaman detail terpisah —
     * seluruh isinya sudah ada di baris ini.
     */
    <details
      id={`hari-${hari.catatanHarianId}`}
      className="border-b border-netral-200 target:bg-netral-100"
    >
      <summary className="text-badan flex cursor-pointer items-baseline justify-between gap-3 py-3">
        <span
          className={hari.isAnomali ? "text-netral-500 line-through" : "text-netral-900"}
        >
          {hari.tanggal}
        </span>
        <span
          className={
            hari.isAnomali
              ? "text-konteks text-netral-500 line-through"
              : "text-konteks text-netral-700"
          }
        >
          {hari.porsiDimasak} dimasak ·{" "}
          {hari.porsiTersisaFinal === null
            ? "belum ditutup"
            : `${hari.porsiTersisaFinal} tersisa`}
        </span>
      </summary>

      <div className="pb-4">
        {hari.isAnomali && (
          <p className="text-konteks mb-3 rounded-lg bg-perhatian-100 px-3 py-2 text-perhatian-700">
            Tidak dihitung dalam rekomendasi maupun akurasi
            {hari.alasanAnomali ? ` — ${hari.alasanAnomali}` : ""}.
          </p>
        )}

        {hari.estimasi.length === 0 ? (
          <p className="text-konteks text-netral-600">
            Belum ada wadah yang dicatat untuk hari ini.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {hari.estimasi.map((e) => (
              <li key={e.id} className="rounded-xl bg-netral-100 p-3">
                <p className="text-badan text-netral-900">
                  {e.namaWadah} · {e.namaJenisMasakan}
                </p>
                <p className="text-konteks mt-1 text-netral-700">
                  Dibaca lewat {NAMA_METODE[e.metode] ?? e.metode}: {e.porsiEstimasi}{" "}
                  porsi (rentang {e.rentangBawah}–{e.rentangAtas})
                </p>

                {e.berubah ? (
                  <p className="text-konteks mt-1 font-medium text-netral-900">
                    Setelah dikoreksi: {e.porsiFinal} porsi
                  </p>
                ) : (
                  <p className="text-konteks mt-1 text-netral-600">
                    Tidak dikoreksi — nilainya tetap {e.porsiFinal} porsi.
                  </p>
                )}

                {e.koreksi.length > 0 && (
                  <ol className="text-konteks mt-2 flex flex-col gap-1 border-t border-netral-200 pt-2 text-netral-700">
                    {e.koreksi.map((k, i) => (
                      <li key={`${e.id}-${String(i)}`}>
                        {k.porsiSebelum} → {k.porsiSesudah} (selisih {k.selisihAbsolut}),
                        oleh {k.peranPengoreksi}, {k.dibuatPada.slice(0, 10)}
                      </li>
                    ))}
                  </ol>
                )}
              </li>
            ))}
          </ul>
        )}

        {adaKoreksi && (
          <p className="text-konteks mt-3 text-netral-600">
            Nilai asli tidak pernah ditimpa. Setiap koreksi tersimpan sebagai baris baru,
            dan nilai final dihitung dari keduanya.
          </p>
        )}
      </div>
    </details>
  );
}

export default async function HalamanRiwayat() {
  const pilihan = await pilihDapurPublik();

  if (!pilihan) {
    return (
      <main className="mx-auto max-w-md p-6">
        <h1 className="text-badan font-semibold text-netral-900">Riwayat 14 hari</h1>
        <p className="text-badan mt-3 text-netral-700">
          Belum ada pencatatan. Riwayat muncul di sini setelah hari pertama dicatat.
        </p>
      </main>
    );
  }

  const hari = await ambilRiwayatRinci(pilihan.dapur.id);
  const jumlahAnomali = hari.filter((h) => h.isAnomali).length;

  return (
    <main className="mx-auto flex max-w-md flex-col gap-5 p-4 pb-10">
      <header>
        <h1 className="text-badan font-semibold text-netral-900">Riwayat 14 hari</h1>
        {pilihan.memakaiDapurContoh && (
          <p className="text-konteks mt-2 inline-block rounded bg-perhatian-100 px-2 py-1 text-perhatian-700">
            dapur contoh
          </p>
        )}
      </header>

      <GrafikRiwayat
        hari={hari.map((h) => ({
          tanggal: h.tanggal,
          dimasak: h.porsiDimasak,
          terpakai: h.porsiTerpakai,
          tersisa: h.porsiTersisaFinal,
          isAnomali: h.isAnomali,
        }))}
      />

      <section aria-label="Tabel riwayat">
        <p className="text-konteks mb-1 text-netral-600">
          Ketuk satu baris untuk melihat setiap wadah, pembacaannya, dan koreksinya.
        </p>
        <div>
          {hari.map((h) => (
            <BarisHari key={h.catatanHarianId} hari={h} />
          ))}
        </div>
      </section>

      {jumlahAnomali > 0 && (
        <p className="text-konteks text-netral-600">
          {jumlahAnomali} hari dicoret karena ditandai anomali. Hari itu tetap ditampilkan
          supaya terlihat apa yang dikecualikan dan kenapa — tetapi tidak ikut menghitung
          rekomendasi maupun angka akurasi.
        </p>
      )}

      <div className="grid gap-3">
        <Link
          href="/akurasi"
          className="text-badan flex h-14 items-center justify-center rounded-xl border-2 border-netral-300 font-medium text-netral-800"
        >
          Lihat halaman Akurasi
        </Link>
        <Link href="/" className="text-konteks text-center text-netral-600 underline">
          Kembali ke ringkasan
        </Link>
      </div>
    </main>
  );
}
