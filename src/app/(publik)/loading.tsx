/*
 * State memuat — 7.7. SKELETON, BUKAN SPINNER.
 *
 * Bedanya bukan selera. Spinner mengatakan "tunggu" dan tidak mengatakan apa
 * pun tentang apa yang akan datang. Skeleton menunjukkan BENTUK halaman yang
 * sedang dimuat, jadi mata sudah tahu ke mana harus melihat begitu angkanya
 * tiba — dan pada jaringan 400 kbps, selisih itu terasa.
 *
 * Kotak besar di atas berada persis di tempat angka pahlawan akan muncul.
 *
 * Tidak ada animasi (larangan sprint ini). Denyut pada elemen sebesar ini
 * membuat halaman terasa gelisah, dan pada Android kelas bawah ia memakan
 * waktu CPU yang seharusnya dipakai merender kontennya.
 */

function Kotak({ kelas }: { kelas: string }) {
  return <div className={`rounded-xl bg-netral-200 ${kelas}`} aria-hidden />;
}

export default function Memuat() {
  return (
    <main
      className="mx-auto flex max-w-md flex-col gap-5 p-4"
      aria-busy="true"
      aria-label="Memuat data dapur"
    >
      <Kotak kelas="h-4 w-3/4" />
      {/* Di sinilah angka pahlawan akan muncul. */}
      <Kotak kelas="h-20 w-32" />
      <Kotak kelas="h-5 w-1/2" />
      <Kotak kelas="h-8 w-2/3" />
      <Kotak kelas="h-40 w-full" />
      <Kotak kelas="h-40 w-full" />
      <span className="sr-only">Memuat data dapur…</span>
    </main>
  );
}
