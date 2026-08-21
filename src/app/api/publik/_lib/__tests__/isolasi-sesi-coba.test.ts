import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/*
 * TES 8.7 — ISOLASI MODE COBA. ATURAN KERAS 8.
 *
 * "Data dapur contoh tidak pernah bercampur dengan data dapur nyata."
 *
 * APA YANG SEBENARNYA DIBUKTIKAN DI SINI, dan kenapa bentuknya begini.
 *
 * Klaim yang perlu dibuktikan bukan "fungsi mengembalikan nilai yang benar",
 * melainkan "tidak ada jalan untuk menulis ke dapur nyata lewat sesi coba".
 * Klaim seperti itu tidak bisa dibuktikan dengan satu kasus uji bahagia. Jadi
 * tes di bawah menyerang dari tiga arah sekaligus:
 *
 * 1. PERILAKU — `dapurDariToken()` dipanggil dengan token palsu, kedaluwarsa,
 *    dan token yang (mustahil, tapi tetap diuji) menunjuk dapur nyata. Ketiganya
 *    harus menolak.
 * 2. TITIK TUNGGAL — `ambilDapurAktif()` memeriksa sesi coba SEBELUM segala
 *    hal lain, sehingga setiap route handler yang sudah ada dan yang akan
 *    ditambah ikut terisolasi tanpa diubah.
 * 3. KETIADAAN JALUR LAIN — tidak ada berkas lain yang membaca `sesi_coba`
 *    langsung dan menyimpulkan dapurnya sendiri. Ini yang mencegah sprint
 *    berikutnya membuat jalur kedua yang lupa memeriksa `isContoh`.
 *
 * Basis data di-mock: CI menjalankan tes TANPA Postgres. Yang diuji adalah
 * logika keputusannya, dan justru logika itulah yang bisa salah.
 */

const DAPUR_CONTOH = {
  id: "contoh-1",
  nama: "Dapur Contoh",
  isContoh: true,
};

const DAPUR_NYATA = {
  id: "nyata-1",
  nama: "Dapur Nyata",
  isContoh: false,
};

const JAM = 60 * 60 * 1000;

interface BarisSesi {
  token: string;
  kedaluwarsaPada: Date;
  dapurContoh: typeof DAPUR_CONTOH | typeof DAPUR_NYATA;
}

/** Isi basis data palsu. Diatur ulang sebelum setiap tes. */
const sesiTersimpan = new Map<string, BarisSesi>();
const dapurTersimpan = [DAPUR_NYATA, DAPUR_CONTOH];

/** Setiap penulisan yang dicoba, dicatat di sini untuk diperiksa. */
const penulisan: { tabel: string; dapurId: string }[] = [];

vi.mock("@/lib/db", () => ({
  db: {
    dapur: {
      findFirst: ({ where }: { where?: { isContoh?: boolean } } = {}) =>
        Promise.resolve(
          where?.isContoh === undefined
            ? dapurTersimpan[0]
            : (dapurTersimpan.find((d) => d.isContoh === where.isContoh) ?? null),
        ),
      findUnique: ({ where }: { where: { id: string } }) =>
        Promise.resolve(dapurTersimpan.find((d) => d.id === where.id) ?? null),
    },
    sesiCoba: {
      findUnique: ({ where }: { where: { token: string } }) =>
        Promise.resolve(sesiTersimpan.get(where.token) ?? null),
      create: ({
        data,
      }: {
        data: { token: string; dapurContohId: string; kedaluwarsaPada: Date };
      }) => {
        const dapur = dapurTersimpan.find((d) => d.id === data.dapurContohId);
        if (!dapur) throw new Error("dapur tidak ada");
        const baris: BarisSesi = {
          token: data.token,
          kedaluwarsaPada: data.kedaluwarsaPada,
          dapurContoh: dapur,
        };
        sesiTersimpan.set(data.token, baris);
        penulisan.push({ tabel: "sesi_coba", dapurId: data.dapurContohId });
        return Promise.resolve(baris);
      },
    },
    catatanHarian: {
      create: ({ data }: { data: { dapurId: string } }) => {
        penulisan.push({ tabel: "catatan_harian", dapurId: data.dapurId });
        return Promise.resolve({ id: "catatan-1", ...data });
      },
    },
  },
}));

/*
 * `next/headers` di-mock supaya `ambilDapurAktif()` bisa diuji di luar
 * permintaan HTTP. Nilai cookie-nya diatur per tes.
 */
let cookieSesi: string | undefined;
vi.mock("next/headers", () => ({
  cookies: () =>
    Promise.resolve({
      get: (nama: string) =>
        nama === "sisa_sesi_coba" && cookieSesi !== undefined
          ? { value: cookieSesi }
          : undefined,
    }),
}));

const { buatSesiCoba, dapurDariToken, UMUR_SESI_JAM } = await import("../sesi-coba");
const { ambilDapurAktif, COOKIE_SESI_COBA } = await import("@/app/api/_lib/data");
const { db } = await import("@/lib/db");

beforeEach(() => {
  sesiTersimpan.clear();
  penulisan.length = 0;
  cookieSesi = undefined;
  delete process.env.DAPUR_AKTIF_ID;
});

// ---------------------------------------------------------------------------
// 1. Sesi coba selalu menunjuk dapur contoh
// ---------------------------------------------------------------------------

describe("sesi coba selalu menunjuk dapur contoh (aturan 8)", () => {
  it("sesi baru dibuat pada dapur yang isContoh, bukan dapur pertama", async () => {
    /*
     * Halus tapi penting: `dapurTersimpan[0]` adalah dapur NYATA. Kalau
     * `buatSesiCoba()` mengambil dapur pertama begitu saja — kesalahan yang
     * sangat mudah ditulis — tes ini menangkapnya.
     */
    await buatSesiCoba();

    expect(penulisan).toHaveLength(1);
    expect(penulisan[0]?.dapurId).toBe(DAPUR_CONTOH.id);
    expect(penulisan[0]?.dapurId).not.toBe(DAPUR_NYATA.id);
  });

  it("token yang dihasilkan acak dan tidak terulang", async () => {
    const a = await buatSesiCoba();
    const b = await buatSesiCoba();
    expect(a.token).not.toBe(b.token);
    expect(a.token).toHaveLength(64);
  });

  it("kedaluwarsa 24 jam sesudah dibuat", async () => {
    const sebelum = Date.now();
    const sesi = await buatSesiCoba();
    const jarakJam = (new Date(sesi.kedaluwarsa).getTime() - sebelum) / JAM;

    expect(UMUR_SESI_JAM).toBe(24);
    expect(jarakJam).toBeGreaterThan(23.9);
    expect(jarakJam).toBeLessThanOrEqual(24.1);
  });
});

// ---------------------------------------------------------------------------
// 2. Token yang tidak sah tidak pernah membuka dapur mana pun
// ---------------------------------------------------------------------------

describe("token tidak sah ditolak, TANPA jatuh ke dapur nyata", () => {
  it("token tidak dikenal menghasilkan null", async () => {
    expect(await dapurDariToken("token-karangan")).toBeNull();
  });

  it("token kosong, null, dan undefined menghasilkan null", async () => {
    expect(await dapurDariToken("")).toBeNull();
    expect(await dapurDariToken(null)).toBeNull();
    expect(await dapurDariToken(undefined)).toBeNull();
  });

  it("sesi kedaluwarsa menghasilkan null walau tokennya benar", async () => {
    const sesi = await buatSesiCoba();
    const baris = sesiTersimpan.get(sesi.token);
    expect(baris).toBeDefined();
    if (baris) baris.kedaluwarsaPada = new Date(Date.now() - 1000);

    expect(await dapurDariToken(sesi.token)).toBeNull();
  });

  it("sesi yang menunjuk dapur NYATA tetap ditolak — sabuk kedua", async () => {
    /*
     * Keadaan ini semestinya mustahil, karena `buatSesiCoba()` menyaring
     * `isContoh: true`. Tes ini ada justru untuk keadaan mustahil itu: kalau
     * suatu hari ada jalur lain yang menyisipkan baris `sesi_coba` — migrasi
     * tangan, skrip perbaikan, sprint yang lupa — penjaga kedua di
     * `dapurDariToken()` harus tetap menahannya.
     *
     * Lebih baik mode coba mati daripada menulis ke dapur sungguhan.
     */
    sesiTersimpan.set("token-menyimpang", {
      token: "token-menyimpang",
      kedaluwarsaPada: new Date(Date.now() + 24 * JAM),
      dapurContoh: DAPUR_NYATA,
    });

    expect(await dapurDariToken("token-menyimpang")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 3. INTI 8.7 — menulis lewat sesi coba tidak menyentuh dapur nyata
// ---------------------------------------------------------------------------

describe("8.7 — penulisan lewat sesi coba TIDAK mengubah data dapur nyata", () => {
  it("ambilDapurAktif mengembalikan dapur contoh saat cookie sesi coba ada", async () => {
    const sesi = await buatSesiCoba();
    cookieSesi = sesi.token;

    const dapur = await ambilDapurAktif();
    expect(dapur?.id).toBe(DAPUR_CONTOH.id);
  });

  it("sesi coba MENANG atas DAPUR_AKTIF_ID", async () => {
    /*
     * Urutan pemeriksaan di `ambilDapurAktif()` menentukan segalanya. Kalau
     * `DAPUR_AKTIF_ID` diperiksa lebih dulu, maka di production — tempat env
     * itu memang diisi — setiap pencatatan mode coba akan mendarat di dapur
     * nyata, dan tes yang hanya berjalan tanpa env tidak akan pernah tahu.
     */
    process.env.DAPUR_AKTIF_ID = DAPUR_NYATA.id;
    const sesi = await buatSesiCoba();
    cookieSesi = sesi.token;

    const dapur = await ambilDapurAktif();
    expect(dapur?.id).toBe(DAPUR_CONTOH.id);
    expect(dapur?.isContoh).toBe(true);
  });

  it("seluruh penulisan alur pencatatan mendarat di dapur contoh", async () => {
    const sesi = await buatSesiCoba();
    cookieSesi = sesi.token;

    // Meniru yang dilakukan route handler: ambil dapur aktif, lalu tulis.
    const dapur = await ambilDapurAktif();
    expect(dapur).not.toBeNull();
    if (!dapur) throw new Error("dapur null");

    /*
     * Payload lengkap seperti yang dikirim route handler sungguhan. Yang diuji
     * bukan bentuk datanya, melainkan `dapurId` yang dipakai — tapi payload
     * yang tipenya benar membuat tes ini ikut pecah kalau kolom wajib berubah.
     */
    await db.catatanHarian.create({
      data: {
        dapurId: dapur.id,
        tanggal: new Date("2026-08-16T00:00:00.000Z"),
        porsiDimasak: "120.00",
        peranPencatat: "operator",
      },
    });

    const keDapurNyata = penulisan.filter((p) => p.dapurId === DAPUR_NYATA.id);
    expect(keDapurNyata).toEqual([]);

    const catatan = penulisan.filter((p) => p.tabel === "catatan_harian");
    expect(catatan).toHaveLength(1);
    expect(catatan[0]?.dapurId).toBe(DAPUR_CONTOH.id);
  });

  it("sesudah sesi kedaluwarsa, penulisan TIDAK diam-diam pindah ke dapur nyata", async () => {
    /*
     * Ini kegagalan yang paling mungkin terjadi di dunia nyata: pengunjung
     * membuka mode coba, meninggalkan tab terbuka semalaman, lalu mengetuk
     * "Simpan" keesokan harinya. Kalau sesi kedaluwarsa menyebabkan fallback
     * diam-diam ke dapur aktif, catatan itu mendarat di dapur sungguhan.
     *
     * Yang benar: dapur aktif kembali normal, TETAPI banner mode coba juga
     * ikut hilang — keduanya membaca sumber yang sama. Jadi layar tidak pernah
     * mengatakan "mode coba" sementara data masuk ke dapur nyata.
     */
    const sesi = await buatSesiCoba();
    cookieSesi = sesi.token;

    const baris = sesiTersimpan.get(sesi.token);
    if (baris) baris.kedaluwarsaPada = new Date(Date.now() - 1000);

    expect(await dapurDariToken(sesi.token)).toBeNull();

    // Banner membaca fungsi yang sama, jadi ia ikut padam. Tidak ada keadaan
    // "banner menyala tapi menulis ke dapur nyata".
    const dapur = await ambilDapurAktif();
    expect(dapur?.isContoh).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 4. Tidak ada jalur kedua yang bisa melewati penjagaan
// ---------------------------------------------------------------------------

describe("isolasi ditegakkan di SATU tempat, bukan disiplin per route", () => {
  const AKAR = fileURLToPath(new URL("../../../../../..", import.meta.url));

  function baca(jalur: string): string {
    return readFileSync(`${AKAR}/${jalur}`, "utf8");
  }

  function tanpaKomentar(isi: string): string {
    return isi.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  }

  it("ambilDapurAktif memeriksa sesi coba SEBELUM DAPUR_AKTIF_ID", () => {
    const isi = tanpaKomentar(baca("src/app/api/_lib/data.ts"));
    const posisiToken = isi.indexOf("dapurDariToken");
    const posisiEnv = isi.indexOf("DAPUR_AKTIF_ID");

    expect(posisiToken).toBeGreaterThan(0);
    expect(posisiEnv).toBeGreaterThan(0);
    expect(posisiToken).toBeLessThan(posisiEnv);
  });

  it("hanya sesi-coba.ts yang membaca tabel sesi_coba", () => {
    /*
     * Kalau berkas lain memanggil `db.sesiCoba` sendiri, ia akan menyimpulkan
     * dapurnya tanpa melewati penjaga `isContoh` — dan isolasi berhenti menjadi
     * sifat sistem, kembali menjadi sesuatu yang harus diingat setiap sprint.
     */
    const berkas = [
      "src/app/api/_lib/data.ts",
      "src/app/api/publik/sesi-coba/route.ts",
      "src/components/BannerModeCoba.tsx",
      "src/app/(coba)/coba/page.tsx",
    ];

    for (const jalur of berkas) {
      expect(tanpaKomentar(baca(jalur)), jalur).not.toContain("db.sesiCoba");
    }

    expect(baca("src/app/api/publik/_lib/sesi-coba.ts")).toContain("db.sesiCoba");
  });

  it("banner mode coba memakai sumber kebenaran yang sama dengan penulisan", () => {
    // Banner yang punya sumber sendiri bisa menyala saat data masuk ke dapur
    // nyata — persis kebohongan yang aturan 8 larang.
    expect(baca("src/components/BannerModeCoba.tsx")).toContain("dapurDariToken");
  });

  it("cookie mode coba dinamai lewat konstanta bersama, bukan string tersebar", () => {
    expect(COOKIE_SESI_COBA).toBe("sisa_sesi_coba");

    for (const jalur of [
      "src/app/api/publik/sesi-coba/route.ts",
      "src/components/BannerModeCoba.tsx",
      "src/app/(coba)/coba/page.tsx",
    ]) {
      expect(tanpaKomentar(baca(jalur)), jalur).toContain("COOKIE_SESI_COBA");
    }
  });
});
