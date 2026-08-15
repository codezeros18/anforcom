import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { LayarPenyaluran } from "./LayarPenyaluran";

export const dynamic = "force-dynamic";

export default async function HalamanPenyaluran({
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

  return (
    <LayarPenyaluran
      catatanId={catatan.id}
      porsiDimasak={catatan.porsiDimasak.toString().replace(/\.00$/, "")}
      jumlahWadah={catatan.estimasi.length}
    />
  );
}
