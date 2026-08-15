import type { HasilBaca, KonteksPembacaan, PembacaFraksi } from "./provider.ts";

/*
 * Pembacaan fraksi dari geseran operator.
 *
 * BUKAN PENANGANAN KEGAGALAN. Ini jalur setara (BLUEPRINT P4): slider terlihat
 * dan aktif sejak detik 1,5, bukan muncul setelah foto gagal. Kalau slider baru
 * muncul ketika ada kegagalan, ia terasa seperti kerusakan; kalau ia sudah ada
 * sejak awal, peralihan terasa seperti pilihan.
 *
 * Konsekuensi teknisnya terlihat di berkas ini: tidak ada satu pun kata
 * "gagal", "error", atau "fallback" pada bentuk keluarannya. Ia mengembalikan
 * `status: "terbaca"` persis seperti model — karena hasilnya memang setara.
 *
 * `keyakinan` selalu 1: orang yang menggeser sedang melihat wadahnya langsung.
 * `latensiMs` selalu 0: tidak ada yang ditunggu.
 */

export function buatManualProvider(): PembacaFraksi {
  return {
    nama: "manual",

    /*
     * Tidak ada yang ditunggu di sini, tapi tanda tangannya tetap asinkron:
     * bentuknya wajib identik dengan model-provider, termasuk sifat asinkronnya.
     * Pemanggil tidak boleh bisa membedakan keduanya — itulah seluruh gunanya
     * berkas ini.
     */
    baca(_foto, konteks: KonteksPembacaan): Promise<HasilBaca> {
      const fraksi = konteks.fraksiManual;

      /*
       * Tidak ada fraksi berarti layar memanggil jalur manual sebelum operator
       * menggeser apa pun. Itu bukan kegagalan pembacaan — belum ada yang
       * dibaca. Sinyalnya tetap "perlu_manual" supaya UI menunggu geseran, dan
       * `panggilan_gagal` sengaja TIDAK dipakai: tidak ada panggilan apa pun
       * yang gagal di sini.
       */
      if (typeof fraksi !== "number" || !Number.isFinite(fraksi)) {
        return Promise.resolve({
          status: "perlu_manual",
          alasan: "model_dimatikan",
          latensiMs: 0,
        });
      }

      // Dijepit ke rentang yang punya arti fisik. Wadah tidak bisa terisi 130%,
      // dan angka di luar rentang biasanya berarti persen tertukar dengan fraksi.
      const dijepit = Math.min(1, Math.max(0, fraksi));

      return Promise.resolve({
        status: "terbaca",
        fraksi: dijepit,
        keyakinan: 1,
        latensiMs: 0,
      });
    },
  };
}
