"use client";

/*
 * Layar 6 — penyaluran (tugas 5.16).
 *
 * Tiga kartu ikon besar, satu ketukan. Ini ketukan kelima dan terakhir.
 *
 * Tidak ada langkah konfirmasi sesudahnya. Menekan "Kompos" berarti kompos —
 * menambahkan "Yakin?" akan menjadikannya ketukan keenam dan membuat seluruh
 * alur melewati ambangnya, demi mencegah kesalahan yang bisa dibetulkan dengan
 * satu ketukan lagi kapan saja.
 *
 * Ikon besar dan label pendek: dibaca sekilas oleh orang yang sudah setengah
 * beranjak dari layar.
 */

export type TujuanPenyaluran = "ternak" | "kompos" | "tpa";

const PILIHAN: ReadonlyArray<{ tujuan: TujuanPenyaluran; label: string; ikon: string }> =
  [
    { tujuan: "ternak", label: "Ternak", ikon: "🐄" },
    { tujuan: "kompos", label: "Kompos", ikon: "🌱" },
    { tujuan: "tpa", label: "TPA", ikon: "🗑️" },
  ];

export function KartuPenyaluran({
  onPilih,
  menyimpan = false,
}: {
  onPilih: (tujuan: TujuanPenyaluran) => void;
  menyimpan?: boolean;
}) {
  return (
    <div
      className="grid grid-cols-3 gap-3"
      role="group"
      aria-label="Sisa disalurkan ke mana?"
    >
      {PILIHAN.map((p) => (
        <button
          key={p.tujuan}
          type="button"
          disabled={menyimpan}
          onClick={() => {
            onPilih(p.tujuan);
          }}
          className="flex min-h-32 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-netral-200 bg-netral-50 active:bg-netral-100 disabled:opacity-40"
        >
          <span className="text-sekunder" aria-hidden>
            {p.ikon}
          </span>
          <span className="text-badan font-medium text-netral-900">{p.label}</span>
        </button>
      ))}
    </div>
  );
}
