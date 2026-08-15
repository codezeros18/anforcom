-- CreateEnum
CREATE TYPE "jenis_dapur" AS ENUM ('pesantren', 'sekolah', 'kampus', 'rumah_sakit', 'katering', 'rumah_makan', 'lainnya');

-- CreateEnum
CREATE TYPE "bentuk_wadah" AS ENUM ('panci', 'nampan', 'baskom', 'ompreng', 'box', 'lainnya');

-- CreateEnum
CREATE TYPE "kategori_fisik" AS ENUM ('padat_rata', 'padat_menggunung', 'berkuah');

-- CreateEnum
CREATE TYPE "sumber_kalibrasi" AS ENUM ('deklarasi', 'terkalibrasi');

-- CreateEnum
CREATE TYPE "peran" AS ENUM ('operator', 'pengelola');

-- CreateEnum
CREATE TYPE "metode_estimasi" AS ENUM ('model', 'slider', 'manual');

-- CreateEnum
CREATE TYPE "tujuan_penyaluran" AS ENUM ('ternak', 'kompos', 'tpa');

-- CreateEnum
CREATE TYPE "diukur_oleh" AS ENUM ('tim_riset');

-- CreateEnum
CREATE TYPE "peran_penebak" AS ENUM ('staf_dapur', 'pengunjung_lokasi', 'lainnya');

-- CreateTable
CREATE TABLE "dapur" (
    "id" UUID NOT NULL,
    "nama" VARCHAR(120) NOT NULL,
    "label_anonim" VARCHAR(60) NOT NULL,
    "mode_anonim" BOOLEAN NOT NULL DEFAULT false,
    "kecamatan" VARCHAR(80) NOT NULL,
    "jenis" "jenis_dapur" NOT NULL,
    "biaya_bahan_per_porsi_min" DECIMAL(12,2) NOT NULL,
    "biaya_bahan_per_porsi_maks" DECIMAL(12,2) NOT NULL,
    "izin_tampil_publik" BOOLEAN NOT NULL DEFAULT false,
    "izin_video_publik" BOOLEAN NOT NULL DEFAULT false,
    "izin_berlaku_sampai" DATE,
    "is_contoh" BOOLEAN NOT NULL DEFAULT false,
    "dibuat_pada" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dapur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wadah" (
    "id" UUID NOT NULL,
    "dapur_id" UUID NOT NULL,
    "nama" VARCHAR(80) NOT NULL,
    "bentuk" "bentuk_wadah" NOT NULL,
    "foto_acuan_url" TEXT,
    "aktif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "wadah_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jenis_masakan" (
    "id" UUID NOT NULL,
    "dapur_id" UUID NOT NULL,
    "nama" VARCHAR(80) NOT NULL,
    "kategori_fisik" "kategori_fisik" NOT NULL,

    CONSTRAINT "jenis_masakan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kalibrasi" (
    "id" UUID NOT NULL,
    "wadah_id" UUID NOT NULL,
    "jenis_masakan_id" UUID NOT NULL,
    "porsi_penuh" DECIMAL(8,2) NOT NULL,
    "sumber" "sumber_kalibrasi" NOT NULL DEFAULT 'deklarasi',
    "jumlah_koreksi" INTEGER NOT NULL DEFAULT 0,
    "diperbarui_pada" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kalibrasi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catatan_harian" (
    "id" UUID NOT NULL,
    "dapur_id" UUID NOT NULL,
    "tanggal" DATE NOT NULL,
    "porsi_dimasak" DECIMAL(8,2) NOT NULL,
    "porsi_tersisa_final" DECIMAL(8,2),
    "is_anomali" BOOLEAN NOT NULL DEFAULT false,
    "alasan_anomali" VARCHAR(160),
    "dicatat_mundur" BOOLEAN NOT NULL DEFAULT false,
    "peran_pencatat" "peran" NOT NULL,
    "dibuat_pada" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "catatan_harian_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estimasi" (
    "id" UUID NOT NULL,
    "catatan_harian_id" UUID NOT NULL,
    "wadah_id" UUID NOT NULL,
    "jenis_masakan_id" UUID NOT NULL,
    "metode" "metode_estimasi" NOT NULL,
    "fraksi_keterisian" DECIMAL(5,4) NOT NULL,
    "porsi_estimasi" DECIMAL(8,2) NOT NULL,
    "rentang_bawah" DECIMAL(8,2) NOT NULL,
    "rentang_atas" DECIMAL(8,2) NOT NULL,
    "is_campuran" BOOLEAN NOT NULL DEFAULT false,
    "foto_url" TEXT,
    "latensi_ms" INTEGER,
    "dibuat_pada" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "estimasi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "koreksi" (
    "id" UUID NOT NULL,
    "estimasi_id" UUID NOT NULL,
    "porsi_sebelum" DECIMAL(8,2) NOT NULL,
    "porsi_sesudah" DECIMAL(8,2) NOT NULL,
    "selisih_absolut" DECIMAL(8,2) NOT NULL,
    "peran_pengoreksi" "peran" NOT NULL,
    "dibuat_pada" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "koreksi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "penyaluran" (
    "id" UUID NOT NULL,
    "catatan_harian_id" UUID NOT NULL,
    "tujuan" "tujuan_penyaluran" NOT NULL,
    "catatan" VARCHAR(160),

    CONSTRAINT "penyaluran_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "penimbangan_referensi" (
    "id" UUID NOT NULL,
    "catatan_harian_id" UUID NOT NULL,
    "wadah_id" UUID,
    "berat_gram" INTEGER NOT NULL,
    "berat_wadah_kosong_gram" INTEGER NOT NULL,
    "porsi_setara" DECIMAL(8,2),
    "diukur_oleh" "diukur_oleh" NOT NULL,
    "metode" VARCHAR(120) NOT NULL,
    "tanggal_ukur" DATE NOT NULL,

    CONSTRAINT "penimbangan_referensi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sebaran_tebakan" (
    "id" UUID NOT NULL,
    "catatan_harian_id" UUID NOT NULL,
    "wadah_id" UUID NOT NULL,
    "peran_penebak" "peran_penebak" NOT NULL,
    "tebakan_porsi" DECIMAL(8,2) NOT NULL,
    "angka_sebenarnya" DECIMAL(8,2) NOT NULL,
    "kondisi" VARCHAR(160) NOT NULL,
    "tanggal" DATE NOT NULL,

    CONSTRAINT "sebaran_tebakan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sesi_coba" (
    "id" UUID NOT NULL,
    "token" VARCHAR(64) NOT NULL,
    "dapur_contoh_id" UUID NOT NULL,
    "kedaluwarsa_pada" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "sesi_coba_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "wadah_dapur_id_aktif_idx" ON "wadah"("dapur_id", "aktif");

-- CreateIndex
CREATE UNIQUE INDEX "wadah_dapur_id_nama_key" ON "wadah"("dapur_id", "nama");

-- CreateIndex
CREATE UNIQUE INDEX "jenis_masakan_dapur_id_nama_key" ON "jenis_masakan"("dapur_id", "nama");

-- CreateIndex
CREATE UNIQUE INDEX "kalibrasi_wadah_id_jenis_masakan_id_key" ON "kalibrasi"("wadah_id", "jenis_masakan_id");

-- CreateIndex
CREATE INDEX "catatan_harian_dapur_id_tanggal_idx" ON "catatan_harian"("dapur_id", "tanggal" DESC);

-- CreateIndex
CREATE INDEX "catatan_harian_dapur_id_is_anomali_idx" ON "catatan_harian"("dapur_id", "is_anomali");

-- CreateIndex
CREATE UNIQUE INDEX "catatan_harian_dapur_id_tanggal_key" ON "catatan_harian"("dapur_id", "tanggal");

-- CreateIndex
CREATE INDEX "estimasi_catatan_harian_id_idx" ON "estimasi"("catatan_harian_id");

-- CreateIndex
CREATE INDEX "koreksi_estimasi_id_idx" ON "koreksi"("estimasi_id");

-- CreateIndex
CREATE INDEX "koreksi_dibuat_pada_idx" ON "koreksi"("dibuat_pada" DESC);

-- CreateIndex
CREATE INDEX "penyaluran_catatan_harian_id_idx" ON "penyaluran"("catatan_harian_id");

-- CreateIndex
CREATE INDEX "penimbangan_referensi_catatan_harian_id_idx" ON "penimbangan_referensi"("catatan_harian_id");

-- CreateIndex
CREATE INDEX "sebaran_tebakan_catatan_harian_id_idx" ON "sebaran_tebakan"("catatan_harian_id");

-- CreateIndex
CREATE UNIQUE INDEX "sesi_coba_token_key" ON "sesi_coba"("token");

-- AddForeignKey
ALTER TABLE "wadah" ADD CONSTRAINT "wadah_dapur_id_fkey" FOREIGN KEY ("dapur_id") REFERENCES "dapur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jenis_masakan" ADD CONSTRAINT "jenis_masakan_dapur_id_fkey" FOREIGN KEY ("dapur_id") REFERENCES "dapur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kalibrasi" ADD CONSTRAINT "kalibrasi_wadah_id_fkey" FOREIGN KEY ("wadah_id") REFERENCES "wadah"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kalibrasi" ADD CONSTRAINT "kalibrasi_jenis_masakan_id_fkey" FOREIGN KEY ("jenis_masakan_id") REFERENCES "jenis_masakan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catatan_harian" ADD CONSTRAINT "catatan_harian_dapur_id_fkey" FOREIGN KEY ("dapur_id") REFERENCES "dapur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimasi" ADD CONSTRAINT "estimasi_catatan_harian_id_fkey" FOREIGN KEY ("catatan_harian_id") REFERENCES "catatan_harian"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimasi" ADD CONSTRAINT "estimasi_wadah_id_fkey" FOREIGN KEY ("wadah_id") REFERENCES "wadah"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimasi" ADD CONSTRAINT "estimasi_jenis_masakan_id_fkey" FOREIGN KEY ("jenis_masakan_id") REFERENCES "jenis_masakan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "koreksi" ADD CONSTRAINT "koreksi_estimasi_id_fkey" FOREIGN KEY ("estimasi_id") REFERENCES "estimasi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "penyaluran" ADD CONSTRAINT "penyaluran_catatan_harian_id_fkey" FOREIGN KEY ("catatan_harian_id") REFERENCES "catatan_harian"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "penimbangan_referensi" ADD CONSTRAINT "penimbangan_referensi_catatan_harian_id_fkey" FOREIGN KEY ("catatan_harian_id") REFERENCES "catatan_harian"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "penimbangan_referensi" ADD CONSTRAINT "penimbangan_referensi_wadah_id_fkey" FOREIGN KEY ("wadah_id") REFERENCES "wadah"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sebaran_tebakan" ADD CONSTRAINT "sebaran_tebakan_catatan_harian_id_fkey" FOREIGN KEY ("catatan_harian_id") REFERENCES "catatan_harian"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sebaran_tebakan" ADD CONSTRAINT "sebaran_tebakan_wadah_id_fkey" FOREIGN KEY ("wadah_id") REFERENCES "wadah"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sesi_coba" ADD CONSTRAINT "sesi_coba_dapur_contoh_id_fkey" FOREIGN KEY ("dapur_contoh_id") REFERENCES "dapur"("id") ON DELETE CASCADE ON UPDATE CASCADE;
