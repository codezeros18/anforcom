"use client";

import { useRef } from "react";

/*
 * Rana kamera dengan bingkai panduan — tugas 5.12.
 *
 * Bingkainya bukan hiasan. Model membaca SEBERAPA PENUH sebuah wadah, dan itu
 * hanya bisa dinilai kalau bibir wadah terlihat dan sudut pandangnya dari atas.
 * Foto dari samping membuat permukaan isi tampak lebih tinggi daripada
 * sebenarnya; foto yang memotong bibir wadah menghilangkan acuan penuhnya.
 *
 * Satu kalimat panduan, bukan paragraf. Orang yang sedang memegang HP di atas
 * panci panas tidak akan membaca paragraf.
 *
 * `capture="environment"` membuka kamera belakang langsung, bukan pemilih
 * berkas — menghemat satu ketukan yang tidak terlihat di hitungan tapi terasa.
 */

export interface BingkaiKameraProps {
  onFoto: (berkas: File) => void;
  aktif: boolean;
  sedangMembaca: boolean;
}

export function BingkaiKamera({ onFoto, aktif, sedangMembaca }: BingkaiKameraProps) {
  const masukan = useRef<HTMLInputElement>(null);

  return (
    <section aria-label="Ambil foto wadah">
      <div className="relative flex aspect-square items-center justify-center rounded-2xl border-2 border-dashed border-netral-300 bg-netral-100">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-6 rounded-xl border-2 border-aksen-500/60"
        />
        <p className="text-konteks max-w-[16rem] px-6 text-center text-netral-600">
          Potret dari atas. Pastikan bibir wadah ikut masuk ke dalam bingkai.
        </p>
      </div>

      <input
        ref={masukan}
        type="file"
        accept="image/jpeg,image/png"
        capture="environment"
        className="sr-only"
        onChange={(e) => {
          const berkas = e.target.files?.[0];
          if (berkas) onFoto(berkas);
          // Dikosongkan supaya memotret wadah yang sama dua kali tetap memicu
          // perubahan.
          e.target.value = "";
        }}
      />

      <button
        type="button"
        onClick={() => masukan.current?.click()}
        disabled={!aktif || sedangMembaca}
        className="text-badan mt-3 h-14 w-full rounded-xl bg-netral-900 font-semibold text-white active:bg-netral-800 disabled:opacity-40"
      >
        {sedangMembaca ? "Membaca…" : "Potret sisa"}
      </button>
    </section>
  );
}
