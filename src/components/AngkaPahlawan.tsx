/*
 * Angka pahlawan 72px — 7.3 dan 7.5.
 *
 * DUA HAL YANG MEMBUAT KOMPONEN INI TIDAK BIASA:
 *
 * 1. IA SERVER COMPONENT, tanpa satu baris JavaScript pun. Angka utama adalah
 *    alasan seluruh halaman ini ada; ia tidak boleh menunggu bundel apa pun.
 *    Uji dengan JavaScript dimatikan: angkanya tetap di sana (7.4).
 *
 * 2. MODE TERTUTUP MEMAKAI `<details>`, bukan state React. Elemen itu bisa
 *    dibuka-tutup oleh peramban sendiri — satu ketukan, nol JavaScript. Hook
 *    pameran ("coba tebak dulu, berapa sisanya?") karena itu tetap bekerja di
 *    HP juri yang JavaScript-nya lambat dimuat, dan justru di situlah ia paling
 *    dibutuhkan.
 *
 * Ukurannya 72px karena layar ini akan tampil di layar besar saat pameran dan
 * harus terbaca dari tiga meter. `tabular-nums` supaya angka tidak bergeser
 * lebar saat berubah.
 */

export interface AngkaPahlawanProps {
  angka: string;
  label: string;
  /** Dibuka dalam keadaan tertutup — dipicu parameter URL `?tebak=1`. */
  tertutup: boolean;
}

export function AngkaPahlawan({ angka, label, tertutup }: AngkaPahlawanProps) {
  if (!tertutup) {
    return (
      <div>
        {/* Tidak ada warna merah untuk angka sisa — CLAUDE.md bagian 5. */}
        <p className="text-pahlawan tabular-nums text-netral-900">{angka}</p>
        <p className="text-[18px] leading-snug text-netral-700">{label}</p>
      </div>
    );
  }

  return (
    <details className="group">
      <summary className="cursor-pointer list-none">
        <span className="text-pahlawan tabular-nums text-netral-300 group-open:hidden">
          ??
        </span>
        <span className="text-konteks mt-1 block text-netral-600 group-open:hidden">
          Coba tebak dulu — ketuk untuk melihat.
        </span>
      </summary>

      <p className="text-pahlawan tabular-nums text-netral-900">{angka}</p>
      <p className="text-[18px] leading-snug text-netral-700">{label}</p>
    </details>
  );
}
