import { db } from "@/lib/db";
import { cariKonstanta, hitungPorsiTersisa, hitungRentang } from "@/core/kalibrasi";
import { KonstantaTidakDitemukan } from "@/core/galat";
import { fraksiDariString } from "@/core/fraksi";
import { porsiKeString } from "@/core/porsi";
import type { MetodeEstimasi } from "@/core/tipe";
import { ambilKonteksKalibrasi } from "./data";
import { kategoriDari } from "./hitung";

/*
 * Perakitan satu estimasi — dipakai jalur foto MAUPUN jalur slider.
 *
 * Ini bentuk konkret dari BLUEPRINT P4 ("slider setara, bukan darurat"): kedua
 * jalur memanggil fungsi yang SAMA dengan fraksi dari sumber berbeda. Kalau
 * masing-masing punya jalur perhitungannya sendiri, keduanya akan menyimpang
 * pelan-pelan — dan slider berhenti setara tanpa ada yang menyadarinya.
 */

export interface HasilPerakitanEstimasi {
  ok: true;
  estimasi: {
    id: string;
    porsiEstimasi: string;
    rentangBawah: string;
    rentangAtas: string;
    metode: MetodeEstimasi;
    latensiMs: number | null;
    wajibManual: boolean;
    isCampuran: boolean;
    /** Badge di layar: "Belum terkalibrasi — angka akan membaik…" */
    sumberKalibrasi: "deklarasi" | "terkalibrasi";
    konstantaPerkiraan: boolean;
  };
}

export interface WadahTidakTerdaftar {
  ok: false;
  sebab: "wadah_tidak_terdaftar";
}

export async function rakitEstimasi(masukan: {
  catatanHarianId: string;
  dapurId: string;
  wadahId: string;
  jenisMasakanId: string;
  fraksiTeks: string;
  metode: MetodeEstimasi;
  isCampuran: boolean;
  latensiMs: number | null;
  fotoUrl: string | null;
}): Promise<HasilPerakitanEstimasi | WadahTidakTerdaftar> {
  const konteks = await ambilKonteksKalibrasi(masukan.dapurId);

  let konstanta;
  try {
    konstanta = cariKonstanta(konteks, masukan.wadahId, masukan.jenisMasakanId);
  } catch (penyebab) {
    /*
     * Sistem MENOLAK MENEBAK. Ini bukan keterbatasan yang disembunyikan — ini
     * demonstrasi bahwa sistem tahu batas dirinya sendiri. Layar menjawabnya
     * dengan dua jalan keluar, bukan dengan jalan buntu.
     */
    if (penyebab instanceof KonstantaTidakDitemukan) {
      return { ok: false, sebab: "wadah_tidak_terdaftar" };
    }
    throw penyebab;
  }

  const fraksi = fraksiDariString(masukan.fraksiTeks);
  const porsiEstimasi = hitungPorsiTersisa(fraksi, konstanta.porsiPenuh);

  const rentang = hitungRentang({
    porsiEstimasi,
    kategoriFisik: kategoriDari(konteks, masukan.jenisMasakanId),
    perkiraan: konstanta.perkiraan,
    isCampuran: masukan.isCampuran,
    sumber: konstanta.sumber,
  });

  const baris = await db.estimasi.create({
    data: {
      catatanHarianId: masukan.catatanHarianId,
      wadahId: masukan.wadahId,
      jenisMasakanId: masukan.jenisMasakanId,
      metode: masukan.metode,
      fraksiKeterisian: masukan.fraksiTeks,
      porsiEstimasi: porsiKeString(porsiEstimasi),
      rentangBawah: porsiKeString(rentang.bawah),
      rentangAtas: porsiKeString(rentang.atas),
      isCampuran: masukan.isCampuran,
      latensiMs: masukan.latensiMs,
      fotoUrl: masukan.fotoUrl,
    },
  });

  return {
    ok: true,
    estimasi: {
      id: baris.id,
      porsiEstimasi: porsiKeString(porsiEstimasi),
      rentangBawah: porsiKeString(rentang.bawah),
      rentangAtas: porsiKeString(rentang.atas),
      metode: masukan.metode,
      latensiMs: masukan.latensiMs,
      // Campuran mewajibkan jalur manual — batas yang diakui, bukan ditambal.
      wajibManual: rentang.wajibManual,
      isCampuran: masukan.isCampuran,
      sumberKalibrasi: konstanta.sumber,
      konstantaPerkiraan: konstanta.perkiraan,
    },
  };
}
