import { db } from "@/lib/db";
import { ambilDapurAktif } from "@/app/api/_lib/data";
import { LayarPendaftaranWadah } from "./LayarPendaftaranWadah";

export const dynamic = "force-dynamic";

export default async function HalamanPendaftaranWadah({
  searchParams,
}: {
  searchParams: Promise<{ kembali?: string }>;
}) {
  const { kembali } = await searchParams;
  const dapur = await ambilDapurAktif();

  /*
   * Jenis masakan yang sudah ada ditawarkan sebagai saran ketikan di langkah 4.
   *
   * Untuk wadah kedua dan seterusnya, ini memangkas langkah itu menjadi satu
   * ketukan — "nasi putih" sudah ada, tinggal dipilih. Untuk wadah pertama di
   * dapur baru daftarnya kosong, dan operator mengetik namanya sendiri.
   */
  const jenisTersedia = dapur
    ? await db.jenisMasakan.findMany({
        where: { dapurId: dapur.id },
        orderBy: { nama: "asc" },
      })
    : [];

  /*
   * Tujuan kembali dibatasi ke jalur internal. Nilai dari query string tidak
   * boleh menjadi tujuan pengalihan apa adanya — itu membuka pengalihan terbuka
   * ke situs mana pun lewat tautan yang terlihat sah.
   */
  const kembaliKe = kembali && /^\/[a-zA-Z0-9/_-]*$/.test(kembali) ? kembali : "/catat";

  return (
    <LayarPendaftaranWadah
      jenisTersedia={jenisTersedia.map((j) => ({
        id: j.id,
        nama: j.nama,
        kategoriFisik: j.kategoriFisik,
      }))}
      kembaliKe={kembaliKe}
    />
  );
}
