import type { Metadata } from "next";
import type { ReactNode } from "react";
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
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
