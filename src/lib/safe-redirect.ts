/** Same-origin relative path only — blocks open redirects. */
export function safeCallbackUrl(
  raw: string | null | undefined,
  fallback = "/admin",
): string {
  if (!raw) return fallback;
  const url = raw.trim();
  if (!url.startsWith("/") || url.startsWith("//")) return fallback;
  if (url.includes("://") || url.includes("\\")) return fallback;
  return url;
}
