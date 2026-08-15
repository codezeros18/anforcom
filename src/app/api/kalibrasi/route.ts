import { db } from "@/lib/db";
import { buatKalibrasiAwal, jelaskanSumber } from "@/core/kalibrasi";
import { porsiDariString, porsiKeString } from "@/core/porsi";
import { galat, KODE_GALAT, sukses, tangani } from "../_lib/respons";
import { pesanDariZod, skemaKalibrasiBaru } from "../_lib/skema";

/*
 * 6.1 — POST /api/kalibrasi dan GET /api/kalibrasi?wadahId=
 *
 * INI TITIK COLD START. Baris yang dibuat di sini adalah satu-satunya alasan
 * sistem bisa berguna pada HARI PERTAMA, sebelum ada satu pun koreksi.
 *
 * Angkanya datang dari jawaban operator atas satu pertanyaan: "kalau wadah ini
 * penuh berisi nasi, kira-kira berapa porsi?" — pengetahuan dapur itu sendiri,
 * bukan asumsi kita. Karena itu ia ditandai `sumber='deklarasi'`, dan selama
 * penandaan itu berlaku rentang keyakinannya dilebarkan 1,5× dan badge di layar
 * mengatakan angkanya belum teruji.
 *
 * `buatKalibrasiAwal` di /core yang menyusun barisnya, termasuk memvalidasi
 * bahwa angkanya lebih dari nol. Route handler hanya menyisipkan.
 */

export async function POST(permintaan: Request) {
  return tangani(async () => {
    const badan: unknown = await permintaan.json().catch(() => null);
    const hasil = skemaKalibrasiBaru.safeParse(badan);
    if (!hasil.success) {
      return galat(KODE_GALAT.VALIDASI_GAGAL, 422, pesanDariZod(hasil.error));
    }

    const [wadah, jenis] = await Promise.all([
      db.wadah.findUnique({ where: { id: hasil.data.wadahId } }),
      db.jenisMasakan.findUnique({ where: { id: hasil.data.jenisMasakanId } }),
    ]);

    if (!wadah || !jenis) return galat(KODE_GALAT.WADAH_TIDAK_TERDAFTAR, 422);
    if (wadah.dapurId !== jenis.dapurId) {
      // Wadah dan jenis masakan dari dapur berbeda. Mustahil lewat UI, tapi
      // mungkin lewat panggilan langsung — dan kalibrasi silang dapur akan
      // merusak konstanta kedua dapur sekaligus.
      return galat(KODE_GALAT.WADAH_TIDAK_TERDAFTAR, 422);
    }

    const awal = buatKalibrasiAwal(
      hasil.data.wadahId,
      hasil.data.jenisMasakanId,
      porsiDariString(hasil.data.porsiPenuh),
    );

    /*
     * Mendaftarkan ulang pasangan yang sama MEMPERBARUI deklarasinya, tidak
     * membuat baris kedua — unique constraint (wadah_id, jenis_masakan_id) yang
     * memaksanya, dan itu memang benar: satu pasangan punya satu konstanta.
     *
     * Tapi hanya kalau masih `deklarasi`. Konstanta yang sudah terkalibrasi dari
     * riwayat koreksi tidak boleh ditimpa oleh tebakan baru — itu akan membuang
     * pembelajaran berminggu-minggu dalam satu ketukan.
     */
    const adaDuluan = await db.kalibrasi.findUnique({
      where: {
        wadahId_jenisMasakanId: {
          wadahId: hasil.data.wadahId,
          jenisMasakanId: hasil.data.jenisMasakanId,
        },
      },
    });

    if (adaDuluan && adaDuluan.sumber === "terkalibrasi") {
      return galat(
        KODE_GALAT.VALIDASI_GAGAL,
        409,
        "Wadah ini sudah terkalibrasi dari koreksi sehari-hari. Angkanya tidak perlu diisi ulang.",
      );
    }

    const tersimpan = await db.kalibrasi.upsert({
      where: {
        wadahId_jenisMasakanId: {
          wadahId: hasil.data.wadahId,
          jenisMasakanId: hasil.data.jenisMasakanId,
        },
      },
      create: {
        wadahId: awal.wadahId,
        jenisMasakanId: awal.jenisMasakanId,
        porsiPenuh: porsiKeString(awal.porsiPenuh),
        sumber: awal.sumber,
        jumlahKoreksi: awal.jumlahKoreksi,
      },
      update: {
        porsiPenuh: porsiKeString(awal.porsiPenuh),
        diperbaruiPada: new Date(),
      },
    });

    return sukses(
      {
        kalibrasi: {
          id: tersimpan.id,
          wadahId: tersimpan.wadahId,
          jenisMasakanId: tersimpan.jenisMasakanId,
          porsiPenuh: tersimpan.porsiPenuh.toString(),
          sumber: tersimpan.sumber,
          jumlahKoreksi: tersimpan.jumlahKoreksi,
          keterangan: jelaskanSumber(tersimpan.sumber, tersimpan.jumlahKoreksi),
        },
      },
      201,
    );
  });
}

/**
 * Daftar kalibrasi satu wadah.
 *
 * Dipakai layar pendaftaran untuk menampilkan jenis masakan mana yang sudah
 * diisi — supaya pendaftaran yang ditunda bisa dilanjutkan tanpa operator harus
 * mengingat sampai mana dia tadi.
 */
export async function GET(permintaan: Request) {
  return tangani(async () => {
    const wadahId = new URL(permintaan.url).searchParams.get("wadahId");
    if (!wadahId) {
      return galat(KODE_GALAT.VALIDASI_GAGAL, 422, "Wadahnya belum dipilih.");
    }

    const daftar = await db.kalibrasi.findMany({
      where: { wadahId },
      include: {
        jenisMasakan: { select: { id: true, nama: true, kategoriFisik: true } },
      },
      orderBy: { diperbaruiPada: "asc" },
    });

    return sukses({
      kalibrasi: daftar.map((k) => ({
        id: k.id,
        jenisMasakanId: k.jenisMasakanId,
        namaJenisMasakan: k.jenisMasakan.nama,
        kategoriFisik: k.jenisMasakan.kategoriFisik,
        porsiPenuh: k.porsiPenuh.toString(),
        sumber: k.sumber,
        jumlahKoreksi: k.jumlahKoreksi,
        keterangan: jelaskanSumber(k.sumber, k.jumlahKoreksi),
      })),
    });
  });
}
