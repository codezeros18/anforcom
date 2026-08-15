"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { IndikatorLangkah } from "@/components/IndikatorLangkah";
import { PapanTombolNumerik } from "@/components/PapanTombolNumerik";

/*
 * LAYAR 9 — pendaftaran wadah, lima langkah (tugas 6.2).
 *
 * Alur ini yang membuat produk bisa dipasang di dapur kedua tanpa penyesuaian
 * kode. Target 1,5 menit per wadah, 5 wadah di bawah 10 menit — angka itu
 * adalah ambang kesabaran seseorang yang belum yakin produk ini berguna.
 *
 *   1. Foto wadah kosong                       ~20 dtk
 *   2. Nama wadah                              ~10 dtk
 *   3. Bentuk (pilih ikon)                     ~5 dtk
 *   4. "Kalau penuh berisi X, berapa porsi?"   ~15 dtk
 *   5. Ulangi untuk jenis lain (maks 3)        ~45 dtk
 *
 * TIDAK ADA LANGKAH KEENAM. Yang paling sering diusulkan dan harus ditolak:
 * meminta dimensi wadah. Operator tidak tahu diameter pancinya dan tidak akan
 * mengukurnya; pertanyaan itu akan menghentikan pendaftaran di wadah pertama.
 * Yang dia tahu betul justru yang kita butuhkan — berapa porsi yang muat.
 *
 * FOTO OPSIONAL, DAN ITU DISENGAJA. Ia langkah pertama karena paling alami
 * dilakukan sambil memegang wadahnya, tapi memaksanya akan menggantung
 * pendaftaran di dapur yang kameranya bermasalah. Wadah tanpa foto tetap
 * berfungsi penuh — ikon bentuknya yang dipakai di kartu pemilihan.
 */

const KUNCI_DRAF = "sisa.draf-pendaftaran-wadah";
const TOTAL_LANGKAH = 5;
const MAKS_JENIS = 3;

const BENTUK = [
  { nilai: "panci", label: "Panci", ikon: "🍲" },
  { nilai: "nampan", label: "Nampan", ikon: "🍱" },
  { nilai: "baskom", label: "Baskom", ikon: "🥣" },
  { nilai: "ompreng", label: "Ompreng", ikon: "🍛" },
  { nilai: "box", label: "Box", ikon: "📦" },
  { nilai: "lainnya", label: "Lainnya", ikon: "🥄" },
] as const;

const KATEGORI = [
  { nilai: "padat_menggunung", label: "Nasi / bisa menggunung" },
  { nilai: "padat_rata", label: "Lauk / permukaan rata" },
  { nilai: "berkuah", label: "Berkuah" },
] as const;

/*
 * Pembacaan draf sebagai state eksternal.
 *
 * Fungsi-fungsi ini didefinisikan di luar komponen supaya identitasnya stabil
 * antar render — `useSyncExternalStore` akan berlangganan ulang setiap render
 * kalau tidak.
 */
function langgananDraf(): () => void {
  // Tidak ada yang perlu didengarkan: draf hanya berubah lewat layar ini
  // sendiri, dan perubahan itu sudah tercermin lewat state lokal.
  return () => {
    /* tidak berlangganan apa pun */
  };
}

function bacaDrafKlien(): string | null {
  try {
    return window.localStorage.getItem(KUNCI_DRAF);
  } catch {
    return null;
  }
}

function bacaDrafServer(): string | null {
  return null;
}

function uraikanDraf(mentah: string | null): Draf | null {
  if (mentah === null) return null;
  try {
    return JSON.parse(mentah) as Draf;
  } catch {
    // Draf rusak. Mulai dari awal — kehilangan draf jauh lebih ringan daripada
    // layar yang tidak mau terbuka.
    return null;
  }
}

export interface JenisMasakanTersedia {
  id: string;
  nama: string;
  kategoriFisik: string;
}

export interface LayarPendaftaranWadahProps {
  jenisTersedia: readonly JenisMasakanTersedia[];
  /** Ke mana kembali setelah selesai — biasanya layar pencatatan yang menolak tadi. */
  kembaliKe: string;
}

interface Draf {
  langkah: number;
  nama: string;
  bentuk: string;
  fotoNama: string | null;
  wadahId: string | null;
  terisi: { jenisMasakanId: string; nama: string; porsiPenuh: string }[];
}

const DRAF_KOSONG: Draf = {
  langkah: 1,
  nama: "",
  bentuk: "panci",
  fotoNama: null,
  wadahId: null,
  terisi: [],
};

export function LayarPendaftaranWadah({
  jenisTersedia,
  kembaliKe,
}: LayarPendaftaranWadahProps) {
  const router = useRouter();

  const [pesan, setPesan] = useState<string | null>(null);
  const [menyimpan, setMenyimpan] = useState(false);

  // Langkah 4/5
  const [namaJenis, setNamaJenis] = useState("");
  const [kategori, setKategori] = useState<string>("padat_menggunung");
  const [porsi, setPorsi] = useState("");

  /*
   * 6.3 — "bisa ditunda dan dilanjutkan tanpa kehilangan isian".
   *
   * Draf disimpan di peramban, bukan di server. Operator yang dipanggil ke
   * dapur di tengah pendaftaran menutup HP-nya begitu saja — tidak ada tombol
   * "simpan draf" yang akan dia tekan lebih dulu. Penyimpanan harus terjadi
   * tanpa dia melakukan apa pun.
   *
   * Draf tersimpan dibaca lewat `useSyncExternalStore`, BUKAN lewat `useEffect`
   * yang memanggil `setState`. Dua alasan:
   * - `localStorage` adalah state eksternal, dan inilah API React untuk
   *   membacanya. Effect yang memanggil setState memicu render berantai.
   * - Ia aman terhadap hidrasi: potret server mengembalikan `null` dan potret
   *   klien mengembalikan isi draf, tanpa ketidakcocokan hidrasi.
   *
   * Hasilnya tidak ada effect sama sekali di berkas ini.
   */
  const drafMentah = useSyncExternalStore(langgananDraf, bacaDrafKlien, bacaDrafServer);
  const drafTersimpan = uraikanDraf(drafMentah);

  const [drafLokal, setDrafLokal] = useState<Draf | null>(null);
  const draf = drafLokal ?? drafTersimpan ?? DRAF_KOSONG;

  function setDraf(ubah: (sebelumnya: Draf) => Draf) {
    const berikutnya = ubah(draf);
    setDrafLokal(berikutnya);
    try {
      window.localStorage.setItem(KUNCI_DRAF, JSON.stringify(berikutnya));
    } catch {
      // Penyimpanan penuh atau ditolak. Pendaftaran tetap jalan; yang hilang
      // hanya kemampuan melanjutkannya nanti.
    }
  }

  function bersihkanDraf() {
    try {
      window.localStorage.removeItem(KUNCI_DRAF);
    } catch {
      /* tidak apa-apa */
    }
  }

  async function simpanWadah() {
    if (draf.nama.trim() === "") {
      setPesan("Nama wadahnya belum diisi.");
      return;
    }

    setMenyimpan(true);
    setPesan(null);
    try {
      const jawaban = await fetch("/api/wadah", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nama: draf.nama.trim(), bentuk: draf.bentuk }),
      });
      const badan: unknown = await jawaban.json();

      if (!jawaban.ok) {
        setPesan(
          (badan as { pesan?: string }).pesan ?? "Belum tersimpan. Coba sekali lagi.",
        );
        return;
      }

      const isi = badan as { wadah: { id: string } };
      setDraf((d) => ({ ...d, wadahId: isi.wadah.id, langkah: 4 }));
    } catch {
      setPesan("Belum tersimpan. Coba sekali lagi.");
    } finally {
      setMenyimpan(false);
    }
  }

  async function simpanKalibrasi() {
    if (!draf.wadahId) return;

    const nama = namaJenis.trim();
    if (nama === "") {
      setPesan("Jenis masakannya belum diisi.");
      return;
    }
    if (porsi === "" || Number(porsi) <= 0) {
      setPesan("Angkanya belum diisi.");
      return;
    }

    setMenyimpan(true);
    setPesan(null);
    try {
      // Jenis masakan dibuat di dalam langkah 4, bukan sebagai langkah sendiri.
      const jawabanJenis = await fetch("/api/jenis-masakan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nama, kategoriFisik: kategori }),
      });
      const badanJenis: unknown = await jawabanJenis.json();
      if (!jawabanJenis.ok) {
        setPesan(
          (badanJenis as { pesan?: string }).pesan ??
            "Belum tersimpan. Coba sekali lagi.",
        );
        return;
      }
      const jenisId = (badanJenis as { jenisMasakan: { id: string } }).jenisMasakan.id;

      const jawaban = await fetch("/api/kalibrasi", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          wadahId: draf.wadahId,
          jenisMasakanId: jenisId,
          porsiPenuh: porsi,
        }),
      });
      const badan: unknown = await jawaban.json();
      if (!jawaban.ok) {
        setPesan(
          (badan as { pesan?: string }).pesan ?? "Belum tersimpan. Coba sekali lagi.",
        );
        return;
      }

      setDraf((d) => ({
        ...d,
        langkah: 5,
        terisi: [...d.terisi, { jenisMasakanId: jenisId, nama, porsiPenuh: porsi }],
      }));
      setNamaJenis("");
      setPorsi("");
    } catch {
      setPesan("Belum tersimpan. Coba sekali lagi.");
    } finally {
      setMenyimpan(false);
    }
  }

  function selesai() {
    bersihkanDraf();
    router.push(kembaliKe);
  }

  const judul: Record<number, string> = {
    1: "Foto wadahnya saat kosong",
    2: "Namanya apa?",
    3: "Bentuknya seperti apa?",
    4: "Kalau penuh, berapa porsi?",
    5: "Jenis lain di wadah ini?",
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-5 p-4">
      <IndikatorLangkah
        langkah={draf.langkah}
        total={TOTAL_LANGKAH}
        judul={judul[draf.langkah] ?? ""}
      />

      {/* LANGKAH 1 — foto, opsional */}
      {draf.langkah === 1 && (
        <>
          <div className="flex aspect-square items-center justify-center rounded-2xl border-2 border-dashed border-netral-300 bg-netral-100">
            <p className="text-konteks max-w-[16rem] px-6 text-center text-netral-600">
              {draf.fotoNama
                ? `Foto diambil: ${draf.fotoNama}`
                : "Potret wadahnya dalam keadaan kosong, dari atas."}
            </p>
          </div>

          <label className="text-badan flex h-14 items-center justify-center rounded-xl bg-netral-900 font-semibold text-white">
            Potret wadah
            <input
              type="file"
              accept="image/jpeg,image/png"
              capture="environment"
              className="sr-only"
              onChange={(e) => {
                const berkas = e.target.files?.[0];
                if (berkas) setDraf((d) => ({ ...d, fotoNama: berkas.name, langkah: 2 }));
              }}
            />
          </label>

          {/* Foto boleh dilewati — lihat catatan di kepala berkas. */}
          <button
            type="button"
            onClick={() => {
              setDraf((d) => ({ ...d, langkah: 2 }));
            }}
            className="text-badan h-12 rounded-xl text-netral-600 underline"
          >
            Lewati foto
          </button>
        </>
      )}

      {/* LANGKAH 2 — nama */}
      {draf.langkah === 2 && (
        <>
          <input
            type="text"
            value={draf.nama}
            autoFocus
            placeholder="panci besar"
            onChange={(e) => {
              setDraf((d) => ({ ...d, nama: e.target.value }));
            }}
            className="text-sekunder h-20 w-full rounded-xl border-2 border-netral-300 bg-netral-50 px-4 text-netral-900"
          />
          <p className="text-konteks text-netral-600">
            Nama bebas — pakai sebutan yang biasa dipakai di dapur ini.
          </p>
          <button
            type="button"
            disabled={draf.nama.trim() === ""}
            onClick={() => {
              setDraf((d) => ({ ...d, langkah: 3 }));
            }}
            className="text-badan mt-auto h-16 rounded-xl bg-aksen-500 font-semibold text-white disabled:opacity-40"
          >
            Lanjut
          </button>
        </>
      )}

      {/* LANGKAH 3 — bentuk */}
      {draf.langkah === 3 && (
        <>
          <div
            className="grid grid-cols-3 gap-3"
            role="radiogroup"
            aria-label="Bentuk wadah"
          >
            {BENTUK.map((b) => (
              <button
                key={b.nilai}
                type="button"
                role="radio"
                aria-checked={draf.bentuk === b.nilai}
                onClick={() => {
                  setDraf((d) => ({ ...d, bentuk: b.nilai }));
                }}
                className={`flex min-h-24 flex-col items-center justify-center gap-1 rounded-2xl border-2 ${
                  draf.bentuk === b.nilai
                    ? "border-aksen-500 bg-aksen-500/10"
                    : "border-netral-200 bg-netral-50"
                }`}
              >
                <span className="text-sekunder" aria-hidden>
                  {b.ikon}
                </span>
                <span className="text-konteks text-netral-800">{b.label}</span>
              </button>
            ))}
          </div>

          {pesan && (
            <p
              className="text-badan rounded-xl bg-perhatian-100 px-4 py-3 text-perhatian-700"
              role="alert"
            >
              {pesan}
            </p>
          )}

          <button
            type="button"
            disabled={menyimpan}
            onClick={() => void simpanWadah()}
            className="text-badan mt-auto h-16 rounded-xl bg-aksen-500 font-semibold text-white disabled:opacity-40"
          >
            {menyimpan ? "Menyimpan…" : "Lanjut"}
          </button>
        </>
      )}

      {/* LANGKAH 4 dan 5 — pertanyaan konstanta */}
      {(draf.langkah === 4 || draf.langkah === 5) && (
        <>
          {draf.terisi.length > 0 && (
            <ul className="text-konteks rounded-xl bg-netral-100 p-3 text-netral-700">
              {draf.terisi.map((t) => (
                <li key={t.jenisMasakanId}>
                  {t.nama}: {t.porsiPenuh} porsi
                </li>
              ))}
            </ul>
          )}

          {draf.terisi.length >= MAKS_JENIS ? (
            <p className="text-badan text-netral-700">
              Sudah tiga jenis — cukup untuk memulai. Sisanya bisa ditambah kapan saja.
            </p>
          ) : (
            <>
              <input
                type="text"
                value={namaJenis}
                list="jenis-tersedia"
                placeholder="nasi putih"
                onChange={(e) => {
                  setNamaJenis(e.target.value);
                  const cocok = jenisTersedia.find((j) => j.nama === e.target.value);
                  if (cocok) setKategori(cocok.kategoriFisik);
                }}
                className="text-badan h-14 w-full rounded-xl border-2 border-netral-300 bg-netral-50 px-4 text-netral-900"
              />
              <datalist id="jenis-tersedia">
                {jenisTersedia.map((j) => (
                  <option key={j.id} value={j.nama} />
                ))}
              </datalist>

              <div className="flex flex-wrap gap-2">
                {KATEGORI.map((k) => (
                  <button
                    key={k.nilai}
                    type="button"
                    onClick={() => {
                      setKategori(k.nilai);
                    }}
                    className={`text-konteks min-h-11 rounded-full border-2 px-3 ${
                      kategori === k.nilai
                        ? "border-aksen-500 bg-aksen-500 text-white"
                        : "border-netral-300 text-netral-700"
                    }`}
                  >
                    {k.label}
                  </button>
                ))}
              </div>

              {/*
               * Pertanyaannya persis seperti di BLUEPRINT, dan bentuknya
               * penting: ia menanyakan sesuatu yang operator TAHU, bukan
               * sesuatu yang harus dia ukur.
               */}
              <p className="text-badan text-netral-800">
                Kalau {draf.nama || "wadah ini"} penuh berisi{" "}
                <strong>{namaJenis || "masakan itu"}</strong>, kira-kira berapa porsi?
              </p>

              <output
                className="text-pahlawan block tabular-nums text-netral-900"
                aria-live="polite"
              >
                {porsi === "" ? "0" : porsi}
              </output>

              <PapanTombolNumerik nilai={porsi} onUbah={setPorsi} />
            </>
          )}

          {pesan && (
            <p
              className="text-badan rounded-xl bg-perhatian-100 px-4 py-3 text-perhatian-700"
              role="alert"
            >
              {pesan}
            </p>
          )}

          <div className="mt-auto grid gap-3 pt-2">
            {draf.terisi.length < MAKS_JENIS && (
              <button
                type="button"
                disabled={menyimpan}
                onClick={() => void simpanKalibrasi()}
                className="text-badan h-16 rounded-xl bg-aksen-500 font-semibold text-white disabled:opacity-40"
              >
                {menyimpan ? "Menyimpan…" : "Simpan jenis ini"}
              </button>
            )}

            {draf.terisi.length > 0 && (
              <button
                type="button"
                onClick={selesai}
                className="text-badan h-14 rounded-xl border-2 border-netral-300 font-medium text-netral-800"
              >
                Selesai — wadah ini sudah bisa dipakai
              </button>
            )}
          </div>
        </>
      )}

      <Link
        href={kembaliKe}
        onClick={bersihkanDraf}
        className="text-konteks text-center text-netral-500 underline"
      >
        Nanti saja
      </Link>
    </main>
  );
}
