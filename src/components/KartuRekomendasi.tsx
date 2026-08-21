import { TombolSalin } from "./TombolSalin";

/*
 * Layar 5 — kartu rekomendasi (7.9, 7.10, 7.11, 7.12).
 *
 * Ini bagian yang menjawab pertanyaan "lalu saya harus apa besok?", dan tiga
 * aturan di dalamnya tidak bisa ditawar:
 *
 * 1. BARIS LANTAI KERAS SELALU TAMPIL (7.10), bahkan ketika bukan lantai yang
 *    menang. CLAUDE.md aturan 6: tidak ada pengaturan, flag, atau peran yang
 *    bisa mematikannya. Menyembunyikannya saat basis yang menang akan membuat
 *    jaminan "tidak akan kurang" tidak terlihat justru pada hari-hari biasa.
 *
 * 2. DI BAWAH AMBANG TIDAK ADA ANGKA (7.11). Bukan angka pucat, bukan angka
 *    dengan tanda tanya — tidak ada angka sama sekali. Rekomendasi dari dua
 *    titik data terlihat berwibawa dan tidak berarti apa-apa.
 *
 * 3. KALIMAT ALASAN DIRENDER APA ADANYA dari /core. Layar tidak merakit ulang
 *    kalimatnya; kalau ia merakit sendiri, akan ada dua versi yang menyimpang.
 *
 * Komponen ini SERVER COMPONENT. Hanya tombol salin yang perlu JavaScript, dan
 * ia dipisah supaya sisanya tetap terlihat saat JavaScript dimatikan (7.4).
 */

export interface KartuRekomendasiSiap {
  status: "siap";
  porsi: string;
  lantaiKeras: string;
  kalimatAlasan: string;
  /** Hari-hari yang dipakai, supaya angkanya bisa ditelusuri (7.9). */
  hariDipakai: { catatanHarianId: string; tanggal: string; konsumsi: string }[];
}

export interface KartuRekomendasiBelumCukup {
  status: "belum_cukup_data";
  jumlahData: number;
  sisaHari: number;
}

export type KartuRekomendasiProps = KartuRekomendasiSiap | KartuRekomendasiBelumCukup;

export function KartuRekomendasi(props: KartuRekomendasiProps) {
  if (props.status === "belum_cukup_data") {
    return (
      <section
        className="rounded-2xl border border-netral-200 bg-netral-50 p-4"
        aria-label="Saran porsi besok"
      >
        <p className="text-badan text-netral-800">
          Data masih {props.jumlahData} hari. Saran angka muncul setelah 5 hari
          pencatatan.
        </p>
        <p className="text-konteks mt-2 text-netral-600">
          {props.sisaHari} hari lagi. Riwayat dan angka rupiah tetap bisa dilihat di
          bawah.
        </p>
      </section>
    );
  }

  const teksSalin = `Saran porsi besok: ${props.porsi} porsi.\n\n${props.kalimatAlasan}`;

  return (
    <section
      className="rounded-2xl border border-netral-200 bg-netral-50 p-4"
      aria-label="Saran porsi besok"
    >
      <p className="text-konteks text-netral-600">Besok disarankan</p>
      <p className="text-sekunder tabular-nums text-netral-900">{props.porsi} porsi</p>

      <p className="text-badan mt-3 text-netral-700">{props.kalimatAlasan}</p>

      {/*
       * 7.10 — selalu tampil, apa pun aturan yang menang.
       */}
      <p className="text-badan mt-3 rounded-lg bg-netral-100 px-3 py-2 text-netral-800">
        Tidak pernah di bawah {props.lantaiKeras} — konsumsi tertinggi 14 hari terakhir.
      </p>

      {/*
       * 7.9 — setiap angka di kalimat bisa ditelusuri ke hari asalnya.
       *
       * Tautan biasa, bukan tooltip berbasis JavaScript: ia tetap bisa
       * diklik dengan JavaScript dimatikan, dan itu yang membuat klaim
       * "setiap angka bisa ditelusuri" benar-benar berlaku.
       */}
      {props.hariDipakai.length > 0 && (
        <details className="mt-3">
          <summary className="text-konteks cursor-pointer text-netral-600">
            Angka itu dari hari mana?
          </summary>
          <ul className="text-konteks mt-2 grid gap-1">
            {props.hariDipakai.map((h) => (
              <li key={h.catatanHarianId}>
                <a
                  href={`/riwayat#hari-${h.catatanHarianId}`}
                  className="text-aksen-600 underline"
                >
                  {h.tanggal} — {h.konsumsi} porsi terpakai
                </a>
              </li>
            ))}
          </ul>
        </details>
      )}

      {/*
       * 7.12 — operator sering bukan orang yang memutuskan jumlah masak besok.
       * Menyalin dan mengirimnya lewat WhatsApp adalah bagaimana angka ini
       * benar-benar sampai ke pengambil keputusan.
       */}
      <TombolSalin teks={teksSalin} />
    </section>
  );
}
