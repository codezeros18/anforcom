/*
 * Grafik 14 hari — tiga garis, satu sumbu, SVG yang ditulis sendiri (7.13).
 *
 * KENAPA TIDAK MEMAKAI PUSTAKA CHARTING: tiga garis pada satu sumbu tidak
 * memerlukan 100 KB dependensi. Bobot itu dibayar oleh operator dan juri yang
 * membuka layar ini di jaringan dapur, demi kemampuan menggambar puluhan jenis
 * grafik yang tidak satu pun kita butuhkan.
 *
 * Berkas ini di bawah 200 baris dan tidak menambah satu byte pun ke bundel
 * JavaScript — ia komponen server yang menghasilkan SVG di HTML pertama.
 *
 * KONSEKUENSI YANG PALING PENTING: grafik tetap terlihat dengan JavaScript
 * dimatikan. Pustaka charting mana pun akan menampilkan kotak kosong di sana.
 */

export interface TitikRiwayat {
  tanggal: string;
  dimasak: string;
  terpakai: string | null;
  tersisa: string | null;
  isAnomali: boolean;
}

const LEBAR = 340;
const TINGGI = 160;
const PADDING = { atas: 12, kanan: 8, bawah: 22, kiri: 34 };

const GARIS = [
  { kunci: "dimasak", label: "Dimasak", warna: "#52525b", tebal: 2 },
  { kunci: "terpakai", label: "Terpakai", warna: "#0f766e", tebal: 2.5 },
  { kunci: "tersisa", label: "Tersisa", warna: "#a1a1aa", tebal: 2 },
] as const;

function angka(nilai: string | null): number | null {
  if (nilai === null) return null;
  const n = Number(nilai);
  return Number.isFinite(n) ? n : null;
}

/** Membentuk `d` dari titik-titik, memutus garis pada hari yang belum final. */
function jalur(
  nilai: readonly (number | null)[],
  keX: (i: number) => number,
  keY: (v: number) => number,
): string {
  let d = "";
  let menyambung = false;

  nilai.forEach((v, i) => {
    if (v === null) {
      // Hari yang belum difinalisasi memutus garis, bukan digambar sebagai nol.
      // Menggambarnya nol akan terbaca sebagai "tidak ada sisa sama sekali".
      menyambung = false;
      return;
    }
    d += `${menyambung ? "L" : "M"}${keX(i).toFixed(1)} ${keY(v).toFixed(1)} `;
    menyambung = true;
  });

  return d.trim();
}

export function GrafikRiwayat({ hari }: { hari: readonly TitikRiwayat[] }) {
  if (hari.length < 2) {
    return (
      <p className="text-konteks text-netral-600">
        Grafik muncul setelah beberapa hari pencatatan.
      </p>
    );
  }

  const deret = {
    dimasak: hari.map((h) => angka(h.dimasak)),
    terpakai: hari.map((h) => angka(h.terpakai)),
    tersisa: hari.map((h) => angka(h.tersisa)),
  };

  const semua = [...deret.dimasak, ...deret.terpakai, ...deret.tersisa].filter(
    (v): v is number => v !== null,
  );
  const maks = Math.max(...semua, 1);
  // Sumbu selalu dimulai dari nol. Memotong sumbu membuat selisih kecil tampak
  // dramatis — dan angka dapur tidak boleh dibuat tampak lebih buruk dari
  // kenyataannya.
  const atas = Math.ceil(maks / 50) * 50;

  const lebarPlot = LEBAR - PADDING.kiri - PADDING.kanan;
  const tinggiPlot = TINGGI - PADDING.atas - PADDING.bawah;

  const keX = (i: number) =>
    PADDING.kiri + (hari.length === 1 ? 0 : (i * lebarPlot) / (hari.length - 1));
  const keY = (v: number) => PADDING.atas + tinggiPlot - (v / atas) * tinggiPlot;

  const garisSumbu = [0, atas / 2, atas];

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${String(LEBAR)} ${String(TINGGI)}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Grafik ${String(hari.length)} hari: porsi dimasak, terpakai, dan tersisa`}
      >
        {garisSumbu.map((v) => (
          <g key={v}>
            <line
              x1={PADDING.kiri}
              y1={keY(v)}
              x2={LEBAR - PADDING.kanan}
              y2={keY(v)}
              stroke="#e4e4e7"
              strokeWidth={1}
            />
            <text x={4} y={keY(v) + 4} fontSize={10} fill="#71717a">
              {Math.round(v)}
            </text>
          </g>
        ))}

        {/*
         * Hari anomali ditandai batang tipis, bukan disembunyikan. Ia
         * dikecualikan dari rekomendasi, dan penontonnya berhak tahu hari mana
         * yang dikecualikan — pengecualian yang tidak terlihat adalah
         * pengecualian yang tidak bisa diperiksa.
         */}
        {hari.map((h, i) =>
          h.isAnomali ? (
            <line
              key={h.tanggal}
              x1={keX(i)}
              y1={PADDING.atas}
              x2={keX(i)}
              y2={PADDING.atas + tinggiPlot}
              stroke="#d4d4d8"
              strokeWidth={6}
              strokeDasharray="2 3"
            />
          ) : null,
        )}

        {GARIS.map((g) => (
          <path
            key={g.kunci}
            d={jalur(deret[g.kunci], keX, keY)}
            fill="none"
            stroke={g.warna}
            strokeWidth={g.tebal}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}

        <text x={PADDING.kiri} y={TINGGI - 6} fontSize={10} fill="#71717a">
          {hari[0]?.tanggal.slice(5)}
        </text>
        <text
          x={LEBAR - PADDING.kanan}
          y={TINGGI - 6}
          fontSize={10}
          fill="#71717a"
          textAnchor="end"
        >
          {hari[hari.length - 1]?.tanggal.slice(5)}
        </text>
      </svg>

      <figcaption className="text-konteks mt-2 flex flex-wrap gap-x-4 gap-y-1 text-netral-600">
        {GARIS.map((g) => (
          <span key={g.kunci} className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="inline-block h-0.5 w-4 rounded"
              style={{ backgroundColor: g.warna }}
            />
            {g.label}
          </span>
        ))}
        {hari.some((h) => h.isAnomali) && (
          <span className="text-netral-500">Garis putus: hari ditandai tidak biasa</span>
        )}
      </figcaption>
    </figure>
  );
}
