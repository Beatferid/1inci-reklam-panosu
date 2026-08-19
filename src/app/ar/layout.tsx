import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Kampanya",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#000000",
};

export default function CampaignPublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <style>{`
        html, body, #__next {
          margin: 0 !important;
          padding: 0 !important;
          width: 100% !important;
          height: 100% !important;
          min-height: 100% !important;
          overflow: hidden !important;
          background: #000 !important;
        }
        body { color: #fff !important; }
      `}</style>
      {children}
    </>
  );
}
