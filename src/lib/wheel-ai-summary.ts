import type { AnalyticsKpis, PrizeBucket, WheelInsight } from "@/lib/wheel-insights";

/** OPENAI_API_KEY varsa kısa yönetici özeti; yoksa / hata olursa null */
export async function maybeAiSummary(input: {
  from: string;
  to: string;
  kpis: AnalyticsKpis;
  byPrize: PrizeBucket[];
  insights: WheelInsight[];
}): Promise<string | null> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return null;

  const prizeLines = input.byPrize
    .filter((p) => !p.isEmpty)
    .slice(0, 12)
    .map(
      (p) =>
        `${p.name}: kazanç=${p.wins}, teslim=${p.claimed}, iptal=${p.cancelled}, kalan=${p.remainingTotal ?? "∞"}`,
    )
    .join("\n");

  const insightLines = input.insights
    .slice(0, 6)
    .map((i) => `- [${i.severity}] ${i.title}: ${i.action}`)
    .join("\n");

  const prompt = `Sen bir süpermarket kampanya analistisin. Azerbaycan/Türkiye market şans çarkı verisini özetle.
Dönem: ${input.from} → ${input.to}
KPI: çevirme=${input.kpis.spins}, kazanç=${input.kpis.wins}, boş=${input.kpis.empties}, teslim=%${input.kpis.claimRate}, iptal=%${input.kpis.cancelRate}, tekil telefon=${input.kpis.uniquePhones}
Hediyeler:
${prizeLines || "(yok)"}
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
            content: "Kısa, profesyonel Türkçe kampanya özeti yazarsın.",
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
