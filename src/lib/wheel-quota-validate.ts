/** Kota zinciri: günlük ≤ haftalık ≤ aylık ≤ toplam (dolu olanlar arası) */

export type QuotaValues = {
  dailyLimit?: number | null;
  weeklyLimit?: number | null;
  monthlyLimit?: number | null;
  totalLimit?: number | null;
};

export function validateQuotaChain(
  q: QuotaValues,
): { ok: true } | { ok: false; error: string } {
  const d = q.dailyLimit;
  const w = q.weeklyLimit;
  const m = q.monthlyLimit;
  const t = q.totalLimit;

  const pairs: [string, number | null | undefined, string, number | null | undefined][] =
    [
      ["Günlük", d, "haftalık", w],
      ["Günlük", d, "aylık", m],
      ["Günlük", d, "toplam", t],
      ["Haftalık", w, "aylık", m],
      ["Haftalık", w, "toplam", t],
      ["Aylık", m, "toplam", t],
    ];

  for (const [aName, a, bName, b] of pairs) {
    if (a != null && b != null && a > b) {
      return {
        ok: false,
        error: `${aName} kota (${a}) ${bName} kotadan (${b}) büyük olamaz. Mantık: gün ≤ hafta ≤ ay ≤ toplam.`,
      };
    }
  }
  return { ok: true };
}

/** En sıkı kota — kullanıcıya örnek açıklama */
export function describeQuotaEffect(q: QuotaValues): string {
  const parts: string[] = [];
  if (q.dailyLimit != null) parts.push(`günde en fazla ${q.dailyLimit}`);
  if (q.weeklyLimit != null) parts.push(`haftada en fazla ${q.weeklyLimit}`);
  if (q.monthlyLimit != null) parts.push(`ayda en fazla ${q.monthlyLimit}`);
  if (q.totalLimit != null) parts.push(`toplam en fazla ${q.totalLimit}`);
  if (parts.length === 0) {
    return "Kota yok — bu hediye sınırsız çıkabilir.";
  }
  return `Hepsi birlikte: ${parts.join(" · ")}. Hangisi önce dolarsa dilim seçilmez. Örn. gün 5 + hafta 3 + ay 1 → ayda en fazla 1 (en sıkı kazanır).`;
}
