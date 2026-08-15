/*
 * Penghapusan metadata foto di sisi server.
 *
 * KENAPA INI ADA, dan kenapa ia bukan kenyamanan tapi kewajiban:
 * metadata EXIF foto HP memuat KOORDINAT GPS. Menyimpan foto sisa makanan
 * apa adanya berarti menyimpan lokasi persis dapur yang mempercayai kita —
 * termasuk dapur yang meminta namanya disamarkan. CLAUDE.md aturan 9
 * mewajibkan metadata dihapus di server sebelum penyimpanan.
 *
 * "Di server" itu bagian yang penting. Kompresi di sisi klien kebetulan sering
 * membuang EXIF juga, tapi klien tidak bisa dipercaya: foto bisa diunggah lewat
 * jalur lain, versi peramban berbeda berperilaku berbeda, dan pengunggah yang
 * jahat bisa mengirim apa saja. Pembuangan di server adalah satu-satunya titik
 * yang benar-benar mengikat.
 *
 * KENAPA DITULIS SENDIRI, bukan memakai pustaka pengolah gambar:
 * membuang segmen metadata dari JPEG dan PNG adalah pekerjaan membaca panjang
 * segmen dan melewatinya — seratusan baris tanpa dependensi. Memasang pustaka
 * pengolah gambar berarti menambah biner native ke jalur unggah demi pekerjaan
 * yang tidak menyentuh piksel sama sekali. CLAUDE.md bagian 4 melarang
 * menambah bobot untuk masalah yang tidak ada.
 *
 * Piksel tidak disentuh sedikit pun. Yang dibuang hanya blok metadata.
 */

/** Segmen JPEG yang dibuang: APP0–APP15 (0xE0–0xEF) dan COM (0xFE). */
function segmenJpegDibuang(penanda: number): boolean {
  return (penanda >= 0xe0 && penanda <= 0xef) || penanda === 0xfe;
}

/**
 * Chunk PNG yang dibuang.
 *
 * `eXIf` memuat EXIF penuh termasuk GPS. `tEXt`/`zTXt`/`iTXt` memuat teks bebas
 * yang sering diisi nama perangkat dan perangkat lunak. `tIME` memuat waktu
 * modifikasi terakhir.
 */
const CHUNK_PNG_DIBUANG = new Set(["eXIf", "tEXt", "zTXt", "iTXt", "tIME"]);

const TANDA_PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export type FormatFoto = "jpeg" | "png" | "tidak_dikenal";

export function kenaliFormat(data: Uint8Array): FormatFoto {
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) {
    return "jpeg";
  }
  if (data.length >= 8 && TANDA_PNG.every((b, i) => data[i] === b)) return "png";
  return "tidak_dikenal";
}

/**
 * Membuang seluruh segmen metadata dari JPEG.
 *
 * Struktur JPEG: SOI, lalu deretan segmen `FF xx` + panjang 2 byte (big-endian,
 * panjangnya sudah termasuk dua byte itu sendiri), sampai SOS (`FFDA`) yang
 * diikuti data terkompresi sampai akhir berkas.
 */
function bersihkanJpeg(data: Uint8Array): Uint8Array {
  const potongan: Uint8Array[] = [];
  // SOI selalu ikut.
  potongan.push(data.subarray(0, 2));

  let i = 2;
  while (i + 1 < data.length) {
    if (data[i] !== 0xff) {
      // Byte pengisi atau berkas rusak. Salin sisanya apa adanya daripada
      // menebak — merusak foto lebih buruk daripada menyisakan byte tak dikenal.
      potongan.push(data.subarray(i));
      break;
    }

    const penanda = data[i + 1]!;

    // Byte isian 0xFF berturut-turut.
    if (penanda === 0xff) {
      i += 1;
      continue;
    }

    // SOS: sesudah ini data terkompresi, tidak ada metadata lagi.
    if (penanda === 0xda) {
      potongan.push(data.subarray(i));
      break;
    }

    // EOI.
    if (penanda === 0xd9) {
      potongan.push(data.subarray(i, i + 2));
      break;
    }

    // Penanda tanpa muatan.
    if (penanda >= 0xd0 && penanda <= 0xd8) {
      potongan.push(data.subarray(i, i + 2));
      i += 2;
      continue;
    }

    if (i + 3 >= data.length) {
      potongan.push(data.subarray(i));
      break;
    }

    const panjang = (data[i + 2]! << 8) | data[i + 3]!;
    // Panjang minimal 2 (dua byte panjang itu sendiri). Nilai di bawah itu
    // berarti berkas rusak; berhenti membaca daripada melangkah mundur.
    if (panjang < 2 || i + 2 + panjang > data.length) {
      potongan.push(data.subarray(i));
      break;
    }

    if (!segmenJpegDibuang(penanda)) {
      potongan.push(data.subarray(i, i + 2 + panjang));
    }

    i += 2 + panjang;
  }

  return gabung(potongan);
}

/**
 * Membuang chunk metadata dari PNG.
 *
 * Struktur PNG: tanda 8 byte, lalu chunk `panjang(4) + tipe(4) + data + CRC(4)`.
 * Chunk yang dipertahankan disalin utuh beserta CRC-nya, jadi tidak ada CRC
 * yang perlu dihitung ulang.
 */
function bersihkanPng(data: Uint8Array): Uint8Array {
  const potongan: Uint8Array[] = [data.subarray(0, 8)];
  const tampilan = new DataView(data.buffer, data.byteOffset, data.byteLength);

  let i = 8;
  while (i + 8 <= data.length) {
    const panjangData = tampilan.getUint32(i);
    const tipe = String.fromCharCode(
      data[i + 4]!,
      data[i + 5]!,
      data[i + 6]!,
      data[i + 7]!,
    );
    const panjangTotal = 12 + panjangData;

    if (panjangData > data.length || i + panjangTotal > data.length) {
      potongan.push(data.subarray(i));
      break;
    }

    if (!CHUNK_PNG_DIBUANG.has(tipe)) {
      potongan.push(data.subarray(i, i + panjangTotal));
    }

    i += panjangTotal;
    if (tipe === "IEND") break;
  }

  return gabung(potongan);
}

function gabung(potongan: readonly Uint8Array[]): Uint8Array {
  const total = potongan.reduce((jumlah, p) => jumlah + p.length, 0);
  const hasil = new Uint8Array(total);
  let posisi = 0;
  for (const p of potongan) {
    hasil.set(p, posisi);
    posisi += p.length;
  }
  return hasil;
}

export interface HasilPembersihan {
  data: Uint8Array;
  format: FormatFoto;
  /** Berapa byte metadata yang dibuang. Dicatat di log, bukan ditampilkan. */
  byteDibuang: number;
}

/**
 * Membuang seluruh metadata dari foto sebelum disimpan.
 *
 * Format yang tidak dikenali dikembalikan APA ADANYA dan ditandai
 * `tidak_dikenal` — pemanggil di batas sistem wajib MENOLAK berkas semacam itu,
 * bukan menyimpannya. Menyimpan berkas yang tidak bisa kita bersihkan sama saja
 * dengan tidak membersihkan sama sekali.
 */
export function hapusMetadataFoto(data: Uint8Array): HasilPembersihan {
  const format = kenaliFormat(data);

  const bersih =
    format === "jpeg"
      ? bersihkanJpeg(data)
      : format === "png"
        ? bersihkanPng(data)
        : data;

  return { data: bersih, format, byteDibuang: data.length - bersih.length };
}

/**
 * Apakah data masih memuat penanda metadata yang dikenal.
 *
 * Dipakai tes sebagai pemeriksaan kedua: bukan "apakah fungsi kita mengaku
 * sudah membuang", melainkan "apakah bytenya benar-benar sudah tidak ada".
 */
export function masihAdaMetadata(data: Uint8Array): boolean {
  const format = kenaliFormat(data);

  if (format === "jpeg") {
    let i = 2;
    while (i + 3 < data.length) {
      if (data[i] !== 0xff) return false;
      const penanda = data[i + 1]!;
      if (penanda === 0xda || penanda === 0xd9) return false;
      if (penanda === 0xff) {
        i += 1;
        continue;
      }
      if (penanda >= 0xd0 && penanda <= 0xd8) {
        i += 2;
        continue;
      }
      if (segmenJpegDibuang(penanda)) return true;
      const panjang = (data[i + 2]! << 8) | data[i + 3]!;
      if (panjang < 2) return false;
      i += 2 + panjang;
    }
    return false;
  }

  if (format === "png") {
    const tampilan = new DataView(data.buffer, data.byteOffset, data.byteLength);
    let i = 8;
    while (i + 8 <= data.length) {
      const panjangData = tampilan.getUint32(i);
      const tipe = String.fromCharCode(
        data[i + 4]!,
        data[i + 5]!,
        data[i + 6]!,
        data[i + 7]!,
      );
      if (CHUNK_PNG_DIBUANG.has(tipe)) return true;
      i += 12 + panjangData;
      if (tipe === "IEND") break;
    }
    return false;
  }

  return false;
}
