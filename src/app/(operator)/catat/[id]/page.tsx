import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { LayarPencatatan } from "./LayarPencatatan";

export const dynamic = "force-dynamic";

export default async function HalamanPencatatan({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const catatan = await db.catatanHarian.findUnique({
    where: { id },
    include: { estimasi: { select: { id: true } } },
  });
  if (!catatan) notFound();

  const [wadah, jenisMasakan, kalibrasi] = await Promise.all([
    db.wadah.findMany({
      where: { dapurId: catatan.dapurId, aktif: true },
      orderBy: { nama: "asc" },
    }),
    db.jenisMasakan.findMany({
      where: { dapurId: catatan.dapurId },
      orderBy: { nama: "asc" },
    }),
    db.kalibrasi.findMany({ where: { wadah: { dapurId: catatan.dapurId } } }),
  ]);

  /*
   * Konstanta dikirim ke klien supaya pratinjau slider berubah SEKETIKA saat
   * digeser. Meminta server setiap kali slider bergerak akan membuat angka
   * pratinjau tertinggal beberapa ratus milidetik di jaringan dapur — dan
   * slider yang angkanya tertinggal terasa rusak.
   *
   * Angka yang disimpan tetap dihitung ulang di server dengan aritmetika
   * eksak; yang di klien hanya untuk dilihat.
   */
  const porsiPenuhPerPasangan: Record<string, number> = {};
  for (const k of kalibrasi) {
    porsiPenuhPerPasangan[`${k.wadahId}|${k.jenisMasakanId}`] = Number(
      k.porsiPenuh.toString(),
    );
  }

  return (
    <LayarPencatatan
      catatanId={catatan.id}
      porsiDimasak={catatan.porsiDimasak.toString().replace(/\.00$/, "")}
      wadah={wadah.map((w) => ({
        id: w.id,
        nama: w.nama,
        bentuk: w.bentuk,
        fotoAcuanUrl: w.fotoAcuanUrl,
      }))}
      jenisMasakan={jenisMasakan.map((j) => ({ id: j.id, nama: j.nama }))}
      porsiPenuhPerPasangan={porsiPenuhPerPasangan}
      jumlahWadahTercatat={catatan.estimasi.length}
    />
  );
}
