"use client";

/*
 * Ketukan 1 dan 2 alur normal: pilih wadah, lalu pilih jenis masakan.
 *
 * WADAH sebagai kartu besar berfoto, maksimal 5 terlihat tanpa gulir (5.10).
 * Foto acuan penting: operator mengenali pancinya dari rupanya, bukan dari
 * namanya. "Panci Besar 2" dan "Panci Besar 3" tidak bisa dibedakan sambil
 * berdiri, tapi fotonya bisa.
 *
 * JENIS MASAKAN sebagai chip, maksimal 4 (5.11). Lebih kecil dari kartu wadah
 * dengan sengaja — pilihannya lebih sedikit dan lebih mudah diingat, jadi tidak
 * perlu memakan ruang layar yang sama.
 *
 * Keduanya SATU KETUKAN: memilih langsung memilih. Tidak ada "pilih lalu
 * konfirmasi" — itu akan menggandakan ketukan pada dua langkah pertama dan
 * membuat target 5 ketukan mustahil.
 */

export interface WadahPilihan {
  id: string;
  nama: string;
  bentuk: string;
  fotoAcuanUrl: string | null;
}

export interface JenisMasakanPilihan {
  id: string;
  nama: string;
}

const IKON_BENTUK: Readonly<Record<string, string>> = {
  panci: "🍲",
  nampan: "🍱",
  baskom: "🥣",
  ompreng: "🍛",
  box: "📦",
  lainnya: "🥄",
};

export function DaftarWadah({
  wadah,
  terpilih,
  onPilih,
}: {
  wadah: readonly WadahPilihan[];
  terpilih: string | null;
  onPilih: (id: string) => void;
}) {
  if (wadah.length === 0) {
    // State kosong yang memberi jalan keluar, bukan sekadar mengabarkan kosong.
    return (
      <p className="text-badan rounded-xl bg-netral-100 p-4 text-netral-700">
        Belum ada wadah terdaftar. Daftarkan wadah dulu — sekitar 1 menit.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Pilih wadah">
      {wadah.slice(0, 5).map((w) => {
        const aktif = terpilih === w.id;
        return (
          <button
            key={w.id}
            type="button"
            role="radio"
            aria-checked={aktif}
            onClick={() => {
              onPilih(w.id);
            }}
            className={`flex min-h-28 flex-col items-center justify-center gap-1 rounded-2xl border-2 p-3 ${
              aktif
                ? "border-aksen-500 bg-aksen-500/10"
                : "border-netral-200 bg-netral-50"
            }`}
          >
            {w.fotoAcuanUrl ? (
              /*
               * Foto acuan datang dari object storage dengan URL bertanda
               * tangan yang berubah tiap permintaan. Pengoptimal gambar Next
               * tidak bisa menyimpannya dalam cache dan hanya menambah satu
               * lompatan jaringan — persis yang tidak boleh ditambahkan di
               * jaringan dapur.
               */
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={w.fotoAcuanUrl}
                alt=""
                className="h-14 w-14 rounded-lg object-cover"
              />
            ) : (
              <span className="text-sekunder" aria-hidden>
                {IKON_BENTUK[w.bentuk] ?? "🥄"}
              </span>
            )}
            <span className="text-badan font-medium text-netral-900">{w.nama}</span>
          </button>
        );
      })}
    </div>
  );
}

export function DaftarJenisMasakan({
  jenis,
  terpilih,
  onPilih,
}: {
  jenis: readonly JenisMasakanPilihan[];
  terpilih: string | null;
  onPilih: (id: string) => void;
}) {
  if (jenis.length === 0) {
    return (
      <p className="text-badan rounded-xl bg-netral-100 p-4 text-netral-700">
        Belum ada jenis masakan terdaftar.
      </p>
    );
  }

  return (
    <div
      className="flex flex-wrap gap-2"
      role="radiogroup"
      aria-label="Pilih jenis masakan"
    >
      {jenis.slice(0, 4).map((j) => {
        const aktif = terpilih === j.id;
        return (
          <button
            key={j.id}
            type="button"
            role="radio"
            aria-checked={aktif}
            onClick={() => {
              onPilih(j.id);
            }}
            className={`text-badan min-h-12 rounded-full border-2 px-4 font-medium ${
              aktif
                ? "border-aksen-500 bg-aksen-500 text-white"
                : "border-netral-300 bg-netral-50 text-netral-800"
            }`}
          >
            {j.nama}
          </button>
        );
      })}
    </div>
  );
}
