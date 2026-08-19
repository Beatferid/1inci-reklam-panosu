export function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export function isInAppBrowser(userAgent: string) {
  const ua = userAgent.toLowerCase();
  return (
    ua.includes("instagram") ||
    ua.includes("fbav") ||
    ua.includes("fban") ||
    ua.includes("fb_iab") ||
    ua.includes("line/") ||
    ua.includes("tiktok") ||
    ua.includes("bytedance") ||
    (ua.includes("wv") && ua.includes("android"))
  );
}
