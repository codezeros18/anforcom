# CLAUDE.md — Aturan Kerja Proyek SISA

> **Baca berkas ini sampai habis sebelum mengerjakan apa pun.**
> Lalu periksa `_kerja/TASKS.md` untuk tugas aktif, dan `_kerja/PROGRESS.md` untuk keadaan terakhir sistem.
> Konteks lengkap tentang **kenapa** produk ini ada dan **kenapa** setiap keputusan diambil: `_kerja/BLUEPRINT.md`.

Kalau `BLUEPRINT.md` menjelaskan _kenapa_, berkas ini menjelaskan _apa yang boleh dan tidak_.

---

## 1. TIGA PERTANYAAN GERBANG

Jawab ketiganya sebelum menulis baris kode pertama. Kalau salah satu jawabannya salah, **berhenti**.

**G1 — Apakah ini ada di `_kerja/TASKS.md` sebagai tugas aktif?**
Kalau tidak ada, jangan kerjakan. Tulis usulannya di `_kerja/PROGRESS.md` bagian "butuh keputusan manusia".

**G2 — Kalau ini halaman baru: siapa di dapur yang membukanya, dan apa yang dia kerjakan di situ?**
Jawaban harus menyebut **orang nyata** dan **pekerjaan nyata**.

- ✅ Lulus: _"Kepala dapur, di akhir bulan, membuka daftar catatan dengan filter bulan ini untuk menyalin angka ke laporan anggaran."_
- ❌ Gagal: _"Untuk melihat statistik keseluruhan sistem."_

Halaman yang ada supaya sistem terlihat lengkap adalah over-engineering. Tidak dibangun.

**G3 — Apakah ini masuk daftar Tingkat 3?**
Kalau ya, dilarang selamanya. Tidak boleh masuk dengan nama lain, versi kecil, atau sebagai "persiapan".

---

## 2. ATURAN TINGKAT 1 / 2 / 3

### Tingkat 1 — Alur inti. Tidak boleh diganggu.

Sepuluh layar. Harus sempurna: cepat, tidak pecah di input aneh, lolos uji orang luar tanpa dipandu.

1. Layar publik (tanpa login) · 2. Catat porsi dimasak · 3. Potret sisa + estimasi + konfirmasi/koreksi · 4. Slider fallback (komponen di dalam layar 3) · 5. Rekomendasi besok + kalimat alasan · 6. Konfirmasi penyaluran · 7. Riwayat 14 hari · 8. Halaman Akurasi · 9. Pendaftaran/kalibrasi wadah · 10. Mode coba

### Tingkat 2 — Kedalaman operasional. Hanya setelah Sprint 10 lulus.

Daftar catatan dengan filter · kelola wadah & jenis masakan · kelola profil dapur & izin · pengaturan biaya bahan · riwayat koreksi · ekspor rekap.

Setiap halaman wajib lewat gerbang **G2** lebih dulu.

### Tingkat 3 — Dilarang selamanya.

RBAC berlapis · modul kepatuhan · grafik emisi · modul pemasok · rapor per-menu · direktori penerima · sinkron offline penuh · notifikasi · poin/gamifikasi · multi-cabang · perbandingan sebelum–sesudah.

---

## 3. ATURAN KERAS

Tidak bisa ditawar. Pelanggaran salah satu = tugas dianggap gagal, bukan selesai.

1. **Tidak ada kolom, kueri, ekspor, atau tampilan yang memuat identitas orang.** Audit mencatat **peran** (`operator`, `pengelola`), bukan nama. Tidak boleh ada cara memfilter data per orang.
2. **Koreksi selalu baris baru.** Tabel `koreksi` hanya menerima `INSERT`. Tidak pernah `UPDATE`, tidak pernah `DELETE`. Nilai asli di `estimasi` tidak pernah diubah setelah dibuat; nilai final **dihitung**, bukan ditimpa.
3. **Berat sebagai gram bilangan bulat. Uang sebagai desimal eksak. Tidak pernah `float`/`double`.** Berat: `INTEGER` (gram). Uang: `DECIMAL(12,2)`. Porsi: `DECIMAL(8,2)`. Fraksi: `DECIMAL(5,4)`.
4. **`/src/core` tidak boleh mengimpor apa pun dari `/src/vision`.** Arah impor satu jalan: `app` → `core`, `app` → `vision`, `vision` → tidak ke mana-mana. Ini yang membuat klaim "model bisa dicabut" dapat dibuktikan dengan tes.
5. **Angka dampak hanya dari tabel `penimbangan_referensi`.** Rupiah, kilogram, dan persentase sisa tidak boleh dihitung dari tabel `estimasi`. Estimasi model untuk operasional harian; timbangan tim untuk klaim.
6. **Lantai keras rekomendasi tidak bisa dimatikan.** Tidak ada pengaturan, flag, peran, atau parameter yang menonaktifkannya. Lantai selalu ditampilkan di layar.
7. **Rekomendasi tidak ditampilkan di bawah ambang data minimum** (`|D| >= 5`). Di bawah itu, tampilkan pesan ambang — bukan angka.
8. **Data dapur contoh tidak pernah bercampur dengan data dapur nyata.** Sesi coba disimpan di `sesi_coba` dengan isolasi, dan diberi badge yang terlihat di UI.
9. **Tidak ada rahasia, foto berwajah, atau data tanpa izin yang ter-commit.** Metadata EXIF dihapus di server sebelum penyimpanan.
10. **Mode anonim ditangani di satu tempat** (`/src/lib/serialisasi-publik.ts`), bukan tersebar. Satu boolean mengubah seluruh tampilan nama.

---

## 4. STACK TERKUNCI

| Lapisan            | Teknologi                                                      |
| ------------------ | -------------------------------------------------------------- |
| Kerangka kerja     | Next.js (App Router) + TypeScript                              |
| Basis data         | PostgreSQL                                                     |
| ORM                | Prisma                                                         |
| Styling            | Tailwind CSS                                                   |
| Hosting aplikasi   | Vercel                                                         |
| Hosting basis data | Penyedia Postgres terkelola yang **tidak menidurkan instance** |
| Penyimpanan foto   | Object storage S3-kompatibel, URL bertanda tangan              |
| Model penglihatan  | API model multimodal, **hanya dipanggil dari `/src/vision`**   |
| Pengujian          | Vitest (atau Jest — pilih satu di Sprint 0 dan konsisten)      |

### Dilarang ditambah

Pustaka state management global (Redux, Zustand, Jotai) · pustaka komponen UI berat (MUI, Chakra, Ant) · GraphQL · message queue · Redis · Docker Compose untuk pengembangan lokal · ORM kedua · pustaka animasi · pustaka charting berat.

**Alasan larangan:** setiap dependensi tambahan adalah bobot muat halaman yang harus dibayar untuk memenuhi target < 3 detik di jaringan lambat, satu titik gagal tambahan saat demo, dan satu hal lagi yang harus dijelaskan alasannya. Aplikasi sepuluh layar tidak punya masalah yang dipecahkan alat-alat di atas.

**Untuk grafik 14 hari:** gunakan SVG yang ditulis sendiri, bukan pustaka charting. Tiga garis pada satu sumbu tidak memerlukan 100 KB dependensi.

**Kalau merasa butuh sesuatu di daftar larangan:** jangan pasang. Tulis di `_kerja/PROGRESS.md` bagian "butuh keputusan manusia" beserta masalah yang ingin dipecahkan.

---

## 5. KONVENSI KODE

### Bahasa penamaan

**Istilah domain: bahasa Indonesia. Istilah kerangka kerja dan teknis umum: bahasa Inggris.**

| Konteks                  | Konvensi                     | Contoh                                                          |
| ------------------------ | ---------------------------- | --------------------------------------------------------------- |
| Tabel & kolom basis data | `snake_case` Indonesia       | `catatan_harian`, `porsi_dimasak`, `fraksi_keterisian`          |
| Properti TypeScript      | `camelCase` Indonesia        | `porsiDimasak`, `fraksiKeterisian`, `lantaiKeras`               |
| Fungsi                   | `camelCase`, verba Indonesia | `hitungRekomendasi()`, `cariKonstanta()`, `perbaruiKalibrasi()` |
| Komponen domain          | `PascalCase` Indonesia       | `KartuRekomendasi`, `SliderFraksi`, `DaftarWadah`               |
| Komponen UI generik      | `PascalCase` Inggris         | `Button`, `Card`, `Skeleton`                                    |
| Berkas                   | `kebab-case`                 | `kalibrasi.ts`, `serialisasi-publik.ts`                         |
| Tipe & interface         | `PascalCase` Indonesia       | `HasilEstimasi`, `KonteksKalibrasi`                             |

**Alasan:** skema basis data sudah berbahasa Indonesia. Mencampurnya dengan properti berbahasa Inggris memaksa penerjemahan bolak-balik di setiap lapisan — sumber bug dan sumber tafsir berbeda antar agen.

Glosarium lengkap ada di `_kerja/BLUEPRINT.md` bagian 13. **Pakai istilah dari glosarium, jangan mengarang sinonim.**

### Struktur folder

```
/src
  /core            ← logika domain murni. Tidak impor dari /vision, tidak impor React
    kalibrasi.ts
    rekomendasi.ts
    audit.ts
    __tests__/
  /vision          ← satu-satunya tempat yang tahu tentang model
    provider.ts          (interface)
    model-provider.ts
    manual-provider.ts
    index.ts             (memilih provider dari env)
  /app             ← rute Next.js: UI + route handler
  /components
  /lib             ← db client, serialisasi-publik.ts, util
/prisma
  schema.prisma
  /migrations
/docs              ← dokumentasi teknis, MASUK repo publik
```

### Penanganan error

- **Route handler** mengembalikan bentuk konsisten: `{ ok: false, kode: "WADAH_TIDAK_TERDAFTAR", pesan: "..." }`
- Kode error adalah konstanta bertipe, bukan string bebas
- Fungsi `/core` **melempar error bertipe**, tidak mengembalikan `null` diam-diam
- Tidak ada `catch` kosong. Tidak ada `catch` yang hanya `console.log`
- Kesalahan tak terduga tidak menampilkan stack trace ke pengguna

### Validasi input

- Validasi di **batas sistem** (route handler), memakai skema (Zod atau setara — pilih di Sprint 0)
- `/core` mengasumsikan input sudah tervalidasi dan tetap melempar error bila asumsi dilanggar
- Semua nilai numerik divalidasi rentangnya, bukan hanya tipenya
- Daftar input tidak lazim yang wajib ditangani ada di `_kerja/TASKS.md` Sprint 9

### Pesan ke pengguna

Bahasa manusia, bukan bahasa sistem. Pengguna adalah juru masak yang tangannya basah dan sedang terburu-buru.

| ❌ Jangan                      | ✅ Tulis begini                                                    |
| ------------------------------ | ------------------------------------------------------------------ |
| "Error 422: validation failed" | "Angkanya belum diisi."                                            |
| "Vessel not calibrated"        | "Wadah ini belum terdaftar di dapur ini."                          |
| "Request timeout"              | "Sinyal lambat — pakai geser saja, hasilnya sama."                 |
| "Insufficient data points"     | "Data masih 3 hari. Rekomendasi muncul setelah 5 hari pencatatan." |

Aturan tambahan: jangan pernah memakai kata yang menghakimi (_boros_, _buruk_, _gagal_, _melebihi target_) untuk data dapur. Tidak ada warna merah untuk angka sisa. Framing selalu **perencanaan**, bukan **evaluasi**.

---

## 6. KONVENSI COMMIT

**Format:** `tipe(scope): deskripsi singkat berbahasa Indonesia`

Tipe: `feat` · `fix` · `docs` · `test` · `refactor` · `chore`
Scope: `core`, `kalibrasi`, `rekomendasi`, `vision`, `db`, `ui`, `publik`, `api`, `ci`

Contoh: `feat(kalibrasi): tambah pembatas perubahan 15% pada pembaruan konstanta`

**Ritme — ini bukan saran:**

- **Minimal satu commit bermakna per hari**, termasuk hari yang dipakai untuk kerja lapangan. Hari lapangan → `docs(lapangan): catatan observasi situs 1 hari ke-2`
- `main` selalu bisa di-deploy. Kerja di `feat/*`, digabung harian
- **Tidak boleh ada push besar menjelang tenggat.** Riwayat commit akan dibaca dan dinilai; commit yang menumpuk di dua hari terakhir membantah dokumen metodologi yang kita tulis sendiri
- Satu commit = satu perubahan logis. Jangan menggabungkan refactor dengan fitur baru

---

## 7. DEFINITION OF DONE

Sebuah tugas **belum selesai** sampai keempat perintah berikut lulus:

```bash
npm run lint          # tanpa error, tanpa warning baru
npm run typecheck     # tanpa error
npm test              # semua tes hijau
VISION_ENABLED=false npm test   # alur penuh tetap lulus tanpa model
```

Perintah keempat bukan formalitas. Ia adalah bukti tunggal untuk klaim arsitektural terpenting proyek ini. Kalau ia gagal, tugas gagal.

Tambahan untuk tugas yang menyentuh UI:

- Diuji di viewport 360 px
- Diuji dengan throttle jaringan 400 kbps / 400 ms RTT
- Semua state ada: kosong, memuat, error, sukses

Tambahan untuk tugas yang menyentuh `/core`:

- Ada tes untuk jalur normal **dan** jalur batas

---

## 8. PROTOKOL SETELAH SELESAI

Wajib, sebelum menutup tugas:

1. Centang tugas di `_kerja/TASKS.md` — `[ ]` → `[x]`
2. Tambah entri di `_kerja/PROGRESS.md`: tanggal, tugas, berkas yang berubah, keputusan teknis beserta alasannya, masalah yang ditemui dan cara mengatasinya
3. Kalau ada yang disederhanakan dengan sengaja → catat di bagian "utang teknis"
4. Kalau ada masalah setup yang sempat menghambat → catat di "jebakan lingkungan", **dengan gejala lebih dulu** supaya bisa dicari saat kejadian berulang
5. Commit dengan pesan sesuai konvensi

Tugas yang selesai tanpa memperbarui kedua berkas itu dianggap **belum selesai**, karena tiga agen bekerja paralel dan berkas itu adalah satu-satunya memori bersama mereka.

---

## 9. APA YANG DILAKUKAN SAAT RAGU

**Jangan menebak.** Menebak menghasilkan tiga tafsir berbeda dari tiga agen, dan itu kegagalan yang paling mahal di proyek ini.

Urutan yang benar:

1. Cari jawabannya di `_kerja/BLUEPRINT.md` — kemungkinan besar ada di sana
2. Kalau tidak ada, cek `_kerja/PROGRESS.md` — mungkin sudah pernah diputuskan
3. Kalau masih tidak ada: **tulis pertanyaannya** di `_kerja/PROGRESS.md` bagian "butuh keputusan manusia", dengan format:
   - Pertanyaannya apa
   - Kenapa ini menghambat
   - Pilihan yang mungkin, dengan konsekuensi masing-masing
   - Apa yang kamu kerjakan sementara menunggu
4. **Kerjakan bagian lain dulu.** Jangan memblokir seluruh tugas karena satu keputusan

Hal yang **selalu** harus ditanyakan, tidak boleh diputuskan sendiri:

- Menambah dependensi di luar stack terkunci
- Mengubah skema basis data setelah Sprint 1 selesai
- Apa pun yang menyentuh Aturan Keras di bagian 3
- Menambah halaman yang tidak ada di TASKS.md
- Mengubah rumus di `/core`

---

_Berkas ini adalah kontrak. Kalau sebuah keputusan tidak tertulis di sini atau di BLUEPRINT, ia belum diputuskan — dan tugasmu adalah menanyakannya, bukan mengarangnya._
