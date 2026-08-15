"use client";

import { useEffect, useState } from "react";

/*
 * Teks transisi saat foto sedang dibaca — tugas 5.15.
 *
 * Ketiga kalimat ini ditulis persis, dan urutannya adalah desain:
 *
 *   0–1,5 dtk : "Membaca foto…"
 *               Belum menawarkan apa pun. Sebagian besar pembacaan selesai di
 *               sini, dan menawarkan slider terlalu dini membuat operator
 *               beralih padahal jawabannya sudah hampir tiba.
 *
 *   1,5–6 dtk : "Masih membaca… atau geser sendiri di bawah"
 *               Kata "ATAU" yang menanggung seluruh beban kalimat ini. Ia
 *               menawarkan pilihan yang setara, bukan jalan keluar dari
 *               kegagalan. Slider menjadi aktif tepat di sini.
 *
 *   > 6 dtk   : "Sinyal lambat — pakai geser saja, hasilnya sama."
 *               Menyebut penyebabnya (sinyal, bukan operator, bukan fotonya),
 *               memberi satu perintah jelas, dan menutup dengan jaminan mutu:
 *               HASILNYA SAMA. Tanpa kalimat terakhir itu, operator akan
 *               mengira dia baru saja menerima hasil kelas dua.
 *
 * Tidak ada kata "gagal", "error", "timeout", atau "coba lagi" di mana pun.
 */

export const AMBANG_TAWARKAN_GESER_MS = 1_500;
export const AMBANG_SINYAL_LAMBAT_MS = 6_000;

export type FaseBaca = "membaca" | "masih_membaca" | "sinyal_lambat";

export function faseDariLama(lamaMs: number): FaseBaca {
  if (lamaMs >= AMBANG_SINYAL_LAMBAT_MS) return "sinyal_lambat";
  if (lamaMs >= AMBANG_TAWARKAN_GESER_MS) return "masih_membaca";
  return "membaca";
}

export const TEKS_FASE: Readonly<Record<FaseBaca, string>> = {
  membaca: "Membaca foto…",
  masih_membaca: "Masih membaca… atau geser sendiri di bawah",
  sinyal_lambat: "Sinyal lambat — pakai geser saja, hasilnya sama.",
};

/** Slider menjadi aktif sejak detik 1,5 — bukan sejak model menyerah. */
export function sliderAktifPada(fase: FaseBaca): boolean {
  return fase !== "membaca";
}

export function usePesanTransisi(sedangMembaca: boolean): FaseBaca {
  const [lamaMs, setLamaMs] = useState(0);

  useEffect(() => {
    if (!sedangMembaca) return;

    const mulai = Date.now();
    const jam = setInterval(() => {
      setLamaMs(Date.now() - mulai);
    }, 250);

    return () => {
      clearInterval(jam);
      // Direset di pembersihan, bukan di badan effect. Kalau direset di badan
      // effect, React memicu render berantai; kalau tidak direset sama sekali,
      // pembacaan berikutnya membuka dengan "Sinyal lambat" selama 250 ms
      // padahal baru dimulai.
      setLamaMs(0);
    };
  }, [sedangMembaca]);

  return sedangMembaca ? faseDariLama(lamaMs) : "membaca";
}

export function PesanTransisi({ fase }: { fase: FaseBaca }) {
  return (
    <p className="text-badan text-netral-700" role="status" aria-live="polite">
      {TEKS_FASE[fase]}
    </p>
  );
}
