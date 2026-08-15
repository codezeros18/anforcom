"use client";

import { useState } from "react";
import Link from "next/link";
import { KartuPenyaluran, type TujuanPenyaluran } from "@/components/KartuPenyaluran";

/*
 * LAYAR 6 — penyaluran (5.16). Ketukan kelima dan terakhir.
 *
 * Finalisasi dan penyaluran dikirim dalam satu ketukan. Memisahkannya menjadi
 * "Finalisasi" lalu "Salurkan" akan menambah satu ketukan untuk sesuatu yang
 * bagi operator adalah satu tindakan: hari ini selesai, sisanya ke ternak.
 */

export interface LayarPenyaluranProps {
  catatanId: string;
  porsiDimasak: string;
  jumlahWadah: number;
}

export function LayarPenyaluran({
  catatanId,
  porsiDimasak,
  jumlahWadah,
}: LayarPenyaluranProps) {
  const [menyimpan, setMenyimpan] = useState(false);
  const [pesan, setPesan] = useState<string | null>(null);
  const [ringkasan, setRingkasan] = useState<{
    porsiTersisaFinal: string;
    rupiahBawah: string;
    rupiahAtas: string;
  } | null>(null);

  async function salurkan(tujuan: TujuanPenyaluran) {
    setMenyimpan(true);
    setPesan(null);

    try {
      const finalisasi = await fetch(`/api/catatan/${catatanId}/finalisasi`, {
        method: "POST",
      });
      const badanFinal: unknown = await finalisasi.json();

      if (!finalisasi.ok) {
        setPesan(
          (badanFinal as { pesan?: string }).pesan ??
            "Belum tersimpan. Coba sekali lagi.",
        );
        return;
      }

      const penyaluran = await fetch(`/api/catatan/${catatanId}/penyaluran`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tujuan }),
      });

      if (!penyaluran.ok) {
        const badan: unknown = await penyaluran.json();
        setPesan(
          (badan as { pesan?: string }).pesan ?? "Belum tersimpan. Coba sekali lagi.",
        );
        return;
      }

      const isi = badanFinal as {
        catatan: { porsiTersisaFinal: string };
        rupiahRentang: { bawah: string; atas: string };
      };
      setRingkasan({
        porsiTersisaFinal: isi.catatan.porsiTersisaFinal.replace(/\.00$/, ""),
        rupiahBawah: isi.rupiahRentang.bawah,
        rupiahAtas: isi.rupiahRentang.atas,
      });
    } catch {
      setPesan("Belum tersimpan. Coba sekali lagi.");
    } finally {
      setMenyimpan(false);
    }
  }

  if (ringkasan) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 p-6">
        <h1 className="text-badan font-semibold text-netral-900">Tersimpan.</h1>

        {/*
         * Angka sisa TIDAK diberi warna merah dan TIDAK diberi kata yang
         * menghakimi. Framingnya perencanaan, bukan evaluasi — CLAUDE.md
         * bagian 5.
         */}
        <p className="text-pahlawan tabular-nums text-netral-900">
          {ringkasan.porsiTersisaFinal}
        </p>
        <p className="text-badan text-netral-600">
          porsi tersisa dari {porsiDimasak} yang dimasak, {jumlahWadah} wadah.
        </p>
        <p className="text-konteks text-netral-600">
          Kira-kira Rp {ringkasan.rupiahBawah}–{ringkasan.rupiahAtas} bahan.
        </p>

        <Link
          href="/catat"
          className="text-badan mt-auto flex h-16 items-center justify-center rounded-xl bg-aksen-500 font-semibold text-white"
        >
          Selesai
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-5 p-4">
      <header>
        <h1 className="text-badan font-semibold text-netral-900">Sisanya ke mana?</h1>
        <p className="text-konteks text-netral-600">{jumlahWadah} wadah tercatat</p>
      </header>

      <KartuPenyaluran onPilih={(t) => void salurkan(t)} menyimpan={menyimpan} />

      {pesan && (
        <p
          className="text-badan rounded-xl bg-perhatian-100 px-4 py-3 text-perhatian-700"
          role="alert"
        >
          {pesan}
        </p>
      )}
    </main>
  );
}
