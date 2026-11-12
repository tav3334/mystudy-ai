import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import "./globals.css";
export const metadata: Metadata = {
  title: {
    default: "MyStudy AI — Votre espace de réussite",
    template: "%s · MyStudy AI",
  },
  description:
    "Vos cours, vos révisions, votre rythme. Un espace personnel de préparation aux examens connecté à Google Drive.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
