import { describe, expect, it, vi } from "vitest";
import { buatManualProvider } from "../manual-provider.ts";
import { buatModelProvider } from "../model-provider.ts";
import { ambilPembacaFraksi, modelPenglihatanAktif } from "../index.ts";
import type { HasilBaca, KonteksPembacaan } from "../provider.ts";

/*
 * Foto JPEG minimal yang sah — cukup untuk melewati pengenalan format tanpa
 * membawa berkas biner ke dalam repo.
 */
const FOTO_JPEG = new Uint8Array([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46,
]);

const KONTEKS: KonteksPembacaan = { wadahId: "wadah-1", jenisMasakanId: "nasi" };

/** Client palsu yang menjawab seperti model, tanpa menyentuh jaringan. */
function clientPalsu(jawab: () => unknown, tunda = 0) {
  return {
    create: vi.fn(async (_params: unknown, opsi?: { signal?: AbortSignal }) => {
      if (tunda === 0) return jawab();

      return new Promise((selesai, gagal) => {
        const penghitung = setTimeout(() => {
          selesai(jawab());
        }, tunda);

        opsi?.signal?.addEventListener("abort", () => {
          clearTimeout(penghitung);
          const galat = new Error("Request was aborted.");
          galat.name = "APIUserAbortError";
          gagal(galat);
        });
      });
    }),
  } as never;
}

function jawabanBaik(fraksi = 0.45, keyakinan = 0.9) {
  return {
    stop_reason: "end_turn",
    content: [{ type: "text", text: JSON.stringify({ fraksi, keyakinan }) }],
  };
}

// ---------------------------------------------------------------------------
// 4.9 — kesetaraan bentuk
// ---------------------------------------------------------------------------

describe("manual-provider mengembalikan bentuk IDENTIK dengan model-provider (4.9)", () => {
  it("kunci hasil sukses persis sama", async () => {
    const model = buatModelProvider({ client: clientPalsu(() => jawabanBaik()) });
    const manual = buatManualProvider();

    const hasilModel = await model.baca(FOTO_JPEG, KONTEKS);
    const hasilManual = await manual.baca(null, { ...KONTEKS, fraksiManual: 0.45 });

    expect(Object.keys(hasilModel).sort()).toEqual(Object.keys(hasilManual).sort());
    expect(hasilModel.status).toBe("terbaca");
    expect(hasilManual.status).toBe("terbaca");
  });

  it("tipe setiap field sama", async () => {
    const model = buatModelProvider({ client: clientPalsu(() => jawabanBaik()) });
    const manual = buatManualProvider();

    const a = await model.baca(FOTO_JPEG, KONTEKS);
    const b = await manual.baca(null, { ...KONTEKS, fraksiManual: 0.45 });
    if (a.status !== "terbaca" || b.status !== "terbaca")
      throw new Error("harus terbaca");

    expect(typeof a.fraksi).toBe(typeof b.fraksi);
    expect(typeof a.keyakinan).toBe(typeof b.keyakinan);
    expect(typeof a.latensiMs).toBe(typeof b.latensiMs);
  });

  it("nilai fraksi yang sama menghasilkan hasil yang tidak bisa dibedakan", async () => {
    /*
     * Ini inti klaim arsitektur. Kalau pemanggil bisa membedakan hasil model
     * dari hasil slider, maka mencabut model BUKAN sekadar menukar objek — dan
     * klaimnya berhenti benar.
     */
    const model = buatModelProvider({ client: clientPalsu(() => jawabanBaik(0.6, 1)) });
    const manual = buatManualProvider();

    const a = await model.baca(FOTO_JPEG, KONTEKS);
    const b = await manual.baca(null, { ...KONTEKS, fraksiManual: 0.6 });
    if (a.status !== "terbaca" || b.status !== "terbaca")
      throw new Error("harus terbaca");

    expect({ ...a, latensiMs: 0 }).toEqual({ ...b, latensiMs: 0 });
  });

  it("keduanya memenuhi antarmuka yang sama", () => {
    for (const p of [buatModelProvider(), buatManualProvider()]) {
      expect(typeof p.baca).toBe("function");
      expect(["model", "manual"]).toContain(p.nama);
    }
  });
});

// ---------------------------------------------------------------------------
// 4.5 / 4.10 — timeout memicu fallback, bukan error
// ---------------------------------------------------------------------------

describe("timeout memicu jalur fallback, BUKAN error ke pengguna (4.5, 4.10)", () => {
  it("mengembalikan perlu_manual alih-alih melempar", async () => {
    const model = buatModelProvider({
      client: clientPalsu(() => jawabanBaik(), 5_000),
      timeoutMs: 30,
    });

    // Tidak dibungkus expect().rejects — justru itu yang diuji: ia TIDAK melempar.
    const hasil = await model.baca(FOTO_JPEG, KONTEKS);

    expect(hasil.status).toBe("perlu_manual");
    if (hasil.status !== "perlu_manual") throw new Error("status salah");
    expect(hasil.alasan).toBe("timeout");
  });

  it("membatalkan permintaan, tidak membiarkannya jalan di latar", async () => {
    /*
     * Tanpa pembatalan, permintaan lambat tetap berjalan setelah operator
     * beralih ke slider — menghabiskan kuota dan koneksi untuk jawaban yang
     * tidak akan dipakai.
     */
    let sinyal: AbortSignal | undefined;
    const client = {
      create: vi.fn(
        (_p: unknown, opsi?: { signal?: AbortSignal }) =>
          new Promise((_selesai, gagal) => {
            sinyal = opsi?.signal;
            opsi?.signal?.addEventListener("abort", () => {
              const galat = new Error("aborted");
              galat.name = "AbortError";
              gagal(galat);
            });
          }),
      ),
    } as never;

    const model = buatModelProvider({ client, timeoutMs: 30 });
    await model.baca(FOTO_JPEG, KONTEKS);

    expect(sinyal).toBeDefined();
    expect(sinyal!.aborted).toBe(true);
  });

  it("mencatat latensi meski gagal (4.8)", async () => {
    const model = buatModelProvider({
      client: clientPalsu(() => jawabanBaik(), 5_000),
      timeoutMs: 40,
    });
    const hasil = await model.baca(FOTO_JPEG, KONTEKS);

    expect(hasil.latensiMs).toBeGreaterThanOrEqual(30);
  });

  it("batas waktu bawaan 6 detik", async () => {
    const { TIMEOUT_MODEL_MS } = await import("../provider.ts");
    expect(TIMEOUT_MODEL_MS).toBe(6_000);
  });
});

// ---------------------------------------------------------------------------
// 4.2 — respons tak terduga
// ---------------------------------------------------------------------------

describe("respons tak terduga jatuh ke jalur manual (4.2)", () => {
  const kasus: Array<[string, unknown]> = [
    [
      "JSON rusak",
      { stop_reason: "end_turn", content: [{ type: "text", text: "{bukan json" }] },
    ],
    ["tanpa blok teks", { stop_reason: "end_turn", content: [] }],
    [
      "fraksi hilang",
      { stop_reason: "end_turn", content: [{ type: "text", text: '{"keyakinan":0.9}' }] },
    ],
    [
      "fraksi bukan angka",
      {
        stop_reason: "end_turn",
        content: [{ type: "text", text: '{"fraksi":"banyak","keyakinan":0.9}' }],
      },
    ],
    [
      "fraksi di luar 0..1",
      {
        stop_reason: "end_turn",
        content: [{ type: "text", text: '{"fraksi":1.4,"keyakinan":0.9}' }],
      },
    ],
    [
      "fraksi negatif",
      {
        stop_reason: "end_turn",
        content: [{ type: "text", text: '{"fraksi":-0.2,"keyakinan":0.9}' }],
      },
    ],
    ["penolakan keamanan", { stop_reason: "refusal", content: [] }],
  ];

  it.each(kasus)("%s -> perlu_manual, tanpa melempar", async (_nama, jawaban) => {
    const model = buatModelProvider({ client: clientPalsu(() => jawaban) });
    const hasil = await model.baca(FOTO_JPEG, KONTEKS);

    expect(hasil.status).toBe("perlu_manual");
  });

  it("panggilan yang melempar tetap menjadi perlu_manual", async () => {
    const client = {
      create: vi.fn(() => Promise.reject(new Error("kuota habis"))),
    } as never;

    const hasil = await buatModelProvider({ client }).baca(FOTO_JPEG, KONTEKS);

    expect(hasil.status).toBe("perlu_manual");
    if (hasil.status !== "perlu_manual") throw new Error("status salah");
    expect(hasil.alasan).toBe("panggilan_gagal");
  });

  it("format berkas tak dikenal ditolak sebelum ada panggilan", async () => {
    const client = { create: vi.fn() } as never;
    const hasil = await buatModelProvider({ client }).baca(
      new Uint8Array([1, 2, 3, 4]),
      KONTEKS,
    );

    expect(hasil.status).toBe("perlu_manual");
    expect(
      (client as unknown as { create: { mock: { calls: unknown[] } } }).create.mock.calls,
    ).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 4.3 — provider manual
// ---------------------------------------------------------------------------

describe("manual-provider (4.3)", () => {
  it("memakai fraksi dari geseran operator, keyakinan 1, latensi 0", async () => {
    const hasil = await buatManualProvider().baca(null, {
      ...KONTEKS,
      fraksiManual: 0.375,
    });
    if (hasil.status !== "terbaca") throw new Error("harus terbaca");

    expect(hasil.fraksi).toBe(0.375);
    expect(hasil.keyakinan).toBe(1);
    expect(hasil.latensiMs).toBe(0);
  });

  it("menjepit nilai di luar rentang ke 0..1", async () => {
    const manual = buatManualProvider();
    const atas = await manual.baca(null, { ...KONTEKS, fraksiManual: 1.8 });
    const bawah = await manual.baca(null, { ...KONTEKS, fraksiManual: -0.5 });

    if (atas.status !== "terbaca" || bawah.status !== "terbaca") {
      throw new Error("harus terbaca");
    }
    expect(atas.fraksi).toBe(1);
    expect(bawah.fraksi).toBe(0);
  });

  it("tidak memerlukan foto sama sekali", async () => {
    const hasil = await buatManualProvider().baca(null, {
      ...KONTEKS,
      fraksiManual: 0.5,
    });
    expect(hasil.status).toBe("terbaca");
  });

  it("bentuk keluarannya tidak memuat kata yang berbau kegagalan", async () => {
    // BLUEPRINT P4: slider setara, bukan darurat. Kalau bentuk datanya sendiri
    // menyebut "error" atau "fallback", UI akan menuruti bahasa itu.
    const hasil = await buatManualProvider().baca(null, {
      ...KONTEKS,
      fraksiManual: 0.5,
    });
    expect(JSON.stringify(hasil)).not.toMatch(/error|gagal|fallback|darurat/i);
  });
});

// ---------------------------------------------------------------------------
// 4.4 — pemilihan provider dari env
// ---------------------------------------------------------------------------

describe("pemilihan provider dari VISION_ENABLED (4.4)", () => {
  it("bawaan aktif ketika variabel tidak diisi", () => {
    expect(modelPenglihatanAktif({})).toBe(true);
    expect(ambilPembacaFraksi({ env: {} }).nama).toBe("model");
  });

  it('"false" mematikan model', () => {
    const env = { VISION_ENABLED: "false" };
    expect(modelPenglihatanAktif(env)).toBe(false);
    expect(ambilPembacaFraksi({ env }).nama).toBe("manual");
  });

  it('"FALSE" dan " false " juga mematikan', () => {
    for (const nilai of ["FALSE", " false ", "False"]) {
      const env = { VISION_ENABLED: nilai };
      expect(modelPenglihatanAktif(env)).toBe(false);
    }
  });

  it("nilai salah ketik TIDAK diam-diam mematikan model", () => {
    /*
     * `VISION_ENABLE=false` atau `VISION_ENABLED=flase` harus tetap membiarkan
     * model aktif. Salah ketik yang diam-diam mematikan model akan membuat
     * seluruh dapur mengira sistemnya rusak, dan penyebabnya tidak terlihat
     * di mana pun.
     */
    for (const nilai of ["flase", "0", "no", "", "true"]) {
      const env = { VISION_ENABLED: nilai };
      expect(modelPenglihatanAktif(env)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Batas lapisan
// ---------------------------------------------------------------------------

describe("batas lapisan /src/vision", () => {
  it("hasil kedua provider bisa dipakai lewat satu tipe yang sama", async () => {
    const daftar: HasilBaca[] = [
      await buatModelProvider({ client: clientPalsu(() => jawabanBaik()) }).baca(
        FOTO_JPEG,
        KONTEKS,
      ),
      await buatManualProvider().baca(null, { ...KONTEKS, fraksiManual: 0.45 }),
    ];

    for (const hasil of daftar) {
      // Kompilator memaksa pemeriksaan status sebelum membaca fraksi — jalur
      // fallback mustahil terlupakan.
      if (hasil.status === "terbaca") {
        expect(hasil.fraksi).toBeGreaterThanOrEqual(0);
        expect(hasil.fraksi).toBeLessThanOrEqual(1);
      }
    }
  });
});
