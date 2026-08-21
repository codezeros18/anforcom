import Link from "next/link";
import { AngkaPahlawan } from "@/components/AngkaPahlawan";
import { GrafikRiwayat } from "@/components/grafik-riwayat";
import { KartuRekomendasi } from "@/components/KartuRekomendasi";
import { SebaranTebakan } from "@/components/SebaranTebakan";
import { porsiKeStringRingkas } from "@/core/porsi";
import { ambilLabelFoto, ambilRingkasanPublik } from "@/app/api/publik/_lib/ringkasan";
import { ambilSebaranTebakan } from "@/app/api/publik/_lib/tebakan";

/*
 * LAYAR 1 — layar publik. Layar terpenting di seluruh produk.
 *
 * BLUEPRINT P1: "Nilai muncul dalam 60 detik tanpa login dan tanpa input apa
 * pun." Orang asing membuka tautan ini di HP-nya sendiri, di jaringan yang
 * tidak kita kendalikan, tanpa ada yang memandu.
 *
 * TIGA KEPUTUSAN YANG MENENTUKAN APAKAH ITU TERCAPAI:
 *
 * 1. SERVER COMPONENT, memanggil basis data LANGSUNG — bukan `fetch` ke
 *    endpoint sendiri. Satu perjalanan jaringan, bukan dua. Pada 400 kbps /
 *    400 ms RTT, perjalanan kedua saja sudah memakan hampir sepertiga anggaran
 *    tiga detik.
 *
 * 2. SELURUH KONTEN UTAMA ADA DI HTML PERTAMA. Angka pahlawan, rupiah,
 *    rekomendasi, kalimat alasan, grafik — semuanya dirender di server. Uji
 *    dengan JavaScript dimatikan: semuanya tetap ada. Satu-satunya bagian yang
 *    butuh JavaScript adalah tombol salin, dan halaman tetap berguna tanpanya.
 *
 * 3. URUTANNYA NILAI DULU, AKSI KEMUDIAN. Tombol "Coba sebagai operator" ada di
 *    BAWAH, sesudah angka dan grafik. Menaruhnya di atas akan meminta orang
 *    memutuskan sesuatu sebelum dia punya alasan untuk peduli.
 */

export const dynamic = "force-dynamic";

export default async function LayarPublik({
  searchParams,
}: {
  searchParams: Promise<{ tebak?: string }>;
}) {
  const { tebak } = await searchParams;
  const ringkasan = await ambilRingkasanPublik();

  if (!ringkasan) {
    return (
      <main className="mx-auto max-w-md p-6">
        <h1 className="text-badan font-semibold text-netral-900">SISA</h1>
        <p className="text-badan mt-3 text-netral-700">
          Data lapangan sedang dikumpulkan. Angka akan muncul di sini begitu pencatatan
          dimulai.
        </p>
      </main>
    );
  }

  const labelFoto = ringkasan.fotoUrl ? await ambilLabelFoto(ringkasan.tanggal) : null;
  const r = ringkasan.rekomendasi;

  /*
   * 8.8 — sebaran tebakan hanya ditampilkan BILA DATANYA SUDAH ADA.
   *
   * `null` berarti blok itu hilang seluruhnya. Bukan placeholder, bukan nol,
   * bukan "menyusul": angka karangan di blok yang dibuat untuk membuktikan
   * kejujuran akan merobek seluruh halaman ini dalam satu pertanyaan.
   */
  const sebaran = await ambilSebaranTebakan(ringkasan.dapur.id);

  return (
    <main className="mx-auto flex max-w-md flex-col gap-5 p-4 pb-10">
      {/*
       * ATURAN 8 — data contoh TIDAK PERNAH menyamar sebagai data nyata.
       *
       * Kalimat ini di paling atas, sebelum angka apa pun, dan hilang otomatis
       * begitu ada dapur nyata berizin. Menyamarkan data contoh bukan kompromi
       * kosmetik — ia pelanggaran integritas yang bisa dirobek satu pertanyaan.
       */}
      {ringkasan.memakaiDapurContoh && (
        <div className="rounded-xl bg-perhatian-100 px-4 py-3">
          <p className="text-badan font-medium text-perhatian-700">
            <span className="mr-2 rounded bg-perhatian-700 px-2 py-0.5 text-[12px] text-perhatian-100">
              dapur contoh
            </span>
          </p>
          <p className="text-konteks mt-2 text-perhatian-700">
            Data lapangan sedang dikumpulkan. Yang ditampilkan saat ini adalah dapur
            contoh.
          </p>
        </div>
      )}

      {/* baris konteks — 14px */}
      <p className="text-konteks text-netral-600">
        {ringkasan.dapur.nama} · Kec. {ringkasan.dapur.kecamatan} ·{" "}
        {ringkasan.tanggalPanjang}
      </p>

      {/* ANGKA PAHLAWAN 72px + label 18px */}
      <AngkaPahlawan
        angka={ringkasan.porsiTersisa}
        label="porsi tersisa hari ini"
        tertutup={tebak === "1"}
      />

      {/* baris pendukung — 24px */}
      <p className="text-[24px] leading-snug text-netral-700">
        dari {ringkasan.porsiDimasak} dimasak · {ringkasan.persenTersisa}%
      </p>

      {/* baris rupiah — 32px tebal */}
      <p className="text-[32px] font-bold leading-tight text-netral-900">
        ≈ Rp {ringkasan.rupiahRentang.bawah}–{ringkasan.rupiahRentang.atas} bahan
      </p>

      {/* KARTU REKOMENDASI */}
      {r.status === "siap" ? (
        <KartuRekomendasi
          status="siap"
          porsi={porsiKeStringRingkas(r.rekomendasi)}
          lantaiKeras={porsiKeStringRingkas(r.lantaiKeras)}
          kalimatAlasan={r.kalimatAlasan}
          hariDipakai={r.basisDariHari.map((h) => ({
            catatanHarianId: h.catatanHarianId,
            tanggal: h.tanggal.toISOString().slice(0, 10),
            konsumsi: porsiKeStringRingkas(h.konsumsi),
          }))}
        />
      ) : (
        <KartuRekomendasi
          status="belum_cukup_data"
          jumlahData={r.jumlahData}
          sisaHari={r.sisaHari}
        />
      )}

      {/* foto berlabel */}
      {ringkasan.fotoUrl && (
        <figure className="m-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={ringkasan.fotoUrl}
            alt="Sisa makanan di wadah pada hari ini"
            className="w-full rounded-2xl object-cover"
          />
          {labelFoto && (
            <figcaption className="text-konteks mt-2 text-netral-600">
              {labelFoto}
            </figcaption>
          )}
        </figure>
      )}

      {/* sebaran tebakan — hilang seluruhnya bila datanya belum ada */}
      {sebaran && <SebaranTebakan sebaran={sebaran} />}

      {/* grafik 14 hari */}
      <section aria-label="Riwayat 14 hari">
        <h2 className="text-konteks mb-2 text-netral-600">14 hari terakhir</h2>
        <GrafikRiwayat hari={ringkasan.riwayat} />
      </section>

      {/*
       * Pita metode — ATURAN 5 dan konsekuensi rubrik nomor 3.
       *
       * "Setiap angka dampak harus punya sumber, tanggal, metode, dan rentang.
       * Angka yang tidak bisa dipertanggungjawabkan lebih merugikan daripada
       * tidak ada angka sama sekali."
       *
       * Kalau belum ada penimbangan tim, pita ini mengatakannya terus terang
       * alih-alih menghilang — pita yang hilang membuat angka rupiah di atas
       * tampak seolah punya dasar yang tidak pernah disebutkan.
       */}
      <p className="text-konteks border-t border-netral-200 pt-4 text-netral-600">
        {ringkasan.penimbanganTerakhir
          ? `Data diukur tim di lokasi pada ${ringkasan.penimbanganTerakhir}. Metode: timbangan gantung digital.`
          : "Angka rupiah di atas dihitung dari estimasi harian, belum dari timbangan tim. Angka dampak menunggu penimbangan di lokasi."}
      </p>

      {/* tombol — NILAI DULU, AKSI KEMUDIAN */}
      <div className="grid gap-3">
        <Link
          href="/coba"
          className="text-badan flex h-14 items-center justify-center rounded-xl bg-aksen-500 font-semibold text-white"
        >
          Coba sebagai operator
        </Link>
        <Link
          href="/riwayat"
          className="text-badan flex h-14 items-center justify-center rounded-xl border-2 border-netral-300 font-medium text-netral-800"
        >
          Lihat riwayat 14 hari
        </Link>
        <Link
          href="/akurasi"
          className="text-badan flex h-14 items-center justify-center rounded-xl border-2 border-netral-300 font-medium text-netral-800"
        >
          Lihat halaman Akurasi
        </Link>
      </div>
    </main>
  );
}
