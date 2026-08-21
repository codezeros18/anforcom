import { db } from "@/lib/db";
import {
  bolehTampilPublik,
  keDapurPublik,
  type DapurPublik,
} from "@/lib/serialisasi-publik";
import {
  type CatatanUntukRekomendasi,
  hitungRekomendasi,
  type HasilRekomendasi,
} from "@/core/rekomendasi";
import { hitungPorsiFinal } from "@/core/audit";
import {
  porsiDariString,
  porsiKePerseratus,
  porsiKeStringRingkas,
  porsiKurang,
  type Porsi,
} from "@/core/porsi";
import { hitungRentangRupiah, keSen, type RentangRupiah } from "@/app/api/_lib/hitung";

/*
 * Data untuk layar publik — satu tempat, dipakai halaman DAN endpoint.
 *
 * DUA ATURAN KERAS BERTEMU DI BERKAS INI:
 *
 * 1. ATURAN 10 — nama dapur SELALU lewat `keDapurPublik()`. Tidak ada satu pun
 *    jalur di berkas ini yang membaca `dapur.nama` langsung. Bentuk keluaran
 *    `DapurPublik` memang tidak punya nama asli, jadi kebocoran bukan sekadar
 *    dilarang — ia tidak tersedia.
 *
 * 2. ATURAN 8 — data dapur contoh tidak pernah menyamar sebagai data nyata.
 *    `isContoh` ikut ke setiap keluaran, dan layar wajib menampilkan badge
 *    beserta kalimat "Data lapangan sedang dikumpulkan".
 *
 * Menyamarkan data contoh sebagai data nyata bukan kompromi kosmetik — itu
 * pelanggaran integritas yang bisa mematikan seluruh kredibilitas dalam satu
 * pertanyaan di sesi tanya jawab.
 */

export interface HariRiwayat {
  tanggal: string;
  dimasak: string;
  terpakai: string | null;
  tersisa: string | null;
  isAnomali: boolean;
}

export interface RingkasanPublik {
  dapur: DapurPublik;
  /** `true` bila yang ditampilkan dapur contoh karena belum ada dapur nyata berizin. */
  memakaiDapurContoh: boolean;
  tanggal: string;
  tanggalPanjang: string;
  porsiDimasak: string;
  porsiTersisa: string;
  persenTersisa: string;
  rupiahRentang: RentangRupiah;
  rekomendasi: HasilRekomendasi;
  riwayat: HariRiwayat[];
  /** Tanggal penimbangan tim terakhir — sumber tunggal klaim dampak (aturan 5). */
  penimbanganTerakhir: string | null;
  fotoUrl: string | null;
}

const NAMA_HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const NAMA_BULAN = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

function tanggalPanjang(d: Date): string {
  const hari = NAMA_HARI[d.getUTCDay()] ?? "";
  const bulan = NAMA_BULAN[d.getUTCMonth()] ?? "";
  return `${hari}, ${String(d.getUTCDate())} ${bulan} ${String(d.getUTCFullYear())}`;
}

/** Persentase sisa terhadap yang dimasak, bilangan bulat sepanjang perhitungan. */
function persenTersisa(tersisa: Porsi, dimasak: Porsi): string {
  const bawah = porsiKePerseratus(dimasak);
  if (bawah === 0) return "0,0";
  const perseribu = Math.round((porsiKePerseratus(tersisa) * 1000) / bawah);
  return `${String(Math.floor(perseribu / 10))},${String(perseribu % 10)}`;
}

/**
 * Memilih dapur yang ditampilkan.
 *
 * Dapur nyata berizin lebih dulu. Kalau belum ada, dapur contoh — dengan
 * penanda yang membuat layar wajib mengatakannya terus terang.
 */
export async function pilihDapurPublik() {
  const berizin = await db.dapur.findMany({
    where: { isContoh: false, izinTampilPublik: true },
    orderBy: { dibuatPada: "asc" },
  });

  // Izin punya masa berlaku, dan izin kedaluwarsa sama artinya dengan tidak ada
  // izin. Penyaringannya di /src/lib, bukan diulang di sini.
  const sah = berizin.find((d) => bolehTampilPublik(d));
  if (sah) return { dapur: sah, memakaiDapurContoh: false };

  const contoh = await db.dapur.findFirst({ where: { isContoh: true } });
  return contoh ? { dapur: contoh, memakaiDapurContoh: true } : null;
}

export async function ambilRingkasanPublik(): Promise<RingkasanPublik | null> {
  const pilihan = await pilihDapurPublik();
  if (!pilihan) return null;

  const { dapur, memakaiDapurContoh } = pilihan;

  const baris = await db.catatanHarian.findMany({
    where: { dapurId: dapur.id },
    orderBy: { tanggal: "desc" },
    take: 30,
    include: { estimasi: { include: { koreksi: { orderBy: { dibuatPada: "asc" } } } } },
  });

  if (baris.length === 0) return null;

  const terbaru = baris.find((c) => c.porsiTersisaFinal !== null) ?? baris[0];
  if (!terbaru) return null;

  const dimasak = porsiDariString(terbaru.porsiDimasak.toString());
  const tersisa =
    terbaru.porsiTersisaFinal === null
      ? porsiDariString("0")
      : porsiDariString(terbaru.porsiTersisaFinal.toString());

  const untukRekomendasi: CatatanUntukRekomendasi[] = baris.map((c) => ({
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

  const besok = new Date(terbaru.tanggal);
  besok.setUTCDate(besok.getUTCDate() + 1);

  const riwayat: HariRiwayat[] = baris
    .slice(0, 14)
    .reverse()
    .map((c) => {
      const d = porsiDariString(c.porsiDimasak.toString());
      const s =
        c.porsiTersisaFinal === null
          ? null
          : porsiDariString(c.porsiTersisaFinal.toString());
      return {
        tanggal: c.tanggal.toISOString().slice(0, 10),
        dimasak: porsiKeStringRingkas(d),
        terpakai: s === null ? null : porsiKeStringRingkas(porsiKurang(d, s)),
        tersisa: s === null ? null : porsiKeStringRingkas(s),
        isAnomali: c.isAnomali,
      };
    });

  /*
   * Foto berlabel "estimasi X → dikoreksi Y" (bagian dari 7.3).
   *
   * Yang dicari adalah estimasi yang PUNYA koreksi — itulah yang menunjukkan
   * sistem ini bisa salah dan manusia bisa membetulkannya. Menampilkan estimasi
   * yang mulus justru melewatkan bagian paling meyakinkan dari produk ini.
   */
  const estimasiBerkoreksi = terbaru.estimasi.find((e) => e.koreksi.length > 0);
  const fotoUrl = estimasiBerkoreksi?.fotoUrl ?? null;

  const penimbangan = await db.penimbanganReferensi.findFirst({
    where: { catatanHarian: { dapurId: dapur.id } },
    orderBy: { tanggalUkur: "desc" },
  });

  return {
    // SATU-SATUNYA jalur nama dapur ke layar publik.
    dapur: keDapurPublik(dapur),
    memakaiDapurContoh,
    tanggal: terbaru.tanggal.toISOString().slice(0, 10),
    tanggalPanjang: tanggalPanjang(terbaru.tanggal),
    porsiDimasak: porsiKeStringRingkas(dimasak),
    porsiTersisa: porsiKeStringRingkas(tersisa),
    persenTersisa: persenTersisa(tersisa, dimasak),
    rupiahRentang: hitungRentangRupiah(
      tersisa,
      keSen(dapur.biayaBahanPerPorsiMin),
      keSen(dapur.biayaBahanPerPorsiMaks),
    ),
    rekomendasi: hitungRekomendasi(untukRekomendasi, besok),
    riwayat,
    penimbanganTerakhir: penimbangan?.tanggalUkur.toISOString().slice(0, 10) ?? null,
    fotoUrl,
  };
}

/** Label foto: "estimasi 38 → dikoreksi 41". */
export async function ambilLabelFoto(catatanHarianId: string): Promise<string | null> {
  const estimasi = await db.estimasi.findFirst({
    where: { catatanHarianId, koreksi: { some: {} } },
    include: { koreksi: { orderBy: { dibuatPada: "asc" } } },
  });
  if (!estimasi) return null;

  const awal = porsiDariString(estimasi.porsiEstimasi.toString());
  const final = hitungPorsiFinal(
    { porsiEstimasi: awal },
    estimasi.koreksi.map((k) => ({
      porsiSesudah: porsiDariString(k.porsiSesudah.toString()),
      dibuatPada: k.dibuatPada,
    })),
  );

  return `estimasi ${porsiKeStringRingkas(awal)} → dikoreksi ${porsiKeStringRingkas(final)}`;
}
