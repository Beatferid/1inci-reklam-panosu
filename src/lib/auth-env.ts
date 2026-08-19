/** Vercel’de AUTH_URL localhost kalırsa NextAuth /api/auth/error 500 verir. */
export function applyVercelAuthUrl() {
  process.env.AUTH_TRUST_HOST = "true";
  if (!process.env.VERCEL) return;
  const current = process.env.AUTH_URL || "";
  if (current && !current.includes("localhost")) return;
  const host = (
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL ||
    ""
  ).replace(/^https?:\/\//, "");
  if (host) {
    process.env.AUTH_URL = `https://${host}`;
  }
}

applyVercelAuthUrl();
