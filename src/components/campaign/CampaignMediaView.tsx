"use client";

import { useEffect, useState } from "react";

type CampaignPayload = {
  name: string;
  mediaType: "VIDEO" | "IMAGE" | null;
  mediaUrl: string | null;
};

export default function CampaignMediaView({ slug }: { slug: string }) {
  const [data, setData] = useState<CampaignPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/public/campaigns/${slug}`, {
          cache: "no-store",
        });
        const json = (await res.json()) as CampaignPayload & { error?: string };
        if (!res.ok) {
          throw new Error(json.error || "Kampanya bulunamadı");
        }
        if (cancelled) return;
        setData(json);
        void fetch("/api/analytics", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug, type: "scan" }),
        });
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Yüklenemedi");
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (error) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-black px-6 text-center text-sm text-white/80">
        {error}
      </div>
    );
  }

  if (!data?.mediaUrl) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-black text-sm text-white/80">
        Görsel hazırlanır…
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-black">
      {data.mediaType === "VIDEO" ? (
        <video
          src={data.mediaUrl}
          className="max-h-dvh w-full object-contain"
          autoPlay
          playsInline
          controls
          onPlay={() => {
            void fetch("/api/analytics", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ slug, type: "play" }),
            });
          }}
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={data.mediaUrl}
          alt={data.name || "Reklam"}
          className="max-h-dvh w-full object-contain"
        />
      )}
    </div>
  );
}
