import { db } from "@/lib/db";
import {
  porsiDariPerseratus,
  porsiDariString,
  porsiKePerseratus,
  porsiKeStringRingkas,
} from "@/core/porsi";

/*
 * Sebaran tebakan manusia — 8.8.
 *
 * KENAPA INI ADA. Halaman Akurasi menunjukkan seberapa sering sistem salah.
 * Angka itu sendirian tidak punya arti, karena tidak ada pembandingnya:
 * simpangan 12% itu bagus atau buruk? Sebaran tebakan menjawabnya dengan
 * membandingkan galat sistem terhadap galat MANUSIA pada tugas yang sama —
 * melihat wadah yang sama, lalu menebak isinya.
 *
 * ATURAN YANG DIPEGANG BERKAS INI: bila datanya belum ada, blok ini TIDAK
 * DITAMPILKAN SAMA SEKALI. Bukan placeholder, bukan angka contoh, bukan
 * "menyusul". Angka karangan di blok yang justru dibuat untuk membuktikan
 * kejujuran akan merobek seluruh halaman ini dalam satu pertanyaan.
 *
 * Peran penebak dicatat sebagai KATEGORI, bukan sebagai orang (aturan 1).
 */

export interface KomposisiPeran {
  peran: string;
  jumlah: number;
}

export interface SebaranTebakanPublik {
  n: number;
  min: string;
  maks: string;
  median: string;
  angkaSebenarnya: string;
  tanggal: string;
  komposisiPeran: KomposisiPeran[];
}

/**
 * Median dari daftar porsi, dihitung dalam bilangan bulat perseratus.
 *
 * Pada jumlah genap, median adalah rata-rata dua nilai tengah. Pembagian dua
 * dilakukan pada perseratus lalu dibulatkan — bukan pada nilai desimal —
 * sehingga tidak ada float yang menyentuh angka porsi (aturan keras 3).
 */
function medianPerseratus(terurut: readonly number[]): number {
  const n = terurut.length;
  const tengah = Math.floor(n / 2);

  if (n % 2 === 1) return terurut[tengah] ?? 0;

  const kiri = terurut[tengah - 1] ?? 0;
  const kanan = terurut[tengah] ?? 0;
  return Math.round((kiri + kanan) / 2);
}

/**
 * Sebaran tebakan untuk hari terakhir yang punya data.
 *
 * Dibatasi satu hari dan satu wadah dengan sengaja: menggabungkan tebakan dari
 * beberapa wadah berbeda menghasilkan sebaran yang tidak menjelaskan apa-apa,
 * karena "angka sebenarnya"-nya berbeda-beda.
 *
 * Mengembalikan `null` bila belum ada datanya — dan pemanggilnya wajib
 * menghilangkan seluruh blok, bukan menampilkan nol.
 */
export async function ambilSebaranTebakan(
  dapurId: string,
): Promise<SebaranTebakanPublik | null> {
  const terbaru = await db.sebaranTebakan.findFirst({
    where: { catatanHarian: { dapurId } },
    orderBy: { tanggal: "desc" },
  });
  if (!terbaru) return null;

  const semua = await db.sebaranTebakan.findMany({
    where: {
      catatanHarian: { dapurId },
      tanggal: terbaru.tanggal,
      wadahId: terbaru.wadahId,
    },
  });
  if (semua.length === 0) return null;

  const perseratus = semua
    .map((t) => porsiKePerseratus(porsiDariString(t.tebakanPorsi.toString())))
    .sort((a, b) => a - b);

  const komposisi = new Map<string, number>();
  for (const t of semua) {
    komposisi.set(t.peranPenebak, (komposisi.get(t.peranPenebak) ?? 0) + 1);
  }

  const keTeks = (n: number) => porsiKeStringRingkas(porsiDariPerseratus(n));

  return {
    n: semua.length,
    min: keTeks(perseratus[0] ?? 0),
    maks: keTeks(perseratus[perseratus.length - 1] ?? 0),
    median: keTeks(medianPerseratus(perseratus)),
    angkaSebenarnya: porsiKeStringRingkas(
      porsiDariString(terbaru.angkaSebenarnya.toString()),
    ),
    tanggal: terbaru.tanggal.toISOString().slice(0, 10),
    komposisiPeran: [...komposisi.entries()]
      .map(([peran, jumlah]) => ({ peran, jumlah }))
      .sort((a, b) => b.jumlah - a.jumlah),
  };
}
