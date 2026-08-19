import type { FeedbackInsight, FeedbackKpis, FeedbackLocationBucket } from "@/lib/feedback-insights";

/** OPENAI_API_KEY varsa kısa yönetici özeti; yoksa / hata olursa null */
export async function maybeFeedbackAiSummary(input: {
  from: string;
  to: string;
  kpis: FeedbackKpis;
  byLocation: FeedbackLocationBucket[];
  insights: FeedbackInsight[];
}): Promise<string | null> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return null;

  const locLines = input.byLocation
    .filter((l) => l.total > 0)
    .slice(0, 12)
    .map(
      (l) =>
        `${l.locationName}: gönderim=${l.total}, şikayet=${l.complaints}, ortalama puan=${l.avgRating ?? "—"}, çözülmemiş=${l.unresolved}`,
    )
    .join("\n");

  const insightLines = input.insights
    .slice(0, 6)
    .map((i) => `- [${i.severity}] ${i.title}: ${i.action}`)
    .join("\n");

  const prompt = `Sen bir süpermarket müşteri deneyimi analistisin. Öneri ve şikayet kutusu verilerini özetle.
Dönem: ${input.from} → ${input.to}
KPI: gönderim=${input.kpis.total}, öneri=${input.kpis.suggestions}, şikayet=${input.kpis.complaints}, ortalama puan=${input.kpis.avgRating ?? "—"}, çözüm oranı=%${input.kpis.resolutionRate}, tekil cihaz=${input.kpis.uniqueDevices}
Şubeler:
${locLines || "(yok)"}
Yerel uyarılar:
${insightLines || "(yok)"}

Türkçe, 3-5 kısa cümle: durum + en önemli risk + net aksiyon. Madde işareti kullanma.`;

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        temperature: 0.4,
        max_tokens: 220,
        messages: [
          {
            role: "system",
            content: "Kısa, profesyonel Türkçe müşteri deneyimi özeti yazarsın.",
          },
          { role: "user", content: prompt },
        ],
      }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = data.choices?.[0]?.message?.content?.trim();
    return text || null;
  } catch {
    return null;
  }
}
