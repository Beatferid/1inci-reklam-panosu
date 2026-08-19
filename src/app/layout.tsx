import type { Metadata } from "next";
import { DM_Sans, Fraunces } from "next/font/google";
import TunnelAlertOverlay from "@/components/TunnelAlertOverlay";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin", "latin-ext"],
  variable: "--font-dm-sans",
});

const fraunces = Fraunces({
  subsets: ["latin", "latin-ext"],
  variable: "--font-fraunces",
});

export const metadata: Metadata = {
  title: "Reklam Panosu",
  description: "QR ile açılan görsel ve şans çarkı sistemi",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <body className={`${dmSans.variable} ${fraunces.variable} antialiased`}>
        <style>{`
          :root {
            --sans: var(--font-dm-sans), system-ui, sans-serif;
            --display: var(--font-fraunces), Georgia, serif;
          }
        `}</style>
        {children}
        <TunnelAlertOverlay />
      </body>
    </html>
  );
}
