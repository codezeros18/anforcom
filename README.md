# SISA

**Masalah.** Dapur yang memasak ratusan porsi setiap hari memutuskan jumlah masak besok dengan menebak, karena tidak ada yang pernah mencatat berapa yang tersisa hari ini.

**Solusi.** Alat catat 20 detik yang mengubah satu foto wadah sisa menjadi angka porsi lewat kalibrasi wadah milik dapur itu sendiri, lalu menjawab satu pertanyaan: berapa yang harus dimasak besok.

**Pengguna.** Juru masak atau petugas dapur di dapur kawasan berskala — pesantren, sekolah berasrama, kampus, rumah sakit, katering institusional — yang tidak punya mesin kasir dan tidak punya anggaran perangkat.

---

## Konteks masalah

Sampah makanan menyumbang sekitar **39–40%** limbah yang berakhir di TPA, dan komposisi ini relatif tidak berubah sejak 2019 hingga 2024 (SIPSN, Kementerian Lingkungan Hidup). Sebagian besar di antaranya sudah dimasak sebelum dibuang.

Pada skala nasional, kajian Bappenas (2021, periode data 2000–2019) menaksir susut dan sisa pangan Indonesia mencapai **23–48 juta ton per tahun** dengan kerugian ekonomi **Rp213–551 triliun per tahun**. Angka-angka ini disebutkan sebagai ukuran masalahnya, **bukan sebagai klaim dampak perangkat lunak ini**.

Di tingkat satu dapur, masalahnya lebih sederhana dan lebih konkret: seseorang harus memutuskan berapa porsi yang dimasak besok, setiap hari, tanpa mengetahui berapa yang tersisa kemarin.

---

## Status fitur

| Fitur                                                   | Status   |
| ------------------------------------------------------- | -------- |
| Layar publik — nilai muncul tanpa login dan tanpa input | ⬜ Belum |
| Catat porsi dimasak                                     | ⬜ Belum |
| Potret wadah sisa → estimasi porsi                      | ⬜ Belum |
| Slider fraksi keterisian (jalur setara tanpa foto)      | ⬜ Belum |
| Konfirmasi & koreksi estimasi                           | ⬜ Belum |
| Kalibrasi wadah (wadah × jenis masakan)                 | ⬜ Belum |
| Rekomendasi jumlah masak besok + kalimat alasan         | ⬜ Belum |
| Konfirmasi penyaluran sisa                              | ⬜ Belum |
| Riwayat 14 hari                                         | ⬜ Belum |
| Halaman Akurasi                                         | ⬜ Belum |
| Mode coba tanpa pendaftaran                             | ⬜ Belum |
| Draf lokal saat jaringan terputus                       | ⬜ Belum |

**Legenda:** ✅ Selesai · 🟡 Sebagian · ⬜ Belum

> Tabel ini diperbarui setiap sprint dan dijaga agar cocok satu banding satu dengan apa yang benar-benar bisa diklik di aplikasi.

---

## Aplikasi

**Production:** _(akan diisi)_

**Akun demo:** _(akan diisi)_

Layar utama dapat dibuka **tanpa login**. Untuk mencoba alur pencatatan, gunakan tombol **"Coba sebagai operator"** — tidak perlu mendaftar. Data dari mode coba tersimpan terpisah dan tidak memengaruhi data dapur sungguhan.

---

## Menjalankan dari nol

Prasyarat: Node.js 20 atau lebih baru, dan akses ke satu basis data PostgreSQL.

```bash
# 1. Klon dan masuk ke direktori proyek
git clone <url-repo>
cd sisa

# 2. Pasang dependensi
npm install

# 3. Siapkan variabel lingkungan
cp .env.example .env
# lalu buka .env dan isi DATABASE_URL

# 4. Jalankan migrasi basis data
npx prisma migrate dev

# 5. Isi data contoh
npm run seed

# 6. Jalankan server pengembangan
npm run dev
```

Buka `http://localhost:3000`. Layar utama akan menampilkan data dapur contoh.

---

## Variabel lingkungan

### Wajib untuk menjalankan lokal

| Variabel       | Isi                          | Bila kosong          |
| -------------- | ---------------------------- | -------------------- |
| `DATABASE_URL` | Connection string PostgreSQL | Aplikasi gagal start |

### Opsional — hanya bila fiturnya dipakai

| Variabel                     | Isi                               | Bila kosong                                                                    |
| ---------------------------- | --------------------------------- | ------------------------------------------------------------------------------ |
| `VISION_ENABLED`             | `true` / `false`. Default `true`  | Diperlakukan sebagai `true`                                                    |
| `VISION_API_KEY`             | Kunci API model penglihatan       | Pembacaan foto tidak tersedia; **aplikasi tetap berfungsi penuh** lewat slider |
| `STORAGE_URL`, `STORAGE_KEY` | Object storage untuk foto         | Foto tidak tersimpan; alur lain tetap jalan                                    |
| `RESEARCH_ENDPOINTS_ENABLED` | `true` / `false`. Default `false` | Endpoint pencatatan data riset tidak aktif                                     |

**Catatan penting:** aplikasi ini dirancang agar tetap berfungsi sepenuhnya tanpa model penglihatan. Jalankan dengan `VISION_ENABLED=false` untuk membuktikannya — seluruh alur pencatatan tetap dapat diselesaikan lewat slider fraksi keterisian.

---

## Stack

| Komponen       | Teknologi                         | Alasan                                                                                                                               |
| -------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Kerangka kerja | Next.js (App Router) + TypeScript | Layar utama dirender di server agar tampil cepat di jaringan lambat, dan satu basis kode untuk UI dan API mengurangi titik kegagalan |
| Basis data     | PostgreSQL                        | Kalibrasi memerlukan kunci komposit, dan nilai uang memerlukan tipe desimal eksak                                                    |
| ORM            | Prisma                            | Skema terpusat dalam satu berkas dan migrasi terversi                                                                                |
| Styling        | Tailwind CSS                      | Konsisten cepat, dan ukuran huruf besar mudah dikunci sebagai token                                                                  |
| Pengujian      | Lihat `package.json`              | Fokus pada logika domain di `src/core`                                                                                               |

Grafik riwayat digambar sebagai SVG tanpa pustaka charting, karena tiga garis pada satu sumbu tidak memerlukan dependensi tambahan yang harus diunduh pengguna.

---

## Struktur folder

```
src/
  core/          logika domain murni: kalibrasi, rekomendasi, audit
  vision/        satu-satunya lapisan yang mengetahui model penglihatan
  app/           rute Next.js (UI + route handler)
  components/
  lib/           klien basis data, serialisasi publik, util
prisma/          skema dan migrasi
docs/            dokumentasi teknis
```

### Kenapa `core` dipisahkan dari `vision`

`src/core` berisi seluruh logika yang menghitung dan memutuskan: rumus kalibrasi, mesin rekomendasi, dan jejak audit koreksi. Folder ini **tidak mengimpor apa pun** dari `src/vision`, dan aturan itu ditegakkan oleh konfigurasi lint sehingga pelanggaran menggagalkan pemeriksaan.

Pemisahan ini bukan sekadar kerapian. Ia yang membuat pernyataan _"sistem tetap berfungsi tanpa model penglihatan"_ dapat dibuktikan dengan menjalankan satu perintah, bukan dijelaskan dengan kata-kata:

```bash
VISION_ENABLED=false npm test
```

Model penglihatan hanya membaca satu hal — seberapa penuh sebuah wadah yang sudah dikalibrasi. Semua perhitungan yang menghasilkan angka porsi, rupiah, dan rekomendasi terjadi di `core`, dari konstanta yang dimiliki dapur itu sendiri.

---

## Menjalankan tes

```bash
npm test                          # seluruh tes
VISION_ENABLED=false npm test     # membuktikan sistem jalan tanpa model penglihatan
npm run lint
npm run typecheck
```

Tes difokuskan pada `src/core`: rumus kalibrasi dan pembatas pembaruannya, mesin rekomendasi termasuk lantai keras dan pengecualian hari anomali, serta sifat _append-only_ dari jejak koreksi.

---

## Batasan yang diketahui

1. **Tidak mengestimasi wadah campuran.** Wadah yang berisi lebih dari satu jenis masakan dilaporkan sebagai rentang lebar dan wajib diisi manual.
2. **Tidak menjamin akurasi pada pencahayaan buruk.** Uap, lampu kuning, dan bayangan menurunkan akurasi pembacaan; jalur slider selalu tersedia sebagai jalur setara.
3. **Tidak mengukur dampak setelah adopsi.** Sistem tidak mengklaim persentase pengurangan sisa. Klaim seperti itu memerlukan satu siklus pemakaian penuh yang belum terjadi.
4. **Tidak menilai kinerja orang.** Tidak ada kolom identitas individu di basis data dan tidak ada cara memfilter data per orang. Jejak audit mencatat peran, bukan nama.
5. **Tidak menimbang.** Angka porsi adalah estimasi dari fraksi keterisian wadah terdaftar, bukan pengukuran massa.
6. **Tidak menggantikan keputusan manusia.** Rekomendasi adalah usulan dengan batas bawah yang tidak dapat dinonaktifkan; keputusan tetap pada dapur.
7. **Tidak melacak asal bahan, pemasok, atau rantai pasok.**
8. **Tidak menghitung emisi karbon.**

---

## Pernyataan data

Aplikasi ini membedakan tiga kelas data, dan perbedaannya ditampilkan di antarmuka:

| Kelas                  | Sumber                                                                               | Tanda di antarmuka                  |
| ---------------------- | ------------------------------------------------------------------------------------ | ----------------------------------- |
| **Observasi lapangan** | Penimbangan dan pencatatan yang dilakukan tim di lokasi, dengan izin pengelola dapur | Tanpa tanda khusus — ini data utama |
| **Historis dapur**     | Dipindahkan dari catatan manual dapur                                                | Label _"dari catatan manual dapur"_ |
| **Dapur contoh**       | Dibuat untuk keperluan pengujian dan mode coba                                       | Label _"dapur contoh"_              |

Seluruh angka nilai rupiah dan berat dihitung dari data penimbangan tim, bukan dari estimasi model. Data dapur nyata digunakan berdasarkan izin tertulis pengelola, dan setiap dapur dapat memilih agar namanya diganti label generik pada seluruh tampilan publik. Tidak ada foto yang memuat wajah orang, dan metadata lokasi pada foto dihapus sebelum penyimpanan.

Bila belum ada dapur yang memberi izin tampil publik, layar utama menampilkan dapur contoh dengan keterangan yang menyatakan hal itu secara terbuka.

---

## Penyelesaian masalah

### Gejala: aplikasi gagal start dengan pesan tentang koneksi basis data

Periksa `DATABASE_URL` di `.env`. Bila memakai basis data terkelola, pastikan alamat IP kamu diizinkan pada pengaturan jaringan penyedia.

### Gejala: `prisma migrate dev` gagal dengan pesan tentang skema yang sudah ada

Basis data sudah berisi tabel dari percobaan sebelumnya. Untuk lingkungan pengembangan:

```bash
npx prisma migrate reset --force
npm run seed
```

Perintah ini menghapus seluruh data. Jangan dijalankan pada basis data production.

### Gejala: layar utama kosong setelah instalasi berhasil

Data contoh belum diisi. Jalankan `npm run seed`.

### Gejala: memotret wadah tidak menghasilkan angka, hanya berputar lalu berhenti

Tiga kemungkinan, urut dari yang paling sering:

1. `VISION_API_KEY` belum diisi — gunakan slider fraksi keterisian, hasilnya setara
2. Jaringan lambat sehingga permintaan melewati batas waktu 6 detik — slider akan muncul otomatis
3. `VISION_ENABLED=false` sedang aktif — ini perilaku yang diharapkan

### Gejala: muncul pesan "Wadah ini belum terdaftar di dapur ini"

Ini bukan kesalahan. Sistem hanya membaca wadah yang sudah dikalibrasi, agar angkanya dapat dipertanggungjawabkan. Daftarkan wadah tersebut terlebih dahulu, atau masukkan angkanya secara manual.

### Gejala: tes lulus di lokal tetapi gagal di CI

CI menjalankan tes dua kali, salah satunya dengan `VISION_ENABLED=false`. Jalankan perintah itu di lokal untuk melihat kegagalannya.

---

## Dokumentasi teknis

- [`docs/arsitektur.md`](docs/arsitektur.md) — lapisan sistem dan alasan setiap keputusan teknis
- [`docs/kalibrasi.md`](docs/kalibrasi.md) — rumus kalibrasi wadah, aturan pembaruan konstanta, dan batasannya
- [`docs/metode-akurasi.md`](docs/metode-akurasi.md) — cara akurasi diukur dari jejak koreksi

---

## Lisensi

_(akan diisi)_
