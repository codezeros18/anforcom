import { db } from "@/lib/db";
import { hitungPorsiFinal } from "@/core/audit";
import {
  porsiDariString,
  porsiKePerseratus,
  porsiKeStringRingkas,
  porsiKurang,
} from "@/core/porsi";
import type { KategoriFisik, MetodeEstimasi, Peran } from "@/core/tipe";

/*
 * Data layar 7 — riwayat 14 hari beserta detail per hari.
 *
 * YANG MEMBEDAKAN LAYAR INI DARI GRAFIK DI LAYAR PUBLIK: di sini setiap baris
 * bisa dibuka sampai ke estimasi dan koreksinya (8.2). Itu yang mengubah
 * "percayalah angkanya benar" menjadi "buka sendiri dan lihat siapa mengoreksi
 * apa, kapan".
 *
 * HARI ANOMALI TETAP DITAMPILKAN, TIDAK DIHAPUS. Ia dicoret secara visual
 * dengan alasannya terlihat. Menghapusnya dari daftar akan membuat riwayat
 * tampak lebih rapi daripada kenyataannya, dan menyembunyikan justru bagian
 * yang paling perlu dijelaskan: kenapa hari itu tidak dihitung.
 */

export interface KoreksiRinci {
  porsiSebelum: string;
  porsiSesudah: string;
  selisihAbsolut: string;
  peranPengoreksi: Peran;
  dibuatPada: string;
}

export interface EstimasiRinci {
  id: string;
  namaWadah: string;
  namaJenisMasakan: string;
  kategoriFisik: KategoriFisik;
  metode: MetodeEstimasi;
  porsiEstimasi: string;
  porsiFinal: string;
  /** `true` bila nilai final berbeda dari estimasi awal — ada koreksi yang mengubahnya. */
  berubah: boolean;
  rentangBawah: string;
  rentangAtas: string;
  koreksi: KoreksiRinci[];
}

export interface HariRinci {
  catatanHarianId: string;
  tanggal: string;
  porsiDimasak: string;
  porsiTersisaFinal: string | null;
  porsiTerpakai: string | null;
  isAnomali: boolean;
  alasanAnomali: string | null;
  estimasi: EstimasiRinci[];
}

const PANJANG_RIWAYAT_HARI = 14;

export async function ambilRiwayatRinci(dapurId: string): Promise<HariRinci[]> {
  const baris = await db.catatanHarian.findMany({
    where: { dapurId },
    orderBy: { tanggal: "desc" },
    take: PANJANG_RIWAYAT_HARI,
    include: {
      estimasi: {
        orderBy: { dibuatPada: "asc" },
        include: {
          wadah: { select: { nama: true } },
          jenisMasakan: { select: { nama: true, kategoriFisik: true } },
          koreksi: { orderBy: { dibuatPada: "asc" } },
        },
      },
    },
  });

  return baris.reverse().map((c) => {
    const dimasak = porsiDariString(c.porsiDimasak.toString());
    const tersisa =
      c.porsiTersisaFinal === null
        ? null
        : porsiDariString(c.porsiTersisaFinal.toString());

    return {
      catatanHarianId: c.id,
      tanggal: c.tanggal.toISOString().slice(0, 10),
      porsiDimasak: porsiKeStringRingkas(dimasak),
      porsiTersisaFinal: tersisa === null ? null : porsiKeStringRingkas(tersisa),
      porsiTerpakai:
        tersisa === null ? null : porsiKeStringRingkas(porsiKurang(dimasak, tersisa)),
      isAnomali: c.isAnomali,
      alasanAnomali: c.alasanAnomali,
      estimasi: c.estimasi.map((e) => {
        const awal = porsiDariString(e.porsiEstimasi.toString());
        const koreksiTercatat = e.koreksi.map((k) => ({
          porsiSesudah: porsiDariString(k.porsiSesudah.toString()),
          dibuatPada: k.dibuatPada,
        }));
        // Nilai final DIHITUNG dari estimasi + koreksi, tidak pernah dibaca dari
        // kolom yang ditimpa. Itu aturan keras 2, dan halaman ini adalah tempat
        // aturan itu terlihat oleh mata orang luar.
        const final = hitungPorsiFinal({ porsiEstimasi: awal }, koreksiTercatat);

        return {
          id: e.id,
          namaWadah: e.wadah.nama,
          namaJenisMasakan: e.jenisMasakan.nama,
          kategoriFisik: e.jenisMasakan.kategoriFisik,
          metode: e.metode,
          porsiEstimasi: porsiKeStringRingkas(awal),
          porsiFinal: porsiKeStringRingkas(final),
          berubah: porsiKePerseratus(final) !== porsiKePerseratus(awal),
          rentangBawah: porsiKeStringRingkas(porsiDariString(e.rentangBawah.toString())),
          rentangAtas: porsiKeStringRingkas(porsiDariString(e.rentangAtas.toString())),
          koreksi: e.koreksi.map((k) => ({
            porsiSebelum: porsiKeStringRingkas(
              porsiDariString(k.porsiSebelum.toString()),
            ),
            porsiSesudah: porsiKeStringRingkas(
              porsiDariString(k.porsiSesudah.toString()),
            ),
            selisihAbsolut: porsiKeStringRingkas(
              porsiDariString(k.selisihAbsolut.toString()),
            ),
            peranPengoreksi: k.peranPengoreksi,
            dibuatPada: k.dibuatPada.toISOString(),
          })),
        };
      }),
    };
  });
}
