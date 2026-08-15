"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PapanTombolNumerik } from "@/components/PapanTombolNumerik";

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
 */

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

  const mundur = tanggal !== tanggalHariIni;

  async function simpan() {
    if (porsi === "" || Number(porsi) <= 0) {
      setPesan("Angkanya belum diisi.");
      return;
    }

    setMenyimpan(true);
    setPesan(null);

    try {
      const jawaban = await fetch("/api/catatan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tanggal, porsiDimasak: porsi, dicatatMundur: mundur }),
      });
      const badan: unknown = await jawaban.json();

      if (!jawaban.ok) {
        const galat = badan as { pesan?: string };
        setPesan(galat.pesan ?? "Belum tersimpan. Coba sekali lagi.");
        return;
      }

      const sukses = badan as { catatan: { id: string } };
      router.push(`/catat/${sukses.catatan.id}`);
    } catch {
      // Sinyal putus di tengah kirim. Bukan salah operator, dan pesannya
      // mengatakan begitu.
      setPesan("Belum tersimpan. Coba sekali lagi.");
    } finally {
      setMenyimpan(false);
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

      <output
        className="text-pahlawan block tabular-nums text-netral-900"
        aria-live="polite"
      >
        {porsi === "" ? "0" : porsi}
      </output>

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
        disabled={menyimpan}
        className="text-badan mt-auto h-16 w-full rounded-xl bg-aksen-500 font-semibold text-white active:bg-aksen-600 disabled:opacity-40"
      >
        {menyimpan ? "Menyimpan…" : "Simpan"}
      </button>
    </main>
  );
}
