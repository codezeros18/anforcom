/*
 * Indikator progres — tugas 6.3.
 *
 * Orang yang belum yakin produk ini berguna sedang menghitung berapa lama lagi
 * ini akan berlangsung. Indikator yang menjawab pertanyaan itu terus-menerus
 * adalah selisih antara "sebentar lagi selesai" dan "entah sampai kapan" — dan
 * selisih itu yang menentukan apakah dia sampai wadah kelima.
 *
 * Angka eksplisit ("Langkah 3 dari 5"), bukan hanya titik-titik. Titik harus
 * dihitung; angka langsung terbaca.
 */

export interface IndikatorLangkahProps {
  langkah: number;
  total: number;
  judul: string;
}

export function IndikatorLangkah({ langkah, total, judul }: IndikatorLangkahProps) {
  return (
    <header>
      <p className="text-konteks text-netral-600">
        Langkah {langkah} dari {total}
      </p>
      <h1 className="text-badan mt-1 font-semibold text-netral-900">{judul}</h1>

      <div className="mt-3 flex gap-1" aria-hidden>
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={`h-1.5 flex-1 rounded-full ${
              i < langkah ? "bg-aksen-500" : "bg-netral-200"
            }`}
          />
        ))}
      </div>
    </header>
  );
}
