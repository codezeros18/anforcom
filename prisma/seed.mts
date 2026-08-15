import { db } from "../src/lib/db.ts";

/*
 * Seed dapur contoh.
 *
 * Tiga aturan yang membentuk berkas ini:
 *
 * 1. ARITMETIKA BILANGAN BULAT. Seluruh perhitungan dilakukan dalam satuan
 *    terkecil (perseratus porsi, persepuluh ribu fraksi) lalu diformat menjadi
 *    string desimal di detik terakhir. Tidak ada satu pun operasi float di
 *    berkas ini — CLAUDE.md aturan 3 berlaku untuk skrip seed sama seperti
 *    untuk kode produksi, karena angka seed inilah yang dipakai menguji rumus
 *    di Sprint 2 dan 3.
 *
 * 2. ACAK YANG DAPAT DIULANG. PRNG di bawah punya benih tetap, jadi menjalankan
 *    seed dua kali menghasilkan angka yang persis sama. Tes yang mengandalkan
 *    data seed tidak boleh berubah hijau-merah karena undian.
 *
 * 3. DATA CONTOH TIDAK PERNAH MENJADI KLAIM. Tabel `penimbangan_referensi` dan
 *    `sebaran_tebakan` sengaja TIDAK diisi — keduanya adalah sumber angka
 *    dampak (CLAUDE.md aturan 5), dan dapur contoh tidak boleh bisa
 *    menghasilkan klaim dampak sama sekali (aturan 8). Membiarkannya kosong
 *    lebih aman daripada mengisinya lalu bergantung pada penyaringan di hilir.
 *
 * Koneksi diambil dari `/src/lib/db.ts` — client tunggal yang sama dengan yang
 * dipakai aplikasi. Membuat PrismaClient kedua di sini berarti dua tempat yang
 * harus dikonfigurasi ulang setiap kali koneksi berubah.
 */

// ---------------------------------------------------------------------------
// Bilangan acak yang dapat diulang
// ---------------------------------------------------------------------------

/** mulberry32 — kecil, cukup baik untuk data contoh, dan sepenuhnya deterministik. */
function buatAcak(benih: number): () => number {
  let a = benih;
  return function acak() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const acak = buatAcak(20260815);

/** Bilangan bulat acak dalam [min, maks], keduanya inklusif. */
function acakBulat(min: number, maks: number): number {
  return min + Math.floor(acak() * (maks - min + 1));
}

// ---------------------------------------------------------------------------
// Format desimal — dari bilangan bulat satuan terkecil ke string
// ---------------------------------------------------------------------------

/** Perseratus porsi -> "X.YY" untuk kolom DECIMAL(8,2). */
function porsi(perseratus: number): string {
  const negatif = perseratus < 0;
  const n = Math.abs(perseratus);
  const utuh = Math.floor(n / 100);
  const pecahan = n % 100;
  return `${negatif ? "-" : ""}${utuh}.${String(pecahan).padStart(2, "0")}`;
}

/** Persepuluh ribu -> "0.XXXX" untuk kolom DECIMAL(5,4). */
function fraksi(persepuluhRibu: number): string {
  const utuh = Math.floor(persepuluhRibu / 10000);
  const pecahan = persepuluhRibu % 10000;
  return `${utuh}.${String(pecahan).padStart(4, "0")}`;
}

/** Pembulatan ke atas untuk pembagian bilangan bulat, tanpa melewati float. */
function bagiBulat(pembilang: number, penyebut: number): number {
  return Math.round(pembilang / penyebut);
}

// ---------------------------------------------------------------------------
// Lebar rentang keyakinan
// ---------------------------------------------------------------------------

/*
 * CATATAN UTANG TEKNIS (dicatat juga di PROGRESS.md):
 * logika rentang di bawah menduplikasi apa yang akan menjadi
 * `hitungRentang()` di /src/core/kalibrasi.ts (Sprint 2). Seed tidak bisa
 * mengimpornya sekarang karena berkas itu masih placeholder `export {}` dan
 * Sprint 1 dilarang menyentuh /src/core. Begitu Sprint 2 selesai, seed harus
 * beralih memakai fungsi dari /core supaya tidak ada dua sumber kebenaran
 * untuk lebar rentang.
 */
const LEBAR_RENTANG_PERSEN: Record<string, number> = {
  berkuah: 10,
  padat_rata: 20,
  padat_menggunung: 35,
};

function hitungRentang(
  porsiPerseratus: number,
  kategoriFisik: string,
  sumberDeklarasi: boolean,
  isCampuran: boolean,
): { bawah: number; atas: number } {
  // Campuran memakai lebar tetap ±40% dan mengabaikan kategori fisik — isi
  // wadahnya memang bukan satu jenis, jadi kategori satu jenis tidak berlaku.
  let persen = isCampuran ? 40 : (LEBAR_RENTANG_PERSEN[kategoriFisik] ?? 20);

  // Konstanta yang masih berasal dari deklarasi operator belum teruji koreksi,
  // jadi rentangnya dilebarkan 1.5x. Dikalikan dalam bilangan bulat: x3 lalu :2.
  if (sumberDeklarasi) persen = bagiBulat(persen * 3, 2);

  const selisih = bagiBulat(porsiPerseratus * persen, 100);
  return {
    bawah: Math.max(0, porsiPerseratus - selisih),
    atas: porsiPerseratus + selisih,
  };
}

// ---------------------------------------------------------------------------
// Definisi dapur contoh
// ---------------------------------------------------------------------------

const WADAH_CONTOH = [
  { nama: "Panci Besar", bentuk: "panci" as const },
  { nama: "Nampan Nasi", bentuk: "nampan" as const },
  { nama: "Baskom Sayur", bentuk: "baskom" as const },
  { nama: "Ompreng Lauk", bentuk: "ompreng" as const },
];

const JENIS_MASAKAN_CONTOH = [
  { nama: "Nasi Putih", kategoriFisik: "padat_menggunung" as const },
  { nama: "Lauk Kering", kategoriFisik: "padat_rata" as const },
  { nama: "Sayur Berkuah", kategoriFisik: "berkuah" as const },
];

/** porsiPenuh per pasangan (wadah x jenis masakan), dalam perseratus porsi. */
const PORSI_PENUH: Record<string, Record<string, number>> = {
  "Panci Besar": { "Nasi Putih": 18000, "Lauk Kering": 22000, "Sayur Berkuah": 15000 },
  "Nampan Nasi": { "Nasi Putih": 12000, "Lauk Kering": 14000, "Sayur Berkuah": 9000 },
  "Baskom Sayur": { "Nasi Putih": 8000, "Lauk Kering": 9500, "Sayur Berkuah": 7000 },
  "Ompreng Lauk": { "Nasi Putih": 4000, "Lauk Kering": 5000, "Sayur Berkuah": 3000 },
};

/*
 * Konsumsi dasar per hari-dalam-minggu, dalam perseratus porsi.
 *
 * Variasi ini bukan hiasan: mesin rekomendasi (Sprint 3) memilih basis
 * "hari_sama" bila ada >= 3 kemunculan hari yang sama, jadi data seed harus
 * benar-benar punya pola mingguan untuk menguji jalur itu. Jumat lebih rendah
 * karena sebagian santri pulang.
 */
const KONSUMSI_DASAR: Record<number, number> = {
  0: 26800, // Minggu
  1: 29200, // Senin
  2: 28900, // Selasa
  3: 29100, // Rabu
  4: 28700, // Kamis
  5: 24600, // Jumat
  6: 27500, // Sabtu
};

const JUMLAH_HARI = 20;
/** Berapa hari sebelum hari terakhir, hari anomali ditempatkan. */
const OFFSET_HARI_ANOMALI = 8;

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

function tanggalUtc(dasar: Date, geserHari: number): Date {
  const d = new Date(
    Date.UTC(dasar.getUTCFullYear(), dasar.getUTCMonth(), dasar.getUTCDate()),
  );
  d.setUTCDate(d.getUTCDate() + geserHari);
  return d;
}

async function main() {
  /*
   * Tanggal akhir mengikuti hari berjalan supaya layar riwayat 14 hari selalu
   * terlihat hidup, bukan memamerkan data basi dari bulan lalu. Bisa dikunci
   * lewat SEED_TANGGAL_AKHIR (format YYYY-MM-DD) saat butuh hasil yang sama
   * persis di dua mesin berbeda.
   */
  const kunciTanggal = process.env.SEED_TANGGAL_AKHIR;
  const hariIni = kunciTanggal ? new Date(`${kunciTanggal}T00:00:00.000Z`) : new Date();
  const hariTerakhir = tanggalUtc(hariIni, -1);

  console.log("Menyiapkan dapur contoh…");

  /*
   * Idempoten: hapus dapur contoh lama lebih dulu. Penghapusan disaring ke
   * `isContoh: true` — skrip ini tidak boleh bisa menyentuh dapur nyata, apa
   * pun keadaan basis datanya. Relasi lain ikut terhapus lewat onDelete: Cascade.
   */
  const terhapus = await db.dapur.deleteMany({ where: { isContoh: true } });
  if (terhapus.count > 0) {
    console.log(`  ${terhapus.count} dapur contoh lama dihapus.`);
  }

  const dapur = await db.dapur.create({
    data: {
      nama: "Dapur Pesantren Al-Hikmah (Contoh)",
      labelAnonim: "Dapur Pesantren di Kabupaten Bogor",
      modeAnonim: false,
      kecamatan: "Ciomas",
      jenis: "pesantren",
      biayaBahanPerPorsiMin: "4500.00",
      biayaBahanPerPorsiMaks: "6200.00",
      // Dapur contoh boleh tampil publik karena memang dibuat untuk itu, tapi
      // isContoh di bawah memastikan UI menandainya dan angkanya tidak pernah
      // dipakai sebagai klaim.
      izinTampilPublik: true,
      izinVideoPublik: false,
      izinBerlakuSampai: null,
      isContoh: true,
    },
  });

  const wadah = await Promise.all(
    WADAH_CONTOH.map((w) =>
      db.wadah.create({
        data: { dapurId: dapur.id, nama: w.nama, bentuk: w.bentuk, aktif: true },
      }),
    ),
  );

  const jenisMasakan = await Promise.all(
    JENIS_MASAKAN_CONTOH.map((j) =>
      db.jenisMasakan.create({
        data: { dapurId: dapur.id, nama: j.nama, kategoriFisik: j.kategoriFisik },
      }),
    ),
  );

  const cariWadah = (nama: string) => {
    const w = wadah.find((x) => x.nama === nama);
    if (!w) throw new Error(`Wadah contoh tidak ditemukan: ${nama}`);
    return w;
  };
  const cariJenis = (nama: string) => {
    const j = jenisMasakan.find((x) => x.nama === nama);
    if (!j) throw new Error(`Jenis masakan contoh tidak ditemukan: ${nama}`);
    return j;
  };

  /*
   * Pasangan yang benar-benar dipakai setiap hari. Sisanya tetap dikalibrasi
   * (12 pasangan lengkap) tapi tidak menghasilkan estimasi — meniru dapur nyata
   * yang mendaftarkan semua kombinasi tapi hanya memakai sebagian rutin.
   */
  const pasanganHarian = [
    { wadah: "Nampan Nasi", jenis: "Nasi Putih", porsiSeed: 0 },
    { wadah: "Baskom Sayur", jenis: "Sayur Berkuah", porsiSeed: 0 },
    { wadah: "Ompreng Lauk", jenis: "Lauk Kering", porsiSeed: 0 },
  ];

  // -------------------------------------------------------------------------
  // Rencana 20 hari, disusun lebih dulu di memori.
  //
  // Disusun terpisah dari penulisan supaya jumlah koreksi per pasangan sudah
  // diketahui saat membuat baris kalibrasi — `jumlahKoreksi` dan `sumber` jadi
  // konsisten dengan jejak koreksi yang benar-benar ada, bukan angka karangan.
  // -------------------------------------------------------------------------

  interface RencanaEstimasi {
    namaWadah: string;
    namaJenis: string;
    kategoriFisik: string;
    metode: "model" | "slider" | "manual";
    fraksiPersepuluhRibu: number;
    porsiEstimasiPerseratus: number;
    rentangBawah: number;
    rentangAtas: number;
    latensiMs: number | null;
    /** Ada isinya bila operator mengoreksi estimasi ini. */
    koreksi: { sesudahPerseratus: number; peran: "operator" | "pengelola" } | null;
    /** Nilai yang dipakai menghitung porsiTersisaFinal. */
    finalPerseratus: number;
  }

  interface RencanaHari {
    tanggal: Date;
    porsiDimasakPerseratus: number;
    isAnomali: boolean;
    alasanAnomali: string | null;
    dicatatMundur: boolean;
    peranPencatat: "operator" | "pengelola";
    estimasi: RencanaEstimasi[];
    porsiTersisaFinalPerseratus: number;
    tujuanPenyaluran: "ternak" | "kompos" | "tpa";
  }

  const jumlahKoreksiPerPasangan = new Map<string, number>();
  const rencana: RencanaHari[] = [];

  for (let i = JUMLAH_HARI - 1; i >= 0; i--) {
    const tanggal = tanggalUtc(hariTerakhir, -i);
    const hariDalamMinggu = tanggal.getUTCDay();
    const isAnomali = i === OFFSET_HARI_ANOMALI;

    const dasar = KONSUMSI_DASAR[hariDalamMinggu] ?? 28000;

    /*
     * Hari anomali: acara haul, penerima bertambah banyak. Konsumsinya jauh di
     * atas hari biasa (sekitar 500 porsi vs maksimum normal ~296).
     *
     * Angka ini sengaja ekstrem. Ia adalah bahan uji untuk aturan Sprint 3:
     * kalau hari ini ikut masuk perhitungan lantai keras, rekomendasi 14 hari
     * berikutnya terkunci di 500 dan dapur dipaksa memasak berlebih setiap hari
     * gara-gara satu hari istimewa.
     */
    const konsumsiPerseratus = isAnomali ? 50000 : dasar + acakBulat(-900, 900);

    // Dapur memasak sedikit di atas perkiraan konsumsinya — selisih inilah yang
    // menjadi sisa. Hari anomali dimasak jauh lebih banyak.
    const kelebihanPerseratus = isAnomali ? acakBulat(3000, 4500) : acakBulat(800, 3200);
    const porsiDimasakPerseratus = konsumsiPerseratus + kelebihanPerseratus;
    const sisaSebenarnya = kelebihanPerseratus;

    // Sisa dibagi ke pasangan yang dipakai hari itu. Sebagian hari hanya punya
    // sisa di satu atau dua wadah — tidak setiap hari semua wadah bersisa.
    const jumlahPasanganHariIni = sisaSebenarnya > 2000 ? 3 : acakBulat(1, 2);
    const pasanganHariIni = pasanganHarian.slice(0, jumlahPasanganHariIni);

    const estimasiHari: RencanaEstimasi[] = [];
    let sisaBelumDibagi = sisaSebenarnya;

    for (let p = 0; p < pasanganHariIni.length; p++) {
      const pasangan = pasanganHariIni[p]!;
      const terakhir = p === pasanganHariIni.length - 1;

      // Bagi rata lalu goyangkan sedikit; pasangan terakhir menerima sisanya
      // supaya penjumlahan tetap persis — tidak ada porsi yang hilang karena
      // pembulatan.
      const bagian = terakhir
        ? sisaBelumDibagi
        : Math.min(
            sisaBelumDibagi - 100 * (pasanganHariIni.length - p - 1),
            bagiBulat(sisaBelumDibagi, pasanganHariIni.length - p) + acakBulat(-300, 300),
          );

      const porsiSebenarnya = Math.max(100, bagian);
      sisaBelumDibagi -= porsiSebenarnya;

      const w = cariWadah(pasangan.wadah);
      const j = cariJenis(pasangan.jenis);
      const kategoriFisik =
        JENIS_MASAKAN_CONTOH.find((x) => x.nama === pasangan.jenis)?.kategoriFisik ??
        "padat_rata";
      const porsiPenuhPerseratus = PORSI_PENUH[pasangan.wadah]![pasangan.jenis]!;

      /*
       * Galat model. Estimasi tidak persis sama dengan kenyataan — itulah
       * alasan tombol koreksi ada. Besarnya galat mengikuti kategori fisik:
       * nasi menggunung paling sulit dibaca, kuah paling mudah.
       */
      const galatPersen =
        kategoriFisik === "padat_menggunung"
          ? acakBulat(-14, 14)
          : kategoriFisik === "padat_rata"
            ? acakBulat(-9, 9)
            : acakBulat(-5, 5);

      const porsiEstimasiPerseratus = Math.max(
        100,
        porsiSebenarnya + bagiBulat(porsiSebenarnya * galatPersen, 100),
      );

      // Fraksi keterisian dihitung mundur dari porsi estimasi, dibatasi 0..1.
      const fraksiPersepuluhRibu = Math.min(
        10000,
        Math.max(1, bagiBulat(porsiEstimasiPerseratus * 10000, porsiPenuhPerseratus)),
      );

      // Sebagian besar lewat model; sebagian lewat slider dan manual supaya
      // ketiga jalur benar-benar ada di data.
      const undianMetode = acakBulat(1, 10);
      const metode: "model" | "slider" | "manual" =
        undianMetode <= 7 ? "model" : undianMetode <= 9 ? "slider" : "manual";

      const kunciPasangan = `${w.id}|${j.id}`;
      const sudahDikoreksi = jumlahKoreksiPerPasangan.get(kunciPasangan) ?? 0;

      /*
       * Operator mengoreksi ketika selisihnya terasa — bukan setiap kali.
       * Ambang 6% meniru perilaku nyata: selisih kecil dibiarkan karena tidak
       * sepadan dengan usaha menggeser slider.
       */
      const selisihAbsolut = Math.abs(porsiEstimasiPerseratus - porsiSebenarnya);
      const layakDikoreksi =
        selisihAbsolut > bagiBulat(porsiSebenarnya * 6, 100) && acakBulat(1, 10) <= 7;

      const koreksi = layakDikoreksi
        ? {
            sesudahPerseratus: porsiSebenarnya,
            peran: (acakBulat(1, 10) <= 8 ? "operator" : "pengelola") as
              "operator" | "pengelola",
          }
        : null;

      if (koreksi) {
        jumlahKoreksiPerPasangan.set(kunciPasangan, sudahDikoreksi + 1);
      }

      const sumberMasihDeklarasi = sudahDikoreksi < 5;
      const rentang = hitungRentang(
        porsiEstimasiPerseratus,
        kategoriFisik,
        sumberMasihDeklarasi,
        false,
      );

      estimasiHari.push({
        namaWadah: pasangan.wadah,
        namaJenis: pasangan.jenis,
        kategoriFisik,
        metode,
        fraksiPersepuluhRibu,
        porsiEstimasiPerseratus,
        rentangBawah: rentang.bawah,
        rentangAtas: rentang.atas,
        latensiMs: metode === "model" ? acakBulat(900, 4200) : null,
        koreksi,
        finalPerseratus: koreksi ? koreksi.sesudahPerseratus : porsiEstimasiPerseratus,
      });
    }

    const porsiTersisaFinalPerseratus = estimasiHari.reduce(
      (jumlah, e) => jumlah + e.finalPerseratus,
      0,
    );

    const undianPenyaluran = acakBulat(1, 10);
    rencana.push({
      tanggal,
      porsiDimasakPerseratus,
      isAnomali,
      alasanAnomali: isAnomali ? "Acara haul, jumlah penerima bertambah" : null,
      // Sesekali dicatat mundur — jalur ini harus ada di data supaya UI-nya
      // pernah benar-benar diuji dengan kasus nyata.
      dicatatMundur: !isAnomali && acakBulat(1, 10) === 1,
      peranPencatat: acakBulat(1, 10) <= 8 ? "operator" : "pengelola",
      estimasi: estimasiHari,
      porsiTersisaFinalPerseratus,
      tujuanPenyaluran:
        undianPenyaluran <= 6 ? "ternak" : undianPenyaluran <= 9 ? "kompos" : "tpa",
    });
  }

  // -------------------------------------------------------------------------
  // Kalibrasi — 12 pasangan lengkap, dengan jumlahKoreksi yang benar-benar
  // cocok dengan jejak koreksi yang akan ditulis di bawah.
  // -------------------------------------------------------------------------

  for (const w of wadah) {
    for (const j of jenisMasakan) {
      const jumlahKoreksi = jumlahKoreksiPerPasangan.get(`${w.id}|${j.id}`) ?? 0;
      await db.kalibrasi.create({
        data: {
          wadahId: w.id,
          jenisMasakanId: j.id,
          porsiPenuh: porsi(PORSI_PENUH[w.nama]![j.nama]!),
          // Transisi deklarasi -> terkalibrasi terjadi pada koreksi ke-5.
          sumber: jumlahKoreksi >= 5 ? "terkalibrasi" : "deklarasi",
          jumlahKoreksi,
        },
      });
    }
  }

  // -------------------------------------------------------------------------
  // 20 hari catatan harian
  // -------------------------------------------------------------------------

  let totalEstimasi = 0;
  let totalKoreksi = 0;

  for (const hari of rencana) {
    const catatan = await db.catatanHarian.create({
      data: {
        dapurId: dapur.id,
        tanggal: hari.tanggal,
        porsiDimasak: porsi(hari.porsiDimasakPerseratus),
        porsiTersisaFinal: porsi(hari.porsiTersisaFinalPerseratus),
        isAnomali: hari.isAnomali,
        alasanAnomali: hari.alasanAnomali,
        dicatatMundur: hari.dicatatMundur,
        peranPencatat: hari.peranPencatat,
      },
    });

    for (const e of hari.estimasi) {
      const baris = await db.estimasi.create({
        data: {
          catatanHarianId: catatan.id,
          wadahId: cariWadah(e.namaWadah).id,
          jenisMasakanId: cariJenis(e.namaJenis).id,
          metode: e.metode,
          fraksiKeterisian: fraksi(e.fraksiPersepuluhRibu),
          porsiEstimasi: porsi(e.porsiEstimasiPerseratus),
          rentangBawah: porsi(e.rentangBawah),
          rentangAtas: porsi(e.rentangAtas),
          isCampuran: false,
          latensiMs: e.latensiMs,
        },
      });
      totalEstimasi++;

      if (e.koreksi) {
        /*
         * Koreksi adalah baris baru. Baris `estimasi` di atas tidak pernah
         * disentuh lagi setelah dibuat (CLAUDE.md aturan 2) — nilai final
         * dihitung dari keduanya, bukan hasil timpa.
         */
        await db.koreksi.create({
          data: {
            estimasiId: baris.id,
            porsiSebelum: porsi(e.porsiEstimasiPerseratus),
            porsiSesudah: porsi(e.koreksi.sesudahPerseratus),
            selisihAbsolut: porsi(
              Math.abs(e.koreksi.sesudahPerseratus - e.porsiEstimasiPerseratus),
            ),
            peranPengoreksi: e.koreksi.peran,
          },
        });
        totalKoreksi++;
      }
    }

    await db.penyaluran.create({
      data: {
        catatanHarianId: catatan.id,
        tujuan: hari.tujuanPenyaluran,
        catatan: hari.tujuanPenyaluran === "ternak" ? "Diambil peternak sekitar" : null,
      },
    });
  }

  // -------------------------------------------------------------------------
  // Ringkasan
  // -------------------------------------------------------------------------

  const konsumsi = rencana
    .filter((h) => !h.isAnomali)
    .map((h) => h.porsiDimasakPerseratus - h.porsiTersisaFinalPerseratus);
  const konsumsiTertinggi = Math.max(...konsumsi);
  const konsumsiAnomali = rencana
    .filter((h) => h.isAnomali)
    .map((h) => h.porsiDimasakPerseratus - h.porsiTersisaFinalPerseratus);

  console.log("");
  console.log("Dapur contoh siap.");
  console.log(`  dapur              : ${dapur.nama} (isContoh=${dapur.isContoh})`);
  console.log(`  wadah              : ${wadah.length}`);
  console.log(`  jenis masakan      : ${jenisMasakan.length}`);
  console.log(`  kalibrasi          : ${wadah.length * jenisMasakan.length} pasangan`);
  console.log(`  catatan harian     : ${rencana.length} hari`);
  console.log(
    `  rentang tanggal    : ${rencana[0]!.tanggal.toISOString().slice(0, 10)} .. ${rencana[rencana.length - 1]!.tanggal.toISOString().slice(0, 10)}`,
  );
  console.log(`  estimasi           : ${totalEstimasi}`);
  console.log(`  koreksi            : ${totalKoreksi}`);
  console.log(`  hari anomali       : ${rencana.filter((h) => h.isAnomali).length}`);
  console.log("");
  console.log("  Bahan uji rekomendasi (Sprint 3):");
  console.log(`    konsumsi tertinggi hari normal : ${porsi(konsumsiTertinggi)} porsi`);
  console.log(
    `    konsumsi hari anomali          : ${konsumsiAnomali.map(porsi).join(", ")} porsi`,
  );
  console.log(
    "    Kalau hari anomali ikut masuk lantai keras, rekomendasi akan terkunci",
  );
  console.log("    di angka anomali itu selama 14 hari. Itu yang harus dicegah.");
}

main()
  .then(async () => {
    await db.$disconnect();
  })
  .catch(async (galat: unknown) => {
    console.error("Seed gagal:", galat);
    await db.$disconnect();
    process.exit(1);
  });
