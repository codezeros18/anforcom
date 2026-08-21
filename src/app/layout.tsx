import type { Metadata } from "next";
import type { ReactNode } from "react";
import { BannerModeCoba } from "@/components/BannerModeCoba";
import "./globals.css";

export const metadata: Metadata = {
  title: "SISA",
  description: "Alat catat sisa makanan untuk dapur institusi.",
};

/*
 * Props diketik eksplisit, bukan memakai tipe global `LayoutProps` bawaan Next.
 * Tipe global itu baru ada setelah `next build` menuliskan `.next/types`, jadi
 * `npm run typecheck` akan gagal pada checkout bersih di CI — tepat di tempat
 * kegagalannya paling membingungkan.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        {/*
         * Banner mode coba dipasang SEKALI di sini, bukan per halaman.
         * Alasannya ada di komentar kepala `BannerModeCoba.tsx`: halaman baru
         * yang lupa memasangnya akan terlihat persis seperti dapur sungguhan.
         * Ia merender `null` saat tidak ada sesi coba yang aktif.
         */}
        <BannerModeCoba />
        {children}
      </body>
    </html>
  );
}
