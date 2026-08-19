import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getTunnelStatus, repairTunnel, writePublicAppUrl } from "@/lib/tunnel";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 90;

function isLocalHost(req: NextRequest) {
  const host = (req.headers.get("host") || "").toLowerCase();
  return (
    host.startsWith("localhost") ||
    host.startsWith("127.0.0.1") ||
    host.startsWith("[::1]")
  );
}

/** Herkes durum görebilir — overlay tüm sayfalarda.
 *  ?liveHost=xxx — tarayıcının gerçekten açıldığı host (yanlış alarm önler)
 */
export async function GET(req: NextRequest) {
  const host = (req.headers.get("host") || "").toLowerCase();
  if (host.includes("vercel.app") || process.env.VERCEL) {
    const url = process.env.NEXT_PUBLIC_APP_URL || `https://${host}`;
    return NextResponse.json({
      ok: true,
      severity: "ok",
      configuredUrl: url,
      reachable: true,
      originReachable: true,
      isTryCloudflare: false,
      isLocalhost: false,
      title: "Yayın adresi hazır",
      detail: url,
      steps: [],
      checkedAt: new Date().toISOString(),
    });
  }
  const liveHost = req.nextUrl.searchParams.get("liveHost");
  const status = await getTunnelStatus(
    liveHost ? { liveHost } : undefined,
  );
  return NextResponse.json(status, {
    headers: { "Cache-Control": "no-store" },
  });
}

/**
 * Canlı tunnel host'unu .data/.env ile hizala.
 * Sadece istek aynı trycloudflare host'tan geliyorsa (kanıt: sayfa açılmış).
 */
export async function PATCH(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { url?: string } | null;
  const raw = (body?.url || "").trim();
  if (!raw.includes("trycloudflare.com")) {
    return NextResponse.json({ error: "Geçersiz URL" }, { status: 400 });
  }
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return NextResponse.json({ error: "Geçersiz URL" }, { status: 400 });
  }
  const reqHost = (req.headers.get("host") || "").toLowerCase();
  if (parsed.host.toLowerCase() !== reqHost) {
    return NextResponse.json(
      { error: "Host uyuşmazlığı — sadece açık tunnel senkronize edilir" },
      { status: 403 },
    );
  }
  writePublicAppUrl(parsed.origin);
  const status = await getTunnelStatus({ liveHost: parsed.host });
  return NextResponse.json(status);
}

/** Düzeltme: admin oturumu VEYA localhost */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session && !isLocalHost(req)) {
    return NextResponse.json(
      {
        error:
          "Tunnel düzeltmek için admin girişi yapın veya bilgisayarda localhost üzerinden açın.",
      },
      { status: 401 },
    );
  }

  const result = await repairTunnel();
  if (!result.ok) {
    return NextResponse.json(result, { status: 500 });
  }
  const status = await getTunnelStatus();
  return NextResponse.json({ ...result, status });
}
