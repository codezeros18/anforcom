# Arsitektur

> Kerangka. Diisi seiring sprint berjalan — setiap bagian ditulis saat bagian
> sistem yang dijelaskannya benar-benar ada, bukan sebelumnya.

## 1. Gambaran umum

Monolit Next.js (App Router) dengan PostgreSQL. Satu repo, satu deployment.

_(diisi setelah Sprint 1)_

## 2. Lapisan dan arah impor

Arah impor satu jalan dan ditegakkan alat:

```
app  ->  core
app  ->  vision
vision  ->  (tidak ke mana-mana)
core  ->  (tidak ke mana-mana)
```

- `/src/core` — logika domain murni: kalibrasi, rekomendasi, audit
- `/src/vision` — satu-satunya lapisan yang tahu tentang model penglihatan
- `/src/app` — rute Next.js: UI dan route handler
- `/src/lib` — client basis data, serialisasi publik, util

_(diisi setelah Sprint 4: cara aturan ini ditegakkan, dan tes yang membuktikannya)_

## 3. Model data

_(diisi setelah Sprint 1)_

## 4. Aturan presisi angka

Berat disimpan sebagai gram bilangan bulat, uang sebagai desimal eksak. Tidak
ada `float` di jalur perhitungan mana pun.

_(diisi setelah Sprint 1: tabel tipe per kolom dan alasannya)_

## 5. Koreksi append-only

_(diisi setelah Sprint 3)_

## 6. Target non-fungsional dan cara mengukurnya

_(diisi setelah Sprint 7)_
