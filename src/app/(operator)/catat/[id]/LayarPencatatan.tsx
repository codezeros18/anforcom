"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BingkaiKamera } from "@/components/BingkaiKamera";
import { KartuEstimasi } from "@/components/KartuEstimasi";
import {
  DaftarJenisMasakan,
  DaftarWadah,
  type JenisMasakanPilihan,
  type WadahPilihan,
} from "@/components/PilihanWadah";
import {
  PesanTransisi,
  sliderAktifPada,
  usePesanTransisi,
} from "@/components/PesanTransisi";
import { PenolakanWadahTakTerdaftar } from "@/components/PenolakanWadahTakTerdaftar";
import { SliderFraksi } from "@/components/SliderFraksi";

/*
 * LAYAR 3 — inti alur pencatatan. Di sinilah lima ketukan itu terjadi.
 *
 *   ketukan 1  pilih wadah          (~3 dtk)
 *   ketukan 2  pilih jenis masakan  (~2 dtk)
 *   ketukan 3  rana kamera          (~4 dtk)  -> estimasi muncul (~3 dtk)
 *   ketukan 4  "Benar", ATAU geser lalu "Simpan"  (~5 dtk)
 *   ketukan 5  "Selesai"            (~2 dtk)   -> di layar penyaluran
 *
 * DUA HAL YANG MENENTUKAN APAKAH ANGKA ITU TERCAPAI:
 *
 * 1. SLIDER SELALU ADA DI LAYAR INI. Bukan layar terpisah, bukan di balik
 *    menu, bukan muncul setelah foto gagal. Ia dirender di bawah kamera sejak
 *    awal dan menjadi aktif pada detik 1,5. Jalur geser karena itu memakan
 *    jumlah ketukan yang SAMA dengan jalur foto — tanpa navigasi tambahan.
 *
 * 2. TIDAK ADA LANGKAH KONFIRMASI. Memilih wadah langsung memilih. Menekan
 *    "Benar" langsung menyimpan. Setiap "Yakin?" menggandakan ketukan pada
 *    langkah yang dia jaga, demi mencegah kesalahan yang bisa dibetulkan
 *    dengan satu ketukan lagi kapan saja.
 */

export interface LayarPencatatanProps {
  catatanId: string;
  porsiDimasak: string;
  wadah: readonly WadahPilihan[];
  jenisMasakan: readonly JenisMasakanPilihan[];
  /** porsiPenuh per pasangan `wadahId|jenisMasakanId`, untuk pratinjau slider. */
  porsiPenuhPerPasangan: Readonly<Record<string, number>>;
  jumlahWadahTercatat: number;
}

interface EstimasiTersimpan {
  id: string;
  porsiEstimasi: string;
  rentangBawah: string;
  rentangAtas: string;
  wajibManual: boolean;
  sumberKalibrasi: "deklarasi" | "terkalibrasi";
  konstantaPerkiraan: boolean;
  /** 9.13 — pembacaan model kurang meyakinkan (foto gelap, buram, sudut aneh). */
  keyakinanRendah: boolean;
}

/**
 * 9.16 — apakah koreksi melonjak ekstrem terhadap angka acuannya.
 *
 * Ambangnya sepuluh kali, ke ATAS maupun ke BAWAH. Arah turun ikut dijaga
 * karena salah geser ke ujung kiri menghasilkan "0,5 porsi" dari estimasi 50 —
 * sama mustahilnya, dan sama mudahnya terjadi dengan jempol basah.
 *
 * Acuan nol tidak pernah dianggap lonjakan: apa pun dibagi nol tidak punya
 * kelipatan yang bermakna, dan estimasi nol yang dikoreksi menjadi angka wajar
 * adalah kejadian normal ("ternyata masih ada").
 */
export function lonjakanEkstrem(acuan: string, baru: string): boolean {
  const a = Number(acuan);
  const b = Number(baru);
  if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0) return false;
  return b >= a * 10 || b * 10 <= a;
}

export function LayarPencatatan({
  catatanId,
  porsiDimasak,
  wadah,
  jenisMasakan,
  porsiPenuhPerPasangan,
  jumlahWadahTercatat,
}: LayarPencatatanProps) {
  const router = useRouter();

  const [wadahId, setWadahId] = useState<string | null>(null);
  const [jenisId, setJenisId] = useState<string | null>(null);
  const [isCampuran, setIsCampuran] = useState(false);

  const [membaca, setMembaca] = useState(false);
  const fase = usePesanTransisi(membaca);

  const [persen, setPersen] = useState(50);
  const [estimasi, setEstimasi] = useState<EstimasiTersimpan | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);
  const [menyimpan, setMenyimpan] = useState(false);
  const [tersimpan, setTersimpan] = useState(jumlahWadahTercatat);
  const [wadahTakTerdaftar, setWadahTakTerdaftar] = useState(false);

  /*
   * 9.16 — estimasi yang sedang dikoreksi.
   *
   * Berbeda dari `estimasi` (yang sedang DITAMPILKAN): begitu operator menekan
   * "Koreksi", kartu hilang dan slider kembali, tapi id-nya harus tetap
   * dipegang supaya geseran berikutnya menjadi KOREKSI atas estimasi itu —
   * bukan estimasi baru yang memutus jejak audit.
   */
  const [mengoreksiId, setMengoreksiId] = useState<string | null>(null);
  const [porsiAcuanKoreksi, setPorsiAcuanKoreksi] = useState<string | null>(null);
  /** 9.16 — koreksi ekstrem sudah dikonfirmasi sekali; ketukan kedua meneruskannya. */
  const [perluKonfirmasi, setPerluKonfirmasi] = useState(false);

  const siap = wadahId !== null && jenisId !== null;
  const porsiPenuh = siap
    ? (porsiPenuhPerPasangan[`${wadahId}|${jenisId}`] ?? null)
    : null;

  /*
   * Slider aktif sejak detik 1,5 saat foto sedang dibaca, DAN aktif sepanjang
   * waktu ketika tidak ada pembacaan berjalan. Ia tidak pernah menunggu
   * kegagalan.
   */
  const sliderAktif = siap && !menyimpan && (!membaca || sliderAktifPada(fase));

  function bacaJawaban(badan: unknown): EstimasiTersimpan | null {
    const isi = badan as {
      estimasi?: {
        id: string;
        porsiEstimasi: string;
        rentangBawah: string;
        rentangAtas: string;
        wajibManual: boolean;
        sumberKalibrasi: "deklarasi" | "terkalibrasi";
        konstantaPerkiraan: boolean;
        keyakinanRendah?: boolean;
      };
    };
    if (!isi.estimasi) return null;

    const e = isi.estimasi;
    return {
      id: e.id,
      porsiEstimasi: e.porsiEstimasi,
      rentangBawah: e.rentangBawah,
      rentangAtas: e.rentangAtas,
      wajibManual: e.wajibManual,
      // Diteruskan apa adanya — komponen badge yang memutuskan apakah ada yang
      // perlu ditampilkan, dan ia hilang sendiri saat terkalibrasi (6.4).
      sumberKalibrasi: e.sumberKalibrasi,
      konstantaPerkiraan: e.konstantaPerkiraan,
      // Jalur geser tidak memakai model, jadi tidak pernah "kurang yakin".
      keyakinanRendah: e.keyakinanRendah === true,
    };
  }

  async function kirimFoto(berkas: File) {
    if (!siap) return;

    setMembaca(true);
    setPesan(null);

    const formulir = new FormData();
    formulir.append("foto", berkas);
    formulir.append("wadahId", wadahId);
    formulir.append("jenisMasakanId", jenisId);
    formulir.append("isCampuran", String(isCampuran));

    try {
      const jawaban = await fetch(`/api/catatan/${catatanId}/estimasi`, {
        method: "POST",
        body: formulir,
      });
      const badan: unknown = await jawaban.json();

      if (!jawaban.ok) {
        /*
         * Pesan dari server sudah berbahasa manusia dan sudah menyebut jalan
         * keluarnya ("pakai geser saja, hasilnya sama"). Layar tidak
         * menambahkan apa pun — slider di bawah sudah aktif.
         */
        const isi = badan as { kode?: string; pesan?: string };
        // 6.5 — sistem MENOLAK MENEBAK untuk wadah tak terdaftar, dan
        // penolakannya membawa dua jalan keluar, bukan jalan buntu.
        if (isi.kode === "WADAH_TIDAK_TERDAFTAR") {
          setWadahTakTerdaftar(true);
          return;
        }
        setPesan(isi.pesan ?? "Pakai geser saja, hasilnya sama.");
        return;
      }

      setEstimasi(bacaJawaban(badan));
    } catch {
      setPesan("Sinyal lambat — pakai geser saja, hasilnya sama.");
    } finally {
      setMembaca(false);
    }
  }

  /*
   * 9.16 / ATURAN KERAS 2 — KOREKSI LEWAT ENDPOINT KOREKSI, bukan estimasi baru.
   *
   * Sampai Sprint 8, tombol "Koreksi" hanya mengembalikan layar ke slider, dan
   * geseran berikutnya membuat baris `estimasi` KEDUA. Akibatnya: tabel
   * `koreksi` tidak pernah terisi dari alur operator, selisih antara tebakan
   * sistem dan penilaian manusia tidak pernah tercatat, dan halaman Akurasi
   * kehilangan bahan mentahnya. Konstanta kalibrasi juga tidak ikut belajar,
   * karena EWMA-nya dipicu dari koreksi.
   *
   * Sesudah perbaikan ini: kalau layar sedang mengoreksi estimasi yang SUDAH
   * ADA, geseran dikirim ke `/api/estimasi/:id/koreksi`. Kalau belum ada
   * estimasi, ia tetap membuat estimasi manual seperti biasa.
   */
  async function kirimKoreksi(estimasiId: string, porsiSesudah: string) {
    setMenyimpan(true);
    setPesan(null);

    try {
      const jawaban = await fetch(`/api/estimasi/${estimasiId}/koreksi`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ porsiSesudah }),
      });
      const badan: unknown = await jawaban.json();

      if (!jawaban.ok) {
        const isi = badan as { pesan?: string };
        setPesan(isi.pesan ?? "Belum tersimpan. Coba sekali lagi.");
        return;
      }

      selesaikanWadah();
    } catch {
      setPesan("Belum tersimpan. Coba sekali lagi.");
    } finally {
      setMenyimpan(false);
      setPerluKonfirmasi(false);
    }
  }

  /**
   * Porsi yang diwakili posisi slider saat ini, sebagai teks dua desimal.
   *
   * `null` bila konstanta wadah belum diketahui — tanpa konstanta, persentase
   * tidak bisa diterjemahkan menjadi porsi.
   */
  function porsiDariSlider(): string | null {
    if (porsiPenuh === null) return null;
    return ((Number(porsiPenuh) * persen) / 100).toFixed(2);
  }

  function kirimGeseran() {
    if (!siap) return;

    /*
     * 9.16 — KOREKSI 10x ESTIMASI: DITERIMA, tapi dikonfirmasi SEKALI.
     *
     * Selisih sebesar ini hampir selalu salah ketik atau salah geser. Tapi
     * "hampir selalu" bukan "selalu": wadah yang dikira hampir habis ternyata
     * baru dibuka memang bisa sepuluh kali lipat. Jadi ia tidak ditolak —
     * hanya ditanyakan sekali, lalu diteruskan apa adanya.
     *
     * Sekali, bukan setiap kali: dialog yang muncul berulang akan dilewati
     * tanpa dibaca, dan sesudah itu ia tidak menjaga apa pun.
     */
    const porsiBaru = porsiDariSlider();
    if (
      mengoreksiId !== null &&
      porsiAcuanKoreksi !== null &&
      porsiBaru !== null &&
      !perluKonfirmasi &&
      lonjakanEkstrem(porsiAcuanKoreksi, porsiBaru)
    ) {
      setPerluKonfirmasi(true);
      return;
    }

    if (mengoreksiId !== null && porsiBaru !== null) {
      void kirimKoreksi(mengoreksiId, porsiBaru);
      return;
    }

    void kirimEstimasiManual();
  }

  async function kirimEstimasiManual() {
    if (!siap) return;

    setMenyimpan(true);
    setPesan(null);

    try {
      const jawaban = await fetch(`/api/catatan/${catatanId}/estimasi-manual`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          wadahId,
          jenisMasakanId: jenisId,
          // Persen bulat menjadi fraksi empat desimal — dikirim sebagai TEKS
          // supaya tidak melewati float sebelum sampai di server.
          fraksiKeterisian: (persen / 100).toFixed(4),
          isCampuran,
        }),
      });
      const badan: unknown = await jawaban.json();

      if (!jawaban.ok) {
        const isi = badan as { kode?: string; pesan?: string };
        if (isi.kode === "WADAH_TIDAK_TERDAFTAR") {
          setWadahTakTerdaftar(true);
          return;
        }
        setPesan(isi.pesan ?? "Belum tersimpan. Coba sekali lagi.");
        return;
      }

      selesaikanWadah();
    } catch {
      setPesan("Belum tersimpan. Coba sekali lagi.");
    } finally {
      setMenyimpan(false);
    }
  }

  function selesaikanWadah() {
    setTersimpan((n) => n + 1);
    setEstimasi(null);
    setMengoreksiId(null);
    setPorsiAcuanKoreksi(null);
    setPerluKonfirmasi(false);
    setWadahId(null);
    setJenisId(null);
    setIsCampuran(false);
    setPersen(50);
    setPesan(null);
    setWadahTakTerdaftar(false);
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-5 p-4">
      <header>
        <h1 className="text-badan font-semibold text-netral-900">Potret sisa</h1>
        <p className="text-konteks text-netral-600">
          Dimasak {porsiDimasak} porsi
          {tersimpan > 0 && ` · ${String(tersimpan)} wadah tercatat`}
        </p>
      </header>

      {/* Ketukan 1 */}
      <section>
        <h2 className="text-konteks mb-2 text-netral-600">Wadah apa?</h2>
        <DaftarWadah wadah={wadah} terpilih={wadahId} onPilih={setWadahId} />
      </section>

      {/* Ketukan 2 */}
      <section>
        <h2 className="text-konteks mb-2 text-netral-600">Isinya apa?</h2>
        <DaftarJenisMasakan
          jenis={jenisMasakan}
          terpilih={jenisId}
          onPilih={setJenisId}
        />
      </section>

      <label className="text-badan flex items-center gap-3 text-netral-800">
        <input
          type="checkbox"
          checked={isCampuran}
          onChange={(e) => {
            setIsCampuran(e.target.checked);
          }}
          className="h-6 w-6 accent-aksen-500"
        />
        Isinya tercampur beberapa jenis
      </label>

      {wadahTakTerdaftar ? (
        <PenolakanWadahTakTerdaftar
          kembaliKe={`/catat/${catatanId}`}
          onMasukkanManual={() => {
            // "Masukkan manual" tidak meninggalkan layar — slider sudah ada di
            // bawah. Beralih ke sana adalah satu ketukan, bukan navigasi.
            setWadahTakTerdaftar(false);
            setPesan(null);
          }}
        />
      ) : estimasi === null ? (
        <>
          {/* Ketukan 3 */}
          <BingkaiKamera
            onFoto={(b) => void kirimFoto(b)}
            aktif={siap}
            sedangMembaca={membaca}
          />

          {membaca && <PesanTransisi fase={fase} />}

          {pesan && (
            <p
              className="text-badan rounded-xl bg-perhatian-100 px-4 py-3 text-perhatian-700"
              role="status"
            >
              {pesan}
            </p>
          )}

          {/*
           * 9.16 — konfirmasi sekali untuk koreksi yang melonjak ekstrem.
           *
           * Pertanyaannya menyebut kedua angka supaya operator bisa melihat
           * sendiri selisihnya, dan nadanya bertanya — bukan menuduh salah.
           */}
          {perluKonfirmasi && porsiAcuanKoreksi !== null && (
            <div className="rounded-xl bg-perhatian-100 px-4 py-3" role="alert">
              <p className="text-badan text-perhatian-700">
                Bacaan tadi {porsiAcuanKoreksi} porsi, sekarang {porsiDariSlider() ?? "-"}{" "}
                porsi. Selisihnya jauh — sudah pas?
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    kirimGeseran();
                  }}
                  disabled={menyimpan}
                  className="text-badan h-11 flex-1 rounded-lg bg-aksen-500 font-medium text-white disabled:opacity-40"
                >
                  Ya, simpan
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPerluKonfirmasi(false);
                  }}
                  className="text-badan h-11 flex-1 rounded-lg border border-netral-300 font-medium text-netral-700"
                >
                  Geser lagi
                </button>
              </div>
            </div>
          )}

          {/*
           * SLIDER SELALU DI SINI. Dirender bersama kamera, bukan sesudahnya,
           * bukan menggantikannya. Inilah bentuk konkret P4.
           */}
          <SliderFraksi
            persen={persen}
            onUbah={setPersen}
            porsiPenuh={porsiPenuh}
            aktif={sliderAktif}
            onSimpan={kirimGeseran}
            menyimpan={menyimpan}
          />
        </>
      ) : (
        /* Ketukan 4 */
        <KartuEstimasi
          porsiEstimasi={estimasi.porsiEstimasi}
          rentangBawah={estimasi.rentangBawah}
          rentangAtas={estimasi.rentangAtas}
          sumberKalibrasi={estimasi.sumberKalibrasi}
          konstantaPerkiraan={estimasi.konstantaPerkiraan}
          wajibManual={estimasi.wajibManual}
          keyakinanRendah={estimasi.keyakinanRendah}
          menyimpan={menyimpan}
          onBenar={selesaikanWadah}
          onKoreksi={() => {
            /*
             * "Koreksi" mengembalikan ke slider dengan angka pembacaan sebagai
             * titik awal — operator menggeser dari angka yang sudah dekat,
             * bukan dari nol.
             *
             * Id-nya DIPEGANG (9.16): geseran berikutnya menjadi baris koreksi
             * atas estimasi ini, bukan estimasi kedua. Itu yang membuat jejak
             * audit dan pembelajaran konstanta kalibrasi tetap terbentuk.
             */
            setMengoreksiId(estimasi.id);
            setPorsiAcuanKoreksi(estimasi.porsiEstimasi);
            setEstimasi(null);
            setPesan(null);
          }}
        />
      )}

      {/* Ketukan 5 */}
      <div className="mt-auto grid grid-cols-2 gap-3 pt-2">
        <button
          type="button"
          onClick={selesaikanWadah}
          disabled={estimasi === null && tersimpan === 0}
          className="text-badan h-14 rounded-xl border-2 border-netral-300 font-medium text-netral-800 disabled:opacity-40"
        >
          Tambah wadah
        </button>
        <button
          type="button"
          onClick={() => {
            router.push(`/catat/${catatanId}/penyaluran`);
          }}
          disabled={tersimpan === 0}
          className="text-badan h-14 rounded-xl bg-aksen-500 font-semibold text-white active:bg-aksen-600 disabled:opacity-40"
        >
          Selesai
        </button>
      </div>
    </main>
  );
}
