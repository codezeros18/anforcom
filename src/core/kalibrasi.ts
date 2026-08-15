/*
 * Kalibrasi wadah x jenis masakan.
 *
 * REFRAMING YANG MENYELAMATKAN SELURUH PENDEKATAN INI:
 * kita TIDAK mengukur makanan. Kita mengukur seberapa penuh sebuah wadah yang
 * sudah dikenal. "Berapa kilogram makanan ini?" mustahil dijawab dari foto;
 * "panci ini terisi berapa persen?" mudah, terbatas, dan bisa dikoreksi manusia
 * dalam satu geseran. Modul ini adalah jembatan antara jawaban pertanyaan kedua
 * dan angka porsi yang bisa dipakai merencanakan masakan besok.
 *
 *   porsiTersisa = fraksiKeterisian x porsiPenuh
 *
 * EMPAT KEPUTUSAN YANG ALASANNYA HARUS DIPAHAMI SEBELUM MENGUBAH APA PUN:
 *
 * 1. KONSTANTA MILIK PASANGAN, BUKAN MILIK WADAH. Panci yang sama berisi nasi
 *    dan berisi sayur berkuah menampung jumlah porsi yang sangat berbeda saat
 *    penuh. Kalibrasi satu dimensi akan salah secara SISTEMATIS, dan kesalahan
 *    sistematis tidak bisa ditambal oleh koreksi berapa pun banyaknya.
 *
 * 2. PEMBATAS 15% PER KOREKSI. Satu koreksi keliru — operator salah ketik, atau
 *    membaca wadah yang salah — tidak boleh merusak kalibrasi yang sudah baik.
 *    Tanpa pembatas, satu angka 200 pada konstanta 60 akan melompat ke 102 dan
 *    seluruh estimasi berikutnya ikut rusak.
 *
 * 3. SISTEM MENOLAK MENEBAK. Wadah yang tidak terdaftar dan tidak punya kerabat
 *    sekategori melempar `KonstantaTidakDitemukan`, bukan mengembalikan angka
 *    perkiraan diam-diam. Ini bukan keterbatasan yang disembunyikan — ini
 *    demonstrasi bahwa sistem tahu batas dirinya sendiri.
 *
 * 4. RENTANG SELALU DIKEMBALIKAN. Angka tunggal tanpa rentang terbaca lebih
 *    pasti daripada yang bisa dipertanggungjawabkan.
 *
 * Modul ini murni: tidak menyentuh basis data, tidak memanggil model, tidak tahu
 * apa pun tentang UI. Data masuk sebagai argumen.
 */

import { GalatKalibrasiTidakSah, KonstantaTidakDitemukan } from "./galat.ts";
import { type Fraksi, fraksiKePersepuluhRibu } from "./fraksi.ts";
import {
  type Porsi,
  porsiDariPerseratus,
  porsiKaliPecahan,
  porsiKePerseratus,
  porsiRataRataBerbobot,
} from "./porsi.ts";
import type { KategoriFisik, SumberKalibrasi } from "./tipe.ts";

// ---------------------------------------------------------------------------
// Tetapan — mengubah salah satunya wajib ditulis di PROGRESS.md lebih dulu
// ---------------------------------------------------------------------------

/**
 * Bobot koreksi terbaru pada rata-rata bergerak, dalam perseratus (30 = 0.30).
 *
 * Koreksi terbaru lebih berpengaruh karena porsi dapur berubah mengikuti menu
 * dan musim. Ditolak: rata-rata sederhana seluruh riwayat (terlalu lambat
 * beradaptasi, dan koreksi awal yang buruk membekas selamanya).
 */
export const ALFA_PERSERATUS = 30;

/**
 * Batas perubahan konstanta per satu koreksi, dalam perseratus (15 = 15%).
 *
 * Ditolak: penggantian langsung, karena satu koreksi keliru langsung merusak
 * kalibrasi yang sudah baik.
 */
export const BATAS_PERUBAHAN_PERSERATUS = 15;

/** Jumlah koreksi sebelum `sumber` berubah dari `deklarasi` ke `terkalibrasi`. */
export const AMBANG_TERKALIBRASI = 5;

/**
 * Lebar rentang keyakinan dasar per kategori fisik, dalam perseratus persen.
 * `1000` berarti ±10.00%.
 *
 * Urutannya mengikuti kesulitan membaca permukaan: kuah paling rata sehingga
 * paling mudah, nasi bisa menggunung sehingga jadi sumber galat terbesar.
 */
export const LEBAR_RENTANG_PERSERATUS_PERSEN: Readonly<Record<KategoriFisik, number>> = {
  berkuah: 1_000, // ±10%  — permukaan rata, paling mudah dibaca
  padat_rata: 2_000, // ±20%  — sedikit variasi tumpukan
  padat_menggunung: 3_500, // ±35%  — nasi bisa menggunung; sumber galat terbesar
};

/**
 * Lebar rentang untuk isi campuran, dalam perseratus persen.
 *
 * MENGGANTIKAN lebar kategori fisik, bukan mengalikannya: isi wadahnya memang
 * bukan satu jenis, jadi kategori satu jenis tidak berlaku sama sekali.
 */
export const LEBAR_RENTANG_CAMPURAN_PERSERATUS_PERSEN = 4_000; // ±40%

/**
 * Pengali pelebaran rentang, sebagai pecahan eksak 3/2.
 *
 * Ditulis sebagai pecahan, bukan `1.5`, supaya perkaliannya tetap bilangan
 * bulat. `3500 x 3 / 2 = 5250` tepat; lewat float, 1.5 kebetulan aman tapi
 * kebiasaannya tidak.
 */
const PELEBARAN_PEMBILANG = 3;
const PELEBARAN_PENYEBUT = 2;

// ---------------------------------------------------------------------------
// 2.1 — mencari konstanta
// ---------------------------------------------------------------------------

export interface KalibrasiTersimpan {
  wadahId: string;
  jenisMasakanId: string;
  porsiPenuh: Porsi;
  sumber: SumberKalibrasi;
  jumlahKoreksi: number;
}

export interface JenisMasakanRingkas {
  id: string;
  kategoriFisik: KategoriFisik;
}

/**
 * Data yang dibutuhkan untuk mencari konstanta.
 *
 * `/core` tidak menyentuh basis data — kueri terjadi di lapisan pemanggil dan
 * hasilnya diserahkan ke sini. Itu yang membuat seluruh modul ini bisa diuji
 * tanpa Postgres, dan CI memang menjalankan tes tanpa basis data.
 */
export interface KonteksKalibrasi {
  kalibrasi: readonly KalibrasiTersimpan[];
  jenisMasakan: readonly JenisMasakanRingkas[];
}

export interface KonstantaDitemukan {
  porsiPenuh: Porsi;
  sumber: SumberKalibrasi;
  /**
   * `true` bila konstanta DIPINJAM dari jenis masakan lain yang kategori
   * fisiknya sama. Rentang keyakinan dilebarkan, dan UI wajib mengatakan
   * angkanya perkiraan — bukan menyajikannya seolah terkalibrasi.
   */
  perkiraan: boolean;
  jumlahKoreksi: number;
  /** Pasangan asal konstanta. Berbeda dari yang diminta bila `perkiraan` true. */
  asal: { wadahId: string; jenisMasakanId: string };
}

/**
 * Mencari konstanta untuk satu pasangan wadah x jenis masakan.
 *
 * Urutannya: cari tepat, lalu pinjam dari kategori fisik yang sama pada wadah
 * yang SAMA, lalu menyerah dan melempar. Peminjaman dibatasi pada wadah yang
 * sama karena konstanta adalah sifat wadah itu — meminjam dari panci lain akan
 * mengarang angka yang tidak ada hubungannya dengan wadah di depan operator.
 */
export function cariKonstanta(
  konteks: KonteksKalibrasi,
  wadahId: string,
  jenisMasakanId: string,
): KonstantaDitemukan {
  // a. Cari tepat.
  const tepat = konteks.kalibrasi.find(
    (k) => k.wadahId === wadahId && k.jenisMasakanId === jenisMasakanId,
  );
  if (tepat) {
    return {
      porsiPenuh: tepat.porsiPenuh,
      sumber: tepat.sumber,
      perkiraan: false,
      jumlahKoreksi: tepat.jumlahKoreksi,
      asal: { wadahId: tepat.wadahId, jenisMasakanId: tepat.jenisMasakanId },
    };
  }

  // b. Pinjam dari kategori fisik yang sama, pada wadah yang sama.
  const kategoriDiminta = konteks.jenisMasakan.find(
    (j) => j.id === jenisMasakanId,
  )?.kategoriFisik;

  if (kategoriDiminta !== undefined) {
    const kategoriPerId = new Map(
      konteks.jenisMasakan.map((j) => [j.id, j.kategoriFisik]),
    );

    const kandidat = konteks.kalibrasi.filter(
      (k) =>
        k.wadahId === wadahId && kategoriPerId.get(k.jenisMasakanId) === kategoriDiminta,
    );

    const terpilih = pilihKandidatTerbaik(kandidat);
    if (terpilih) {
      return {
        porsiPenuh: terpilih.porsiPenuh,
        sumber: terpilih.sumber,
        perkiraan: true,
        jumlahKoreksi: terpilih.jumlahKoreksi,
        asal: {
          wadahId: terpilih.wadahId,
          jenisMasakanId: terpilih.jenisMasakanId,
        },
      };
    }
  }

  // c. Menyerah, terbuka. Lihat keputusan 3 di kepala berkas.
  throw new KonstantaTidakDitemukan(wadahId, jenisMasakanId);
}

/**
 * Memilih konstanta mana yang dipinjam bila ada beberapa kandidat sekategori.
 *
 * Urutan keutamaan: yang sudah `terkalibrasi`, lalu yang paling banyak
 * dikoreksi, lalu urutan abjad id. Dua yang pertama memilih konstanta yang
 * paling teruji; yang ketiga hanya ada supaya hasilnya deterministik — tanpa
 * itu, urutan baris dari basis data akan menentukan angka yang dilihat
 * operator, dan estimasi yang sama bisa berbeda antar pemuatan halaman.
 */
function pilihKandidatTerbaik(
  kandidat: readonly KalibrasiTersimpan[],
): KalibrasiTersimpan | undefined {
  return [...kandidat].sort((a, b) => {
    if (a.sumber !== b.sumber) return a.sumber === "terkalibrasi" ? -1 : 1;
    if (a.jumlahKoreksi !== b.jumlahKoreksi) return b.jumlahKoreksi - a.jumlahKoreksi;
    return a.jenisMasakanId < b.jenisMasakanId ? -1 : 1;
  })[0];
}

// ---------------------------------------------------------------------------
// 2.2 — porsi tersisa
// ---------------------------------------------------------------------------

/**
 * `porsiTersisa = fraksiKeterisian x porsiPenuh`.
 *
 * Rumus inti produk ini. Fraksi berskala persepuluh ribu, jadi penyebutnya
 * 10000 — perkalian dilakukan lebih dulu, pembagian belakangan, dan seluruhnya
 * bilangan bulat.
 */
export function hitungPorsiTersisa(fraksiKeterisian: Fraksi, porsiPenuh: Porsi): Porsi {
  if (porsiKePerseratus(porsiPenuh) < 0) {
    throw new GalatKalibrasiTidakSah(
      "Konstanta porsi penuh tidak boleh negatif — wadah tidak bisa menampung porsi negatif.",
    );
  }
  return porsiKaliPecahan(porsiPenuh, fraksiKePersepuluhRibu(fraksiKeterisian), 10_000);
}

// ---------------------------------------------------------------------------
// 2.3 / 2.7 — rentang keyakinan
// ---------------------------------------------------------------------------

export interface MasukanRentang {
  porsiEstimasi: Porsi;
  kategoriFisik: KategoriFisik;
  /** Konstanta dipinjam dari jenis masakan lain sekategori. */
  perkiraan: boolean;
  isCampuran: boolean;
  /** `deklarasi` melebarkan rentang; belum teruji koreksi. */
  sumber: SumberKalibrasi;
}

export interface HasilRentang {
  bawah: Porsi;
  atas: Porsi;
  /** Lebar yang benar-benar dipakai, dalam perseratus persen. `5250` = ±52.50%. */
  lebarPerseratusPersen: number;
  /**
   * Isi campuran tidak bisa dibaca model dengan jujur, jadi jalur manual
   * diwajibkan. Batas yang diakui, bukan ditambal.
   */
  wajibManual: boolean;
}

/**
 * Menghitung rentang keyakinan di sekitar sebuah estimasi.
 *
 * Lebarnya dimulai dari kategori fisik (atau dari lebar campuran), lalu
 * DIKALIKAN 1.5 untuk setiap sumber ketidakpastian tambahan yang berlaku:
 * konstanta yang dipinjam, dan konstanta yang masih berasal dari deklarasi.
 * Keduanya bisa berlaku sekaligus — dan memang seharusnya menumpuk, karena
 * konstanta pinjaman dari kalibrasi yang belum teruji memang dua kali lebih
 * tidak pasti daripada salah satunya saja.
 */
export function hitungRentang(masukan: MasukanRentang): HasilRentang {
  let lebar = masukan.isCampuran
    ? LEBAR_RENTANG_CAMPURAN_PERSERATUS_PERSEN
    : LEBAR_RENTANG_PERSERATUS_PERSEN[masukan.kategoriFisik];

  if (masukan.perkiraan) lebar = lebarkan(lebar);
  if (masukan.sumber === "deklarasi") lebar = lebarkan(lebar);

  const selisih = porsiKaliPecahan(masukan.porsiEstimasi, lebar, 10_000);

  // Batas bawah tidak pernah negatif. Rentang yang sangat lebar — campuran,
  // konstanta pinjaman, dan sumber deklarasi sekaligus — bisa melampaui nilai
  // estimasinya sendiri, dan "sisa antara -12 dan 60 porsi" bukan informasi.
  const bawahMentah =
    porsiKePerseratus(masukan.porsiEstimasi) - porsiKePerseratus(selisih);

  return {
    bawah: porsiDariPerseratus(Math.max(0, bawahMentah)),
    atas: porsiDariPerseratus(
      porsiKePerseratus(masukan.porsiEstimasi) + porsiKePerseratus(selisih),
    ),
    lebarPerseratusPersen: lebar,
    wajibManual: masukan.isCampuran,
  };
}

/** Mengalikan lebar dengan 3/2 secara eksak. */
function lebarkan(lebarPerseratusPersen: number): number {
  return (lebarPerseratusPersen * PELEBARAN_PEMBILANG) / PELEBARAN_PENYEBUT;
}

// ---------------------------------------------------------------------------
// 2.6 — cold start
// ---------------------------------------------------------------------------

/**
 * Membentuk kalibrasi awal dari deklarasi operator saat pendaftaran wadah.
 *
 * Pertanyaannya di layar: "kalau wadah ini penuh berisi nasi, kira-kira berapa
 * porsi?" Angka awal datang dari PENGETAHUAN DAPUR ITU SENDIRI, bukan asumsi
 * kita — dan itu sebabnya sistem bisa berguna pada hari pertama, sebelum ada
 * satu pun koreksi.
 */
export function buatKalibrasiAwal(
  wadahId: string,
  jenisMasakanId: string,
  porsiPenuhDeklarasi: Porsi,
): KalibrasiTersimpan {
  if (porsiKePerseratus(porsiPenuhDeklarasi) <= 0) {
    throw new GalatKalibrasiTidakSah(
      "Deklarasi porsi penuh harus lebih dari nol — wadah yang tidak menampung apa pun tidak perlu dikalibrasi.",
    );
  }

  return {
    wadahId,
    jenisMasakanId,
    porsiPenuh: porsiPenuhDeklarasi,
    sumber: "deklarasi",
    jumlahKoreksi: 0,
  };
}

// ---------------------------------------------------------------------------
// 2.4 / 2.5 — pembaruan dari koreksi
// ---------------------------------------------------------------------------

export interface MasukanPembaruanKalibrasi {
  konstantaLama: Porsi;
  jumlahKoreksiLama: number;
  sumberLama: SumberKalibrasi;
  /** Fraksi keterisian yang tercatat pada estimasi yang dikoreksi. */
  fraksiKeterisian: Fraksi;
  /** Porsi hasil koreksi operator — yang dianggap benar. */
  porsiSesudah: Porsi;
}

export interface HasilPembaruanKalibrasi {
  porsiPenuh: Porsi;
  sumber: SumberKalibrasi;
  jumlahKoreksi: number;
  /** `porsiSesudah / fraksi` — konstanta yang tersirat dari koreksi ini saja. */
  konstantaTeramati: Porsi;
  /** Nilai EWMA sebelum dibatasi. Berbeda dari hasil bila pembatas bekerja. */
  konstantaSebelumPembatas: Porsi;
  /**
   * `true` bila pembatas 15% menahan perubahan.
   *
   * Dikembalikan supaya riwayat koreksi bisa menjelaskan kenapa konstanta tidak
   * bergerak sejauh yang diharapkan operator — tanpa ini, koreksi besar akan
   * terasa diabaikan sistem.
   */
  dibatasi: boolean;
}

/**
 * Memperbarui konstanta dari satu koreksi.
 *
 *   konstantaTeramati   = porsiSesudah / fraksiKeterisian
 *   konstantaBaruMentah = (1 - a) x konstantaLama + a x konstantaTeramati
 *   konstantaBaru       = clamp(mentah, lama x 0.85, lama x 1.15)
 *
 * Seluruhnya bilangan bulat: `a` dipakai sebagai 30/100, pembatas sebagai
 * 85/100 dan 115/100.
 */
export function perbaruiKalibrasi(
  masukan: MasukanPembaruanKalibrasi,
): HasilPembaruanKalibrasi {
  const fraksi = fraksiKePersepuluhRibu(masukan.fraksiKeterisian);
  if (fraksi === 0) {
    // porsiSesudah / 0 tidak terdefinisi. Wadah yang terbaca kosong tidak
    // memberi informasi apa pun tentang kapasitasnya saat penuh.
    throw new GalatKalibrasiTidakSah(
      "Kalibrasi tidak bisa diperbarui dari fraksi keterisian nol — wadah kosong tidak memberi tahu kapasitasnya.",
    );
  }

  const lama = porsiKePerseratus(masukan.konstantaLama);
  if (lama <= 0) {
    throw new GalatKalibrasiTidakSah(
      "Konstanta lama harus lebih dari nol sebelum bisa diperbarui.",
    );
  }

  // konstantaTeramati = porsiSesudah / (fraksi/10000) = porsiSesudah * 10000 / fraksi
  const konstantaTeramati = porsiKaliPecahan(masukan.porsiSesudah, 10_000, fraksi);

  // EWMA: (1 - a) x lama + a x teramati, ditulis sebagai rata-rata berbobot
  // supaya pembulatannya terjadi sekali di akhir.
  const mentah = porsiRataRataBerbobot(
    masukan.konstantaLama,
    100 - ALFA_PERSERATUS,
    konstantaTeramati,
    ALFA_PERSERATUS,
  );

  const batasBawah = porsiKaliPecahan(
    masukan.konstantaLama,
    100 - BATAS_PERUBAHAN_PERSERATUS,
    100,
  );
  const batasAtas = porsiKaliPecahan(
    masukan.konstantaLama,
    100 + BATAS_PERUBAHAN_PERSERATUS,
    100,
  );

  const nilaiMentah = porsiKePerseratus(mentah);
  const dibatasi =
    nilaiMentah < porsiKePerseratus(batasBawah) ||
    nilaiMentah > porsiKePerseratus(batasAtas);

  const konstantaBaru = porsiDariPerseratus(
    Math.min(
      Math.max(nilaiMentah, porsiKePerseratus(batasBawah)),
      porsiKePerseratus(batasAtas),
    ),
  );

  const jumlahKoreksi = masukan.jumlahKoreksiLama + 1;

  return {
    porsiPenuh: konstantaBaru,
    // Transisi satu arah: yang sudah terkalibrasi tidak pernah kembali menjadi
    // deklarasi, meski hitungan koreksinya entah bagaimana turun.
    sumber:
      masukan.sumberLama === "terkalibrasi" || jumlahKoreksi >= AMBANG_TERKALIBRASI
        ? "terkalibrasi"
        : "deklarasi",
    jumlahKoreksi,
    konstantaTeramati,
    konstantaSebelumPembatas: mentah,
    dibatasi,
  };
}

/**
 * Menjelaskan keadaan kalibrasi dalam bahasa manusia, untuk badge di layar.
 *
 * Selama `deklarasi`, operator harus tahu angkanya belum teruji — tapi tanpa
 * kata yang menghakimi. "Belum terkalibrasi" adalah keterangan; "tidak akurat"
 * adalah tuduhan.
 */
export function jelaskanSumber(sumber: SumberKalibrasi, jumlahKoreksi: number): string {
  if (sumber === "terkalibrasi") {
    return `Sudah terkalibrasi dari ${jumlahKoreksi} koreksi.`;
  }
  const sisa = Math.max(0, AMBANG_TERKALIBRASI - jumlahKoreksi);
  if (jumlahKoreksi === 0) {
    return "Belum terkalibrasi — angka akan membaik setelah beberapa koreksi.";
  }
  return `Belum terkalibrasi — angka akan membaik setelah ${sisa} koreksi lagi.`;
}
