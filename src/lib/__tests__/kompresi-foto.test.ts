import { describe, expect, it } from "vitest";
import {
  hitungDimensiTarget,
  memenuhiBatas,
  SISI_TERPANJANG_MAKS,
  TANGGA_MUTU,
  UKURAN_MAKS_BYTE,
} from "../kompresi-foto.ts";

/*
 * Yang diuji di sini adalah ARITMETIKA UKURAN, bukan penggambaran kanvas.
 *
 * Penggambaran hanya bisa dijalankan di peramban dan diverifikasi dengan foto
 * HP sungguhan (tugas verifikasi lapangan). Aritmetikanya bisa dan harus diuji
 * di sini — kalau ia hanya bisa diuji di peramban, ia tidak akan pernah diuji,
 * dan batas 1280 px akan meleset satu piksel tanpa ada yang tahu.
 */

describe("batas yang mengikat", () => {
  it("sesuai BLUEPRINT bagian 8", () => {
    expect(SISI_TERPANJANG_MAKS).toBe(1280);
    expect(UKURAN_MAKS_BYTE).toBe(600 * 1024);
  });

  it("tangga mutu menurun dan tetap di rentang yang wajar", () => {
    expect(TANGGA_MUTU.length).toBeGreaterThan(1);
    for (let i = 1; i < TANGGA_MUTU.length; i++) {
      expect(TANGGA_MUTU[i]!).toBeLessThan(TANGGA_MUTU[i - 1]!);
    }
    expect(TANGGA_MUTU[0]).toBeLessThanOrEqual(1);
    expect(TANGGA_MUTU[TANGGA_MUTU.length - 1]!).toBeGreaterThan(0);
  });
});

describe("hitungDimensiTarget (4.6)", () => {
  it("mengecilkan foto HP potret sampai sisi terpanjang tepat 1280", () => {
    // Ukuran umum kamera HP: 3024 x 4032 (4:3 potret).
    const hasil = hitungDimensiTarget({ lebar: 3024, tinggi: 4032 });

    expect(hasil.tinggi).toBe(1280);
    expect(hasil.lebar).toBe(960);
  });

  it("mengecilkan foto lanskap", () => {
    const hasil = hitungDimensiTarget({ lebar: 4032, tinggi: 3024 });

    expect(hasil.lebar).toBe(1280);
    expect(hasil.tinggi).toBe(960);
  });

  it("mempertahankan rasio aspek", () => {
    const asli = { lebar: 4000, tinggi: 2250 }; // 16:9
    const hasil = hitungDimensiTarget(asli);

    const rasioAsli = asli.lebar / asli.tinggi;
    const rasioHasil = hasil.lebar / hasil.tinggi;
    expect(Math.abs(rasioAsli - rasioHasil)).toBeLessThan(0.01);
  });

  it("TIDAK memperbesar foto yang sudah kecil", () => {
    // Memperbesar hanya menambah byte tanpa menambah informasi.
    const hasil = hitungDimensiTarget({ lebar: 640, tinggi: 480 });
    expect(hasil).toEqual({ lebar: 640, tinggi: 480 });
  });

  it("membiarkan foto yang tepat di batas", () => {
    const hasil = hitungDimensiTarget({ lebar: 1280, tinggi: 720 });
    expect(hasil).toEqual({ lebar: 1280, tinggi: 720 });
  });

  it("sisi terpanjang TIDAK PERNAH melebihi batas, pada 500 rasio acak", () => {
    /*
     * Pembulatan adalah cara klasik meleset satu piksel di atas batas. Contoh
     * satu per satu tidak menangkapnya; menyapu banyak rasio menangkapnya.
     */
    let benih = 4242;
    const acak = (maks: number) => {
      benih = (benih * 1103515245 + 12345) & 0x7fffffff;
      return 1 + (benih % maks);
    };

    for (let i = 0; i < 500; i++) {
      const asli = { lebar: acak(6000), tinggi: acak(6000) };
      const hasil = hitungDimensiTarget(asli);

      expect(Math.max(hasil.lebar, hasil.tinggi)).toBeLessThanOrEqual(
        SISI_TERPANJANG_MAKS,
      );
      expect(hasil.lebar).toBeGreaterThanOrEqual(1);
      expect(hasil.tinggi).toBeGreaterThanOrEqual(1);
      expect(Number.isInteger(hasil.lebar)).toBe(true);
      expect(Number.isInteger(hasil.tinggi)).toBe(true);
    }
  });

  it("foto sangat panjang tetap menyisakan minimal satu piksel di sisi pendek", () => {
    const hasil = hitungDimensiTarget({ lebar: 10_000, tinggi: 3 });

    expect(hasil.lebar).toBe(1280);
    expect(hasil.tinggi).toBeGreaterThanOrEqual(1);
  });

  it("menolak dimensi tidak sah dengan pesan yang menyebut penyebabnya", () => {
    // Dimensi nol biasanya berarti foto gagal dimuat, bukan foto berukuran nol.
    expect(() => hitungDimensiTarget({ lebar: 0, tinggi: 100 })).toThrow(/gagal dimuat/);
    expect(() => hitungDimensiTarget({ lebar: -5, tinggi: 100 })).toThrow();
    expect(() => hitungDimensiTarget({ lebar: NaN, tinggi: 100 })).toThrow();
  });
});

describe("memenuhiBatas", () => {
  it("menerima yang memenuhi kedua batas", () => {
    expect(memenuhiBatas(500 * 1024, { lebar: 1280, tinggi: 960 })).toBe(true);
  });

  it("menolak yang terlalu besar byte-nya", () => {
    expect(memenuhiBatas(700 * 1024, { lebar: 1280, tinggi: 960 })).toBe(false);
  });

  it("menolak yang dimensinya melebihi batas meski byte-nya kecil", () => {
    // Kedua batas mengikat. Foto 4000 px yang kebetulan kecil byte-nya tetap
    // membuang bandwidth dan waktu dekode di HP murah.
    expect(memenuhiBatas(100 * 1024, { lebar: 4000, tinggi: 3000 })).toBe(false);
  });

  it("menerima tepat di batas", () => {
    expect(memenuhiBatas(UKURAN_MAKS_BYTE, { lebar: 1280, tinggi: 1280 })).toBe(true);
  });
});
