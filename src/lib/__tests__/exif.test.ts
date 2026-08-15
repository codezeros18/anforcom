import { describe, expect, it } from "vitest";
import { hapusMetadataFoto, kenaliFormat, masihAdaMetadata } from "../exif.ts";

/*
 * Metadata EXIF foto HP memuat KOORDINAT GPS. Menyimpan foto apa adanya berarti
 * menyimpan lokasi persis dapur yang mempercayai kita — termasuk dapur yang
 * meminta namanya disamarkan (CLAUDE.md aturan 9).
 *
 * Berkas uji dibangun byte demi byte di sini, bukan dilampirkan sebagai foto
 * contoh. Alasannya bukan kepraktisan: repo ini tidak boleh memuat foto yang
 * benar-benar berisi koordinat sungguhan, dan berkas yang dibangun di tempat
 * membuat setiap byte GPS terlihat di tes — pembaca bisa melihat persis apa
 * yang seharusnya hilang.
 */

/** Bytes yang mewakili koordinat GPS di dalam segmen EXIF. */
const PENANDA_GPS = Array.from("GPSLatitude:-6.5971,GPSLongitude:106.7942").map((c) =>
  c.charCodeAt(0),
);

function segmenJpeg(penanda: number, muatan: number[]): number[] {
  const panjang = muatan.length + 2;
  return [0xff, penanda, (panjang >> 8) & 0xff, panjang & 0xff, ...muatan];
}

/** JPEG dengan APP1/EXIF berisi GPS, APP0/JFIF, komentar, dan data gambar sungguhan. */
function buatJpegBerGps(): Uint8Array {
  const exif = [
    ...Array.from("Exif\0\0").map((c) => c.charCodeAt(0)),
    0x49,
    0x49,
    0x2a,
    0x00, // header TIFF little-endian
    ...PENANDA_GPS,
  ];

  return new Uint8Array([
    0xff,
    0xd8, // SOI
    ...segmenJpeg(
      0xe0,
      Array.from("JFIF\0").map((c) => c.charCodeAt(0)),
    ), // APP0
    ...segmenJpeg(0xe1, exif), // APP1 — di sinilah GPS berada
    ...segmenJpeg(
      0xfe,
      Array.from("Dibuat oleh Kamera HP").map((c) => c.charCodeAt(0)),
    ), // COM
    ...segmenJpeg(0xdb, [0x00, 0x01, 0x02, 0x03]), // DQT — BUKAN metadata, wajib bertahan
    ...segmenJpeg(0xc0, [0x08, 0x00, 0x10, 0x00, 0x10, 0x01]), // SOF0 — dimensi gambar
    0xff,
    0xda,
    0x00,
    0x08,
    0x01,
    0x01,
    0x00,
    0x00,
    0x3f,
    0x00, // SOS
    0x11,
    0x22,
    0x33,
    0x44,
    0x55,
    0x66, // data terkompresi
    0xff,
    0xd9, // EOI
  ]);
}

function chunkPng(tipe: string, muatan: number[]): number[] {
  const panjang = muatan.length;
  return [
    (panjang >>> 24) & 0xff,
    (panjang >>> 16) & 0xff,
    (panjang >>> 8) & 0xff,
    panjang & 0xff,
    ...Array.from(tipe).map((c) => c.charCodeAt(0)),
    ...muatan,
    0xde,
    0xad,
    0xbe,
    0xef, // CRC boneka
  ];
}

function buatPngBerGps(): Uint8Array {
  return new Uint8Array([
    0x89,
    0x50,
    0x4e,
    0x47,
    0x0d,
    0x0a,
    0x1a,
    0x0a, // tanda PNG
    ...chunkPng("IHDR", [0, 0, 0, 16, 0, 0, 0, 16, 8, 2, 0, 0, 0]),
    ...chunkPng("eXIf", PENANDA_GPS), // GPS
    ...chunkPng(
      "tEXt",
      Array.from("Software\0Kamera HP").map((c) => c.charCodeAt(0)),
    ),
    ...chunkPng("tIME", [0x07, 0xea, 0x08, 0x0f, 0x0a, 0x1e, 0x00]),
    ...chunkPng("IDAT", [0x78, 0x9c, 0x01, 0x02, 0x03]), // data piksel — wajib bertahan
    ...chunkPng("IEND", []),
  ]);
}

/** Apakah deretan byte penanda masih ada di dalam data. */
function memuat(data: Uint8Array, penanda: readonly number[]): boolean {
  outer: for (let i = 0; i + penanda.length <= data.length; i++) {
    for (let j = 0; j < penanda.length; j++) {
      if (data[i + j] !== penanda[j]) continue outer;
    }
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------

describe("pengenalan format", () => {
  it("mengenali JPEG dan PNG", () => {
    expect(kenaliFormat(buatJpegBerGps())).toBe("jpeg");
    expect(kenaliFormat(buatPngBerGps())).toBe("png");
  });

  it("menandai format lain sebagai tidak dikenal", () => {
    expect(kenaliFormat(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]))).toBe("tidak_dikenal");
    expect(kenaliFormat(new Uint8Array())).toBe("tidak_dikenal");
  });
});

describe("penghapusan EXIF pada JPEG (4.7)", () => {
  it("berkas ujinya memang berisi GPS sebelum dibersihkan", () => {
    /*
     * Tanpa tes ini, seluruh berkas ini bisa hijau hanya karena berkas ujinya
     * tidak pernah punya GPS sejak awal.
     */
    const asli = buatJpegBerGps();
    expect(memuat(asli, PENANDA_GPS)).toBe(true);
    expect(masihAdaMetadata(asli)).toBe(true);
  });

  it("KOORDINAT GPS BENAR-BENAR HILANG dari byte hasil", () => {
    const { data } = hapusMetadataFoto(buatJpegBerGps());

    expect(memuat(data, PENANDA_GPS)).toBe(false);
    expect(masihAdaMetadata(data)).toBe(false);
  });

  it("membuang APP0, APP1, dan komentar", () => {
    const { data } = hapusMetadataFoto(buatJpegBerGps());
    const teks = Buffer.from(data).toString("latin1");

    expect(teks).not.toContain("Exif");
    expect(teks).not.toContain("JFIF");
    expect(teks).not.toContain("Kamera HP");
  });

  it("MEMPERTAHANKAN data gambar — piksel tidak disentuh", () => {
    // Membuang metadata tidak boleh merusak fotonya. Tabel kuantisasi, dimensi,
    // dan data terkompresi wajib utuh.
    const { data } = hapusMetadataFoto(buatJpegBerGps());

    expect(data[0]).toBe(0xff);
    expect(data[1]).toBe(0xd8); // SOI
    expect(memuat(data, [0xff, 0xdb])).toBe(true); // DQT bertahan
    expect(memuat(data, [0xff, 0xc0])).toBe(true); // SOF0 bertahan
    expect(memuat(data, [0xff, 0xda])).toBe(true); // SOS bertahan
    expect(memuat(data, [0x11, 0x22, 0x33, 0x44, 0x55, 0x66])).toBe(true); // data piksel
    expect(data[data.length - 2]).toBe(0xff);
    expect(data[data.length - 1]).toBe(0xd9); // EOI
  });

  it("melaporkan berapa byte yang dibuang", () => {
    const asli = buatJpegBerGps();
    const { byteDibuang, data } = hapusMetadataFoto(asli);

    expect(byteDibuang).toBeGreaterThan(0);
    expect(byteDibuang).toBe(asli.length - data.length);
  });

  it("aman dijalankan dua kali", () => {
    const sekali = hapusMetadataFoto(buatJpegBerGps()).data;
    const duaKali = hapusMetadataFoto(sekali);

    expect(duaKali.byteDibuang).toBe(0);
    expect(Array.from(duaKali.data)).toEqual(Array.from(sekali));
  });
});

describe("penghapusan metadata pada PNG (4.7)", () => {
  it("berkas ujinya memang berisi GPS sebelum dibersihkan", () => {
    expect(memuat(buatPngBerGps(), PENANDA_GPS)).toBe(true);
    expect(masihAdaMetadata(buatPngBerGps())).toBe(true);
  });

  it("membuang eXIf, tEXt, dan tIME", () => {
    const { data } = hapusMetadataFoto(buatPngBerGps());
    const teks = Buffer.from(data).toString("latin1");

    expect(memuat(data, PENANDA_GPS)).toBe(false);
    expect(teks).not.toContain("eXIf");
    expect(teks).not.toContain("tEXt");
    expect(teks).not.toContain("Kamera HP");
    expect(masihAdaMetadata(data)).toBe(false);
  });

  it("MEMPERTAHANKAN IHDR, IDAT, dan IEND", () => {
    const { data } = hapusMetadataFoto(buatPngBerGps());
    const teks = Buffer.from(data).toString("latin1");

    expect(teks).toContain("IHDR");
    expect(teks).toContain("IDAT");
    expect(teks).toContain("IEND");
    expect(memuat(data, [0x78, 0x9c, 0x01, 0x02, 0x03])).toBe(true); // data piksel
  });

  it("tanda PNG tetap utuh", () => {
    const { data } = hapusMetadataFoto(buatPngBerGps());
    expect(Array.from(data.subarray(0, 8))).toEqual([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
  });
});

describe("format tak dikenal", () => {
  it("dikembalikan apa adanya DAN ditandai, supaya batas sistem bisa menolaknya", () => {
    /*
     * Menyimpan berkas yang tidak bisa kita bersihkan sama saja dengan tidak
     * membersihkan sama sekali. Penandaan ini yang memungkinkan route handler
     * Sprint 5 menolaknya, alih-alih menyimpan sesuatu yang isinya tak diketahui.
     */
    const asing = new Uint8Array([0x00, 0x01, 0x02, 0x03, ...PENANDA_GPS]);
    const hasil = hapusMetadataFoto(asing);

    expect(hasil.format).toBe("tidak_dikenal");
    expect(hasil.byteDibuang).toBe(0);
  });
});

describe("berkas rusak tidak membuat proses jatuh", () => {
  const rusak: Array<[string, Uint8Array]> = [
    ["JPEG terpotong", new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0x00])],
    ["JPEG hanya SOI", new Uint8Array([0xff, 0xd8])],
    [
      "panjang segmen tidak masuk akal",
      new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0xff, 0xff, 0x01]),
    ],
    ["panjang segmen nol", new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0x00, 0x00, 0x01])],
    [
      "PNG terpotong",
      new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]),
    ],
    ["kosong", new Uint8Array()],
  ];

  it.each(rusak)("%s ditangani tanpa melempar", (_nama, data) => {
    expect(() => hapusMetadataFoto(data)).not.toThrow();
  });
});
