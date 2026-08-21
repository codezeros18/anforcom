"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PapanTombolNumerik } from "@/components/PapanTombolNumerik";
import {
  bacaDraf,
  drafUntukTanggal,
  hapusDraf,
  simpanDraf,
  type DrafCatatan,
} from "@/lib/draf-lokal";

/*
 * LAYAR 2 — catat porsi dimasak (tugas 5.9).
 *
 * KETUKAN NOL PADA JALUR NORMAL.
 *
 * Field sudah terisi rekomendasi kemarin, jadi operator yang menerima angkanya
 * hanya menekan "Simpan" — dan penekanan itu bukan bagian dari lima ketukan
 * jalur pencatatan wadah, melainkan pembuka harinya.
 *
 * Papan tombol numerik sendiri, bukan keyboard sistem. Alasannya ada di
 * `PapanTombolNumerik.tsx`.
 *
 * Pencatatan mundur (5.17) ada sebagai pemilih tanggal biasa. TIDAK ADA
 * peringatan, TIDAK ADA "streak hilang", TIDAK ADA pembeda visual. Operator
 * yang lupa mencatat kemarin sedang sibuk memasak, bukan sedang melalaikan
 * tugas — dan produk yang menghukumnya akan ditinggalkan di minggu kedua.
 *
 * SPRINT 9 MENAMBAHKAN KETAHANAN DI LAYAR INI:
 *   9.1  draf lokal + indikator "belum terkirim" + kirim ulang saat online
 *   9.2  pemulihan draf saat tab ditutup di tengah pengisian
 *   9.3  idempotensi: ketuk kirim 5x cepat tetap satu catatan
 *   9.8  tombol nonaktif saat porsi kosong
 *   9.10 angka di luar pola diterima, ditandai, tidak crash
 *   9.17 tanggal yang sudah ada membawa tawaran membuka catatannya
 */

/** Batas yang sama dengan `PORSI_WAJAR_MAKS` di skema. Ditandai, bukan ditolak. */
const PORSI_WAJAR_MAKS = 5_000;

export interface LayarPorsiDimasakProps {
  tanggalHariIni: string;
  /** Rekomendasi kemarin untuk hari ini, bila datanya sudah cukup. */
  nilaiAwal: string | null;
  kalimatAlasan: string | null;
}

export function LayarPorsiDimasak({
  tanggalHariIni,
  nilaiAwal,
  kalimatAlasan,
}: LayarPorsiDimasakProps) {
  const router = useRouter();
  const [porsi, setPorsi] = useState(nilaiAwal ?? "");
  const [tanggal, setTanggal] = useState(tanggalHariIni);
  const [pesan, setPesan] = useState<string | null>(null);
  const [menyimpan, setMenyimpan] = useState(false);
  const [belumTerkirim, setBelumTerkirim] = useState(false);

  /*
   * 9.2 — draf dibaca SEKALI saat render pertama, bukan di dalam efek.
   *
   * `useState` dengan inisialisasi malas berjalan tepat satu kali dan tidak
   * memicu render kedua. Membacanya di `useEffect` akan menampilkan layar
   * kosong lebih dulu, lalu menimpanya — persis kedipan yang membuat operator
   * mengira ketikannya hilang.
   */
  const [drafTerpulihkan, setDrafTerpulihkan] = useState<DrafCatatan | null>(() => {
    if (typeof window === "undefined") return null;
    return drafUntukTanggal(bacaDraf(window.localStorage), tanggalHariIni);
  });

  /*
   * 9.3 — PENJAGA KETUKAN GANDA.
   *
   * `useRef`, bukan `useState`: nilainya harus berubah SEKETIKA. `setMenyimpan`
   * baru terlihat pada render berikutnya, dan lima ketukan dalam 300 ms semuanya
   * terjadi sebelum render itu — jadi kelimanya akan lolos penjagaan berbasis
   * state. Ini bug yang tidak akan pernah muncul saat diklik dengan tenang.
   *
   * Ini lapis pertama. Lapis kedua ada di basis data: unique (dapur_id,
   * tanggal). Lapis ketiga menangani balasan 409 sebagai keberhasilan di bawah.
   */
  const sedangKirim = useRef(false);

  const mundur = tanggal !== tanggalHariIni;
  const porsiKosong = porsi.trim() === "" || Number(porsi) <= 0;
  const diLuarPola = Number(porsi) > PORSI_WAJAR_MAKS;

  function pulihkanDraf(draf: DrafCatatan) {
    setPorsi(draf.porsiDimasak);
    setTanggal(draf.tanggal);
    setBelumTerkirim(draf.pernahGagalKirim);
    setDrafTerpulihkan(null);
  }

  function buangDraf() {
    if (typeof window !== "undefined") hapusDraf(window.localStorage);
    setDrafTerpulihkan(null);
  }

  async function simpan() {
    // 9.8 — jaring kedua. Tombolnya sudah nonaktif, tapi Enter dari keyboard
    // fisik tetap bisa memanggil fungsi ini.
    if (porsiKosong) {
      setPesan("Angkanya belum diisi.");
      return;
    }

    // 9.3 — ketukan ke-2 sampai ke-5 berhenti di sini.
    if (sedangKirim.current) return;
    sedangKirim.current = true;

    setMenyimpan(true);
    setPesan(null);

    /*
     * 9.1 / 9.2 — draf disimpan SEBELUM permintaan dikirim, bukan sesudah gagal.
     *
     * Kalau baru disimpan di blok `catch`, tab yang ditutup tepat saat
     * permintaan sedang berjalan tidak meninggalkan apa pun. Menyimpan lebih
     * dulu berarti ketikan selamat pada setiap cara kegagalan, termasuk yang
     * tidak kita bayangkan.
     */
    if (typeof window !== "undefined") {
      simpanDraf(window.localStorage, {
        tanggal,
        porsiDimasak: porsi,
        dicatatMundur: mundur,
        pernahGagalKirim: false,
      });
    }

    try {
      const jawaban = await fetch("/api/catatan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tanggal, porsiDimasak: porsi, dicatatMundur: mundur }),
      });
      const badan: unknown = await jawaban.json();

      if (!jawaban.ok) {
        const galat = badan as { pesan?: string; kode?: string; catatanId?: string };

        /*
         * 9.3 / 9.17 — 409 BUKAN KEGAGALAN.
         *
         * Dua jalan sampai ke sini, dan keduanya berakhir baik:
         *   - ketukan ganda: catatan sudah dibuat oleh ketukan pertama
         *   - hari itu memang sudah pernah dicatat kemarin
         *
         * Keduanya berarti catatan yang dicari SUDAH ADA. Draf dibuang dan
         * layar melanjutkan ke catatan itu, persis seperti kalau ketukan ini
         * yang membuatnya. Operator tidak perlu tahu ketukan yang mana.
         */
        if (galat.kode === "TANGGAL_SUDAH_ADA" && galat.catatanId) {
          buangDraf();
          router.push(`/catat/${galat.catatanId}`);
          return;
        }

        // Ditolak server karena isinya — pesannya sudah berbahasa manusia.
        // Draf dibuang: menyimpan angka yang memang tidak sah tidak menolong.
        buangDraf();
        setPesan(galat.pesan ?? "Belum tersimpan. Coba sekali lagi.");
        return;
      }

      buangDraf();
      setBelumTerkirim(false);

      const sukses = badan as { catatan: { id: string } };
      router.push(`/catat/${sukses.catatan.id}`);
    } catch {
      /*
       * 9.19 — SINYAL PUTUS SAAT KIRIM.
       *
       * Ini satu-satunya cabang tempat draf DIPERTAHANKAN, ditandai belum
       * terkirim. Bukan salah operator, dan pesannya mengatakan begitu.
       */
      if (typeof window !== "undefined") {
        simpanDraf(window.localStorage, {
          tanggal,
          porsiDimasak: porsi,
          dicatatMundur: mundur,
          pernahGagalKirim: true,
        });
      }
      setBelumTerkirim(true);
      setPesan("Belum terkirim — angkanya tersimpan di HP ini. Coba lagi nanti.");
    } finally {
      setMenyimpan(false);
      sedangKirim.current = false;
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 p-4">
      <header>
        <h1 className="text-badan font-semibold text-netral-900">
          Berapa porsi dimasak?
        </h1>
        {kalimatAlasan && (
          <p className="text-konteks mt-1 text-netral-600">{kalimatAlasan}</p>
        )}
      </header>

      {/*
       * 9.2 — tawaran pemulihan draf.
       *
       * Ditawarkan, TIDAK dipaksakan. Menimpa field secara diam-diam akan
       * membuat operator yang sudah mulai mengetik ulang kehilangan ketikannya
       * untuk kedua kali.
       */}
      {drafTerpulihkan && (
        <div className="rounded-xl bg-perhatian-100 px-4 py-3">
          <p className="text-badan text-perhatian-700">
            Ada ketikan yang belum sempat tersimpan:{" "}
            <strong>{drafTerpulihkan.porsiDimasak} porsi</strong>.
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => {
                pulihkanDraf(drafTerpulihkan);
              }}
              className="text-badan h-11 flex-1 rounded-lg bg-aksen-500 font-medium text-white"
            >
              Pakai angka itu
            </button>
            <button
              type="button"
              onClick={buangDraf}
              className="text-badan h-11 flex-1 rounded-lg border border-netral-300 font-medium text-netral-700"
            >
              Mulai baru
            </button>
          </div>
        </div>
      )}

      <output
        className="text-pahlawan block tabular-nums text-netral-900"
        aria-live="polite"
      >
        {porsi === "" ? "0" : porsi}
      </output>

      {/*
       * 9.10 — angka di luar pola DITANDAI, bukan ditolak.
       *
       * Kalimatnya tidak menghakimi dan tidak menghalangi: kita tidak tahu
       * dapur orang lain sebesar apa, jadi yang bisa dikatakan jujur hanyalah
       * bahwa angkanya jauh dari pola biasa.
       */}
      {diLuarPola && (
        <p className="text-konteks rounded-lg bg-perhatian-100 px-3 py-2 text-perhatian-700">
          Angka ini jauh di luar pola biasa. Tetap bisa disimpan — periksa sebentar
          kalau-kalau ada digit tambahan.
        </p>
      )}

      <PapanTombolNumerik nilai={porsi} onUbah={setPorsi} />

      <label className="text-konteks flex items-center justify-between text-netral-600">
        <span>Tanggal</span>
        <input
          type="date"
          value={tanggal}
          max={tanggalHariIni}
          onChange={(e) => {
            setTanggal(e.target.value);
          }}
          className="text-badan rounded-lg border border-netral-300 bg-netral-50 px-3 py-2 text-netral-900"
        />
      </label>

      {/* 9.1 — indikator "belum terkirim", terpisah dari pesan galat biasa. */}
      {belumTerkirim && (
        <p className="text-konteks rounded-lg bg-netral-100 px-3 py-2 text-netral-700">
          Belum terkirim — tersimpan di HP ini.
        </p>
      )}

      {pesan && (
        <p
          className="text-badan rounded-xl bg-perhatian-100 px-4 py-3 text-perhatian-700"
          role="alert"
        >
          {pesan}
        </p>
      )}

      <button
        type="button"
        onClick={() => void simpan()}
        // 9.8 — nonaktif saat kosong, dengan alasannya terbaca di bawah.
        disabled={menyimpan || porsiKosong}
        className="text-badan mt-auto h-16 w-full rounded-xl bg-aksen-500 font-semibold text-white active:bg-aksen-600 disabled:opacity-40"
      >
        {menyimpan ? "Menyimpan…" : "Simpan"}
      </button>

      {porsiKosong && (
        <p className="text-konteks text-center text-netral-600">
          Isi angkanya dulu untuk melanjutkan.
        </p>
      )}
    </main>
  );
}
