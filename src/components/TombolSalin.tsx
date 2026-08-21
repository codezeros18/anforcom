"use client";

import { useState } from "react";

/*
 * Tombol salin — 7.12.
 *
 * KENAPA INI ADA: operator sering BUKAN orang yang memutuskan berapa porsi
 * dimasak besok. Menyalin angka dan alasannya lalu mengirimkannya lewat
 * WhatsApp adalah bagaimana angka ini benar-benar sampai ke pengambil
 * keputusan. Tanpa tombol ini, rekomendasi berhenti di layar orang yang tidak
 * berwenang memakainya.
 *
 * Yang disalin adalah angka BESERTA alasannya, bukan angkanya saja. Pengelola
 * yang menerima "296" tanpa konteks akan bertanya dari mana; yang menerima
 * kalimat lengkapnya bisa langsung memutuskan.
 *
 * Ini satu-satunya bagian kartu rekomendasi yang butuh JavaScript, dan karena
 * itu ia dipisah ke berkasnya sendiri — sisanya tetap terlihat penuh saat
 * JavaScript dimatikan (7.4).
 */

export function TombolSalin({ teks }: { teks: string }) {
  const [tersalin, setTersalin] = useState(false);

  async function salin() {
    try {
      await navigator.clipboard.writeText(teks);
      setTersalin(true);
      window.setTimeout(() => {
        setTersalin(false);
      }, 2000);
    } catch {
      /*
       * Clipboard ditolak — beberapa peramban lama dan konteks non-HTTPS
       * memblokirnya. Teksnya diseleksi supaya operator bisa menyalin sendiri,
       * daripada dibiarkan dengan tombol yang tidak melakukan apa-apa.
       */
      const area = document.createElement("textarea");
      area.value = teks;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      document.body.removeChild(area);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void salin()}
      className="text-badan mt-4 h-14 w-full rounded-xl border-2 border-netral-300 font-medium text-netral-800 active:bg-netral-100"
    >
      {tersalin ? "Tersalin" : "Salin untuk dikirim"}
    </button>
  );
}
