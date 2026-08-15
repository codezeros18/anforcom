/*
 * Mesin rekomendasi porsi besok.
 *
 * Ini komponen kedua yang membedakan produk ini dari CRUD. Tiga hal di dalamnya
 * adalah keputusan yang alasannya harus dipahami sebelum menyentuh kodenya:
 *
 * 1. LANTAI KERAS TIDAK BISA DIMATIKAN. Rekomendasi yang menyebabkan kekurangan
 *    makanan tidak boleh ada, apa pun kata datanya. Perhatikan bahwa fungsi di
 *    berkas ini tidak menerima objek opsi, flag, atau parameter apa pun yang
 *    bisa melewati lantai. Itu bukan kelalaian desain API — itu desainnya.
 *    Menambahkan parameter semacam itu melanggar CLAUDE.md aturan 6.
 *
 * 2. ANOMALI DIKECUALIKAN DARI BASIS **DAN** DARI LANTAI. Ini yang paling mudah
 *    luput. Kalau satu hari acara dengan konsumsi 500 ikut masuk perhitungan
 *    lantai, seluruh rekomendasi 14 hari berikutnya terkunci di 500 — sistem
 *    akan memaksa dapur memasak berlebih setiap hari gara-gara satu hari
 *    istimewa, dan produk yang dirancang menekan sisa justru memproduksinya.
 *
 * 3. TIDAK ADA BUFFER DI ATAS LANTAI. Lantai keras sudah menjadi mekanisme
 *    keamanannya. Menambah buffer persentase berarti menghitung margin dua kali
 *    dan diam-diam mendorong dapur memasak berlebih.
 *
 * Ambang |D| >= 5 juga bukan preferensi. Rekomendasi dari dua titik data adalah
 * angka yang terlihat berwibawa tapi tidak berarti apa-apa.
 */

import { GalatDataCatatanTidakSah } from "./galat.ts";
import {
  type Porsi,
  porsiCeilKeUtuh,
  porsiKeStringRingkas,
  porsiKurang,
  porsiMaks,
  porsiRataRataUntukTampilan,
  rataRataCeilUtuh,
} from "./porsi.ts";

// ---------------------------------------------------------------------------
// Tetapan — tidak ada satu pun yang boleh dijadikan pengaturan
// ---------------------------------------------------------------------------

/**
 * Panjang jendela `D`, dalam hari. Dipakai untuk LANTAI KERAS dan basis
 * `rata_umum`. Persis seperti BLUEPRINT: "Konsumsi tertinggi dalam 14 hari".
 */
export const PANJANG_JENDELA_HARI = 14;

/**
 * Panjang jendela untuk mencari pola HARI YANG SAMA, dalam hari.
 *
 * ---------------------------------------------------------------------------
 * KENAPA ANGKA INI 21 DAN BUKAN 14 — kontradiksi spesifikasi yang terpaksa
 * diputuskan di sini. Dicatat juga di PROGRESS.md bagian "butuh keputusan
 * manusia"; kalau keputusannya berbeda, ubah di sini saja.
 * ---------------------------------------------------------------------------
 *
 * BLUEPRINT 9.2 menulis `H = { t dalam D : hari_dalam_minggu(t) = ... }` dengan
 * `D` berjendela 14 hari, lalu mensyaratkan `|H| >= 3` supaya basis memakai
 * pola mingguan.
 *
 * Kedua hal itu tidak bisa benar bersamaan. Dalam 14 hari hanya ada DUA hari
 * dengan nama hari yang sama (besok−7 dan besok−14); besok−21 sudah di luar
 * jendela. Jadi `|H| >= 3` tidak akan pernah terpenuhi dan seluruh cabang
 * `hari_sama` menjadi kode mati — padahal contoh kalimat alasan di BLUEPRINT
 * sendiri berbunyi "Rabu **tiga minggu terakhir** terpakai 289, 294, 290".
 *
 * Kalimat itu yang menyelesaikan tafsirnya: pola mingguan memang dimaksudkan
 * melihat tiga minggu ke belakang. Maka:
 *
 *   - `D` tetap 14 hari. Lantai keras tidak berubah sedikit pun, dan kalimat
 *     "Konsumsi tertinggi dalam 14 hari" tetap benar apa adanya. Melebarkan
 *     jendela lantai justru berbahaya — hari ekstrem yang sudah lama lewat akan
 *     mengunci rekomendasi lebih lama.
 *   - Pencarian hari-sama memakai 21 hari, sehingga "tiga minggu terakhir"
 *     benar secara harfiah.
 *
 * Sengaja BUKAN 28 hari. Dengan 28 hari, tiga kemunculan yang terpilih bisa
 * berasal dari minggu ke-1, ke-2, dan ke-4 — dan kalimat "tiga minggu terakhir"
 * berubah menjadi klaim yang tidak benar. Angka di kalimat alasan harus cocok
 * dengan hari yang benar-benar dipakai.
 */
export const PANJANG_JENDELA_HARI_SAMA = 21;

/**
 * Jumlah hari minimum sebelum rekomendasi ditampilkan.
 *
 * Aturan integritas, bukan preferensi (BLUEPRINT 9.2). Tidak boleh diturunkan
 * meski data lapangan datang terlambat.
 */
export const AMBANG_DATA_MINIMUM = 5;

/** Berapa kemunculan hari yang sama diperlukan sebelum basis memakai pola mingguan. */
export const MINIMUM_HARI_SAMA = 3;

const NAMA_HARI = [
  "Minggu",
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
] as const;

// ---------------------------------------------------------------------------
// Bentuk masukan dan keluaran
// ---------------------------------------------------------------------------

export interface CatatanUntukRekomendasi {
  id: string;
  /** Tanggal operasional. Diperlakukan sebagai tanggal UTC — lihat catatan zona waktu. */
  tanggal: Date;
  porsiDimasak: Porsi;
  /** `null` selama hari itu belum difinalisasi. Hari seperti itu tidak masuk `D`. */
  porsiTersisaFinal: Porsi | null;
  isAnomali: boolean;
  alasanAnomali: string | null;
}

/** Satu hari beserta konsumsinya, dengan id supaya angkanya bisa ditelusuri di UI. */
export interface HariTerpakai {
  catatanHarianId: string;
  tanggal: Date;
  konsumsi: Porsi;
}

export type AturanBasis = "hari_sama" | "rata_umum";
export type AturanMenang = AturanBasis | "lantai";

export interface RekomendasiBelumCukupData {
  status: "belum_cukup_data";
  jumlahData: number;
  sisaHari: number;
}

export interface RekomendasiSiap {
  status: "siap";

  /** Angka yang ditampilkan sebagai saran. Selalu porsi utuh. */
  rekomendasi: Porsi;
  aturan: AturanBasis;
  aturanMenang: AturanMenang;

  /** Basis apa adanya, untuk ditampilkan. Keputusan memakai `basisCeil`. */
  basis: Porsi;
  basisCeil: Porsi;

  /** Konsumsi tertinggi pada `D`. Tidak pernah bisa dilewati rekomendasi. */
  lantaiKeras: Porsi;
  /** Hari asal lantai keras, supaya angkanya bisa diklik ke sumbernya. */
  lantaiDariHari: HariTerpakai;

  jumlahData: number;
  /** Seluruh `D`, urut menaik. */
  hariDipakai: HariTerpakai[];
  /** Hari yang benar-benar masuk perhitungan basis. */
  basisDariHari: HariTerpakai[];
  /** Id seluruh hari yang dipakai — jalan pintas untuk UI. */
  catatanHarianIdDipakai: string[];

  jumlahDikecualikanAnomali: number;
  alasanDikecualikan: string[];
  /**
   * Hari dalam jendela yang belum difinalisasi (`porsiTersisaFinal` masih null).
   * Dikecualikan dari `D`, tapi bukan anomali — dibedakan supaya kalimat alasan
   * tidak menuduh hari yang sekadar belum selesai dicatat sebagai hari tak biasa.
   */
  jumlahBelumFinal: number;

  kalimatAlasan: string;
}

export type HasilRekomendasi = RekomendasiBelumCukupData | RekomendasiSiap;

// ---------------------------------------------------------------------------
// Tanggal — seluruhnya UTC
// ---------------------------------------------------------------------------

/*
 * CATATAN ZONA WAKTU.
 *
 * Kolom `tanggal` bertipe DATE di Postgres dan sampai ke JavaScript sebagai
 * `Date` pada tengah malam UTC. Seluruh perhitungan di berkas ini memakai
 * `getUTC*`, tidak pernah `getDay()`/`getDate()` versi lokal.
 *
 * Kenapa ini penting dan bukan kerewelan: pada server dengan zona waktu di
 * sebelah barat UTC (misalnya UTC-5), tengah malam UTC adalah pukul 19.00 hari
 * SEBELUMNYA dalam waktu lokal. `getDay()` akan mengembalikan hari yang salah,
 * dan basis "hari_sama" diam-diam membandingkan Rabu dengan Selasa. Bugnya tidak
 * pernah muncul saat dikembangkan di Indonesia (UTC+7) dan baru muncul di
 * server production di benua lain — jenis kegagalan yang paling mahal dicari.
 */

const MILIDETIK_PER_HARI = 86_400_000;

/** Nomor hari sejak epoch, dihitung dari komponen UTC. Membuang komponen jam. */
function nomorHari(tanggal: Date): number {
  return Math.floor(
    Date.UTC(tanggal.getUTCFullYear(), tanggal.getUTCMonth(), tanggal.getUTCDate()) /
      MILIDETIK_PER_HARI,
  );
}

/** 0 = Minggu ... 6 = Sabtu, selalu menurut UTC. */
function hariDalamMinggu(tanggal: Date): number {
  return new Date(nomorHari(tanggal) * MILIDETIK_PER_HARI).getUTCDay();
}

// ---------------------------------------------------------------------------
// Langkah 1 — konsumsi aktual
// ---------------------------------------------------------------------------

/**
 * `konsumsi = porsiDimasak - porsiTersisaFinal`.
 *
 * Melempar bila hasilnya negatif. Sisa yang lebih besar daripada yang dimasak
 * mustahil secara fisik, jadi kalau nilai itu sampai ke sini, ada validasi di
 * batas sistem yang bocor. Membiarkannya lewat akan menghasilkan lantai keras
 * yang salah tanpa ada yang menyadarinya.
 */
export function hitungKonsumsiAktual(catatan: CatatanUntukRekomendasi): Porsi | null {
  if (catatan.porsiTersisaFinal === null) return null;

  const konsumsi = porsiKurang(catatan.porsiDimasak, catatan.porsiTersisaFinal);
  if (konsumsi < 0) {
    throw new GalatDataCatatanTidakSah(
      `Porsi tersisa melebihi porsi dimasak pada catatan ${catatan.id}: ` +
        `dimasak ${porsiKeStringRingkas(catatan.porsiDimasak)}, ` +
        `tersisa ${porsiKeStringRingkas(catatan.porsiTersisaFinal)}.`,
    );
  }
  return konsumsi;
}

// ---------------------------------------------------------------------------
// Langkah 2 — himpunan sah D
// ---------------------------------------------------------------------------

interface HimpunanSah {
  /** `D` — jendela 14 hari. Sumber lantai keras dan basis `rata_umum`. */
  hariDipakai: HariTerpakai[];
  /** Jendela 21 hari, untuk mencari pola hari-sama. Superset dari `hariDipakai`. */
  hariJendelaLuas: HariTerpakai[];
  jumlahDikecualikanAnomali: number;
  alasanDikecualikan: string[];
  jumlahBelumFinal: number;
}

/**
 * Menyaring hari yang sah: bukan anomali, sudah difinalisasi.
 *
 * Jendelanya berakhir pada hari SEBELUM `tanggalBesok` — yaitu hari ini dan
 * sekian hari sebelumnya. Hari `tanggalBesok` sendiri tentu tidak ikut: ia belum
 * terjadi, dan justru itu yang sedang direncanakan.
 *
 * Angka pengecualian dihitung pada jendela 14 hari saja, karena kalimat alasan
 * berbicara tentang jendela itu ("Konsumsi tertinggi dalam 14 hari"). Menghitung
 * anomali dari 21 hari akan membuat "2 hari tidak dihitung" merujuk rentang yang
 * berbeda dari angka di kalimat sebelumnya.
 */
function saringHimpunanSah(
  catatan: readonly CatatanUntukRekomendasi[],
  tanggalBesok: Date,
): HimpunanSah {
  const hariBesok = nomorHari(tanggalBesok);
  const hariTerakhir = hariBesok - 1;
  const hariPertamaSempit = hariBesok - PANJANG_JENDELA_HARI;
  const hariPertamaLuas = hariBesok - PANJANG_JENDELA_HARI_SAMA;

  const hariDipakai: HariTerpakai[] = [];
  const hariJendelaLuas: HariTerpakai[] = [];
  const alasan = new Set<string>();
  let jumlahDikecualikanAnomali = 0;
  let jumlahBelumFinal = 0;

  for (const c of catatan) {
    const hari = nomorHari(c.tanggal);
    if (hari < hariPertamaLuas || hari > hariTerakhir) continue;

    const didalamJendelaSempit = hari >= hariPertamaSempit;

    if (c.isAnomali) {
      // Dikecualikan dari basis DAN dari lantai — di kedua jendela.
      // Lihat catatan di kepala berkas: satu hari acara yang lolos ke lantai
      // akan mengunci rekomendasi selama dua minggu berikutnya.
      if (didalamJendelaSempit) {
        jumlahDikecualikanAnomali++;
        const teks = c.alasanAnomali?.trim();
        if (teks) alasan.add(teks);
      }
      continue;
    }

    const konsumsi = hitungKonsumsiAktual(c);
    if (konsumsi === null) {
      if (didalamJendelaSempit) jumlahBelumFinal++;
      continue;
    }

    const hariTerpakai = { catatanHarianId: c.id, tanggal: c.tanggal, konsumsi };
    hariJendelaLuas.push(hariTerpakai);
    if (didalamJendelaSempit) hariDipakai.push(hariTerpakai);
  }

  const urutMenaik = (a: HariTerpakai, b: HariTerpakai) =>
    nomorHari(a.tanggal) - nomorHari(b.tanggal);
  hariDipakai.sort(urutMenaik);
  hariJendelaLuas.sort(urutMenaik);

  return {
    hariDipakai,
    hariJendelaLuas,
    jumlahDikecualikanAnomali,
    alasanDikecualikan: [...alasan],
    jumlahBelumFinal,
  };
}

// ---------------------------------------------------------------------------
// Langkah 3–5 + kalimat alasan
// ---------------------------------------------------------------------------

/**
 * Menghitung rekomendasi porsi untuk `tanggalBesok`.
 *
 * Perhatikan tanda tangannya: dua parameter, tanpa objek opsi. Tidak ada cara
 * memanggil fungsi ini yang menghasilkan angka di bawah lantai keras.
 */
export function hitungRekomendasi(
  catatan: readonly CatatanUntukRekomendasi[],
  tanggalBesok: Date,
): HasilRekomendasi {
  const {
    hariDipakai,
    hariJendelaLuas,
    jumlahDikecualikanAnomali,
    alasanDikecualikan,
    jumlahBelumFinal,
  } = saringHimpunanSah(catatan, tanggalBesok);

  // Ambang dihitung dari `D` (14 hari), bukan dari jendela luas. Jendela luas
  // hanya melayani pencarian pola mingguan; ia tidak boleh membuat rekomendasi
  // muncul lebih cepat daripada yang diizinkan aturan integritas.
  const jumlahData = hariDipakai.length;

  // Ambang. Di bawah ini tidak ada angka rekomendasi sama sekali — bukan angka
  // dengan peringatan kecil, bukan angka berwarna abu-abu. Tidak ada angka.
  if (jumlahData < AMBANG_DATA_MINIMUM) {
    return {
      status: "belum_cukup_data",
      jumlahData,
      sisaHari: AMBANG_DATA_MINIMUM - jumlahData,
    };
  }

  // LANGKAH 3 — basis
  //
  // Pencarian hari-sama memakai jendela luas (21 hari); basis `rata_umum` dan
  // lantai tetap memakai `D` (14 hari). Alasannya panjang dan ada di komentar
  // `PANJANG_JENDELA_HARI_SAMA` di atas.
  const hariBesokDalamMinggu = hariDalamMinggu(tanggalBesok);
  const hariSama = hariJendelaLuas.filter(
    (h) => hariDalamMinggu(h.tanggal) === hariBesokDalamMinggu,
  );

  const pakaiHariSama = hariSama.length >= MINIMUM_HARI_SAMA;
  const aturan: AturanBasis = pakaiHariSama ? "hari_sama" : "rata_umum";
  // "tiga terakhir" — `hariDipakai` sudah urut menaik, jadi tiga di ujung
  // adalah tiga kemunculan terbaru.
  const basisDariHari = pakaiHariSama ? hariSama.slice(-MINIMUM_HARI_SAMA) : hariDipakai;

  const konsumsiBasis = basisDariHari.map((h) => h.konsumsi);
  const basis = porsiRataRataUntukTampilan(konsumsiBasis);
  const basisCeil = rataRataCeilUtuh(konsumsiBasis);

  // LANGKAH 4 — lantai keras
  const lantaiKeras = porsiMaks(hariDipakai.map((h) => h.konsumsi));
  const lantaiDariHari = hariDipakai.find((h) => h.konsumsi === lantaiKeras)!;

  // LANGKAH 5 — hasil
  //
  // Lantai dibulatkan ke atas juga. Rekomendasi adalah perintah memasak sekian
  // porsi dan harus berupa bilangan utuh; membulatkan lantai ke bawah berarti
  // menyarankan angka di bawah konsumsi tertinggi yang pernah terjadi, yaitu
  // persis kekurangan yang lantai keras ada untuk mencegahnya.
  const lantaiCeil = porsiCeilKeUtuh(lantaiKeras);
  const rekomendasi = basisCeil >= lantaiCeil ? basisCeil : lantaiCeil;
  const aturanMenang: AturanMenang = lantaiKeras > basisCeil ? "lantai" : aturan;

  const kalimatAlasan = rakitKalimatAlasan({
    aturan,
    aturanMenang,
    hariBesokDalamMinggu,
    basisDariHari,
    basis,
    jumlahData,
    lantaiKeras,
    rekomendasi,
    jumlahDikecualikanAnomali,
    alasanDikecualikan,
  });

  return {
    status: "siap",
    rekomendasi,
    aturan,
    aturanMenang,
    basis,
    basisCeil,
    lantaiKeras,
    lantaiDariHari,
    jumlahData,
    hariDipakai,
    basisDariHari,
    // Gabungan `D` dan hari yang dipakai basis. Basis `hari_sama` bisa memakai
    // hari di luar 14 hari, dan setiap angka di kalimat alasan harus bisa
    // diklik ke hari asalnya — termasuk yang itu.
    catatanHarianIdDipakai: [
      ...new Set([
        ...hariDipakai.map((h) => h.catatanHarianId),
        ...basisDariHari.map((h) => h.catatanHarianId),
      ]),
    ],
    jumlahDikecualikanAnomali,
    alasanDikecualikan,
    jumlahBelumFinal,
    kalimatAlasan,
  };
}

interface BahanKalimat {
  aturan: AturanBasis;
  aturanMenang: AturanMenang;
  hariBesokDalamMinggu: number;
  basisDariHari: readonly HariTerpakai[];
  basis: Porsi;
  jumlahData: number;
  lantaiKeras: Porsi;
  rekomendasi: Porsi;
  jumlahDikecualikanAnomali: number;
  alasanDikecualikan: readonly string[];
}

/**
 * Merakit kalimat alasan dari data yang BENAR-BENAR dipakai.
 *
 * Ini bukan template dengan variabel. Setiap angka di kalimat berasal dari hari
 * yang bisa ditunjuk, dan bagian yang menyebut aturan mana yang menang wajib
 * ada — tanpa itu, operator tidak bisa tahu apakah angkanya datang dari pola
 * mingguan atau dari lantai keras, dan angka yang tidak bisa dijelaskan tidak
 * akan dipercaya.
 */
export function rakitKalimatAlasan(bahan: BahanKalimat): string {
  const namaHari = NAMA_HARI[bahan.hariBesokDalamMinggu] ?? "Hari itu";
  const bagian: string[] = [];

  // Bagian A — dari mana basisnya
  if (bahan.aturan === "hari_sama") {
    const angka = bahan.basisDariHari.map((h) => porsiKeStringRingkas(h.konsumsi));
    bagian.push(
      `${namaHari} tiga minggu terakhir terpakai ${angka.join(", ")} — rata-rata ${porsiKeStringRingkas(bahan.basis)}.`,
    );
  } else {
    bagian.push(
      `Belum ada tiga hari ${namaHari} dalam data, jadi kami pakai rata-rata ${bahan.jumlahData} hari terakhir: ${porsiKeStringRingkas(bahan.basis)}.`,
    );
  }

  // Bagian B — lantai keras, selalu disebut
  bagian.push(
    `Konsumsi tertinggi dalam ${PANJANG_JENDELA_HARI} hari: ${porsiKeStringRingkas(bahan.lantaiKeras)}.`,
  );

  // Bagian C — putusan, menyebut aturan yang menang
  if (bahan.aturanMenang === "lantai") {
    bagian.push(
      `Kami sarankan ${porsiKeStringRingkas(bahan.rekomendasi)}, mengikuti angka tertinggi itu supaya tidak sampai kurang.`,
    );
  } else {
    bagian.push(
      `Kami sarankan ${porsiKeStringRingkas(bahan.rekomendasi)}, di atas rata-rata dan tidak di bawah angka tertinggi.`,
    );
  }

  // Bagian D — pengecualian, ditampilkan terbuka
  if (bahan.jumlahDikecualikanAnomali > 0) {
    bagian.push(
      `${bahan.jumlahDikecualikanAnomali} hari tidak dihitung karena ditandai ${gabungAlasan(bahan.alasanDikecualikan)}.`,
    );
  }

  return bagian.join(" ");
}

/**
 * Menggabungkan alasan anomali menjadi frasa yang bisa dibaca.
 *
 * Huruf pertama dikecilkan supaya menyambung dengan "ditandai …". Alasan ditulis
 * operator sendiri, jadi bisa berupa kalimat berawalan huruf besar.
 */
function gabungAlasan(alasan: readonly string[]): string {
  if (alasan.length === 0) return "hari tidak biasa";

  const dirapikan = alasan.map((a) => a.charAt(0).toLowerCase() + a.slice(1));
  if (dirapikan.length === 1) return dirapikan[0]!;

  return `${dirapikan.slice(0, -1).join(", ")} dan ${dirapikan[dirapikan.length - 1]!}`;
}
