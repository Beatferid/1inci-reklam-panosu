import { Suspense } from "react";
import type { Metadata } from "next";
import GameWheelClient from "./GameWheelClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `Şans çarxı · ${slug}`,
    description: "Yüngül şans çarxı oyunu — kamera tələb olunmur",
  };
}

export default async function OyunPage({ params }: Props) {
  const { slug } = await params;
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[100dvh] items-center justify-center bg-[#fff4e0] text-sm text-[#5c3b00]/70">
          Oyun hazırlanır…
        </div>
      }
    >
      <GameWheelClient slug={slug} />
    </Suspense>
  );
}
