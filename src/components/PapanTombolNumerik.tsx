"use client";

/*
 * Papan tombol numerik sendiri, BUKAN keyboard sistem.
 *
 * Kenapa ini bukan kemewahan:
 * - Keyboard sistem di Android kelas bawah memakan separuh layar dan muncul
 *   dengan jeda yang terasa. Layar 360 px yang tersisa separuh tidak cukup
 *   untuk menampilkan angka besar sekaligus tombol simpan.
 * - Keyboard sistem menampilkan huruf, simbol, emoji, dan saran kata untuk
 *   sebuah field yang hanya menerima angka.
 * - Tombolnya kecil. Tangan yang basah atau berminyak sering meleset, dan
 *   meleset di sini berarti angka porsi yang salah.
 *
 * Tombol di bawah tingginya 64 px — cukup besar untuk jari yang basah, dan
 * tetap muat sembilan tombol tanpa menggulir di layar 360 px.
 */

export interface PapanTombolNumerikProps {
  nilai: string;
  onUbah: (nilai: string) => void;
  /** Paling banyak dua desimal — sesuai DECIMAL(8,2). */
  maksDesimal?: number;
}

const TOMBOL = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "hapus"] as const;

export function PapanTombolNumerik({
  nilai,
  onUbah,
  maksDesimal = 2,
}: PapanTombolNumerikProps) {
  function tekan(tombol: string) {
    if (tombol === "hapus") {
      onUbah(nilai.slice(0, -1));
      return;
    }

    if (tombol === ".") {
      if (nilai.includes(".")) return;
      onUbah(nilai === "" ? "0." : `${nilai}.`);
      return;
    }

    const [, pecahan] = nilai.split(".");
    if (pecahan !== undefined && pecahan.length >= maksDesimal) return;

    // Nol di depan tidak menumpuk: "0" lalu "5" menjadi "5", bukan "05".
    const berikutnya = nilai === "0" ? tombol : nilai + tombol;
    if (berikutnya.replace(".", "").length > 8) return;

    onUbah(berikutnya);
  }

  return (
    <div className="grid grid-cols-3 gap-2" role="group" aria-label="Papan angka">
      {TOMBOL.map((tombol) => (
        <button
          key={tombol}
          type="button"
          onClick={() => {
            tekan(tombol);
          }}
          aria-label={tombol === "hapus" ? "Hapus satu angka" : tombol}
          className="text-sekunder h-16 rounded-xl bg-netral-100 font-semibold text-netral-900 active:bg-netral-200"
        >
          {tombol === "hapus" ? "⌫" : tombol}
        </button>
      ))}
    </div>
  );
}
