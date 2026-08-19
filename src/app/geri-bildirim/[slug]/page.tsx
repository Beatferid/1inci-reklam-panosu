import { Suspense } from "react";
import type { Metadata } from "next";
import FeedbackClient from "./FeedbackClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `Təklif & Şikayət · ${slug}`,
    description: "Təklif və ya şikayətinizi bizə bildirin — kamera lazım deyil",
  };
}

export default async function FeedbackPage({ params }: Props) {
  const { slug } = await params;
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[100dvh] items-center justify-center bg-[#fff4e0] text-sm text-[#5c3b00]/70">
          Form hazırlanır…
        </div>
      }
    >
      <FeedbackClient slug={slug} />
    </Suspense>
  );
}
