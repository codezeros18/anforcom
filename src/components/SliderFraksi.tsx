"use client";

/*
 * Slider fraksi keterisian — BLUEPRINT P4.
 *
 * "Slider setara, bukan darurat."
 *
 * Tiga hal yang membuat komponen ini memenuhi P4, dan yang akan membatalkannya
 * kalau diubah:
 *
 * 1. IA SELALU TERLIHAT. Bukan di balik menu, bukan di layar terpisah, bukan
 *    muncul setelah foto gagal. Ia sudah ada di layar sebelum rana ditekan.
 * 2. IA AKTIF SEJAK DETIK 1,5, bukan sejak model menyerah. Kalau ia baru aktif
 *    setelah kegagalan, ia terasa seperti kerusakan; kalau sudah aktif sejak
 *    awal, peralihan terasa seperti pilihan.
 * 3. TIDAK ADA SATU KATA PUN di sini yang menyebutnya cadangan, darurat, atau
 *    alternatif. Labelnya menjelaskan apa yang dilakukannya, titik.
 *
 * Pratinjau angka porsi berubah LANGSUNG saat digeser (tugas 5.14). Tanpa itu,
 * operator menggeser angka persen yang tidak berarti apa-apa baginya — yang dia
 * kenal adalah porsi, bukan fraksi.
 */

export interface SliderFraksiProps {
  /** Persen keterisian, 0–100. */
  persen: number;
  onUbah: (persen: number) => void;
  /** Porsi wadah ini saat penuh, untuk pratinjau langsung. */
  porsiPenuh: number | null;
  aktif: boolean;
  onSimpan: () => void;
  menyimpan?: boolean;
}

export function SliderFraksi({
  persen,
  onUbah,
  porsiPenuh,
  aktif,
  onSimpan,
  menyimpan = false,
}: SliderFraksiProps) {
  // Pratinjau, bukan angka yang disimpan. Angka yang disimpan dihitung ulang
  // di server dengan aritmetika eksak; ini hanya supaya geseran terasa nyata.
  const pratinjauPorsi =
    porsiPenuh === null ? null : Math.round((porsiPenuh * persen) / 100);

  return (
    <section
      className="rounded-2xl border border-netral-200 bg-netral-50 p-4"
      aria-label="Geser keterisian wadah"
    >
      <div className="mb-3 flex items-baseline justify-between">
        <label htmlFor="slider-fraksi" className="text-badan text-netral-700">
          Seberapa penuh wadahnya?
        </label>
        <span className="text-sekunder font-semibold tabular-nums text-netral-900">
          {persen}%
        </span>
      </div>

      <input
        id="slider-fraksi"
        type="range"
        min={0}
        max={100}
        step={1}
        value={persen}
        disabled={!aktif}
        onChange={(e) => {
          onUbah(Number(e.target.value));
        }}
        aria-describedby="slider-pratinjau"
        className="h-12 w-full accent-aksen-500 disabled:opacity-40"
      />

      <p id="slider-pratinjau" className="text-konteks mt-2 text-netral-600">
        {pratinjauPorsi === null
          ? "Pilih wadah dulu untuk melihat perkiraan porsinya."
          : `Kira-kira ${String(pratinjauPorsi)} porsi.`}
      </p>

      <button
        type="button"
        onClick={onSimpan}
        disabled={!aktif || menyimpan}
        className="text-badan mt-4 h-14 w-full rounded-xl bg-aksen-500 font-semibold text-white active:bg-aksen-600 disabled:opacity-40"
      >
        {menyimpan ? "Menyimpan…" : "Simpan"}
      </button>
    </section>
  );
}
