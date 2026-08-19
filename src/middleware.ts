import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function hasSessionCookie(req: NextRequest) {
  return Boolean(
    req.cookies.get("authjs.session-token")?.value ||
      req.cookies.get("__Secure-authjs.session-token")?.value ||
      req.cookies.get("next-auth.session-token")?.value ||
      req.cookies.get("__Secure-next-auth.session-token")?.value,
  );
}

export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const protectedPage = path.startsWith("/admin");
  const protectedApi =
    path.startsWith("/api/campaigns") ||
    path.startsWith("/api/board") ||
    path.startsWith("/api/admin");

  if (!protectedPage && !protectedApi) {
    return NextResponse.next();
  }

  if (hasSessionCookie(req)) {
    return NextResponse.next();
  }

  if (protectedApi) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const url = new URL("/login", req.nextUrl.origin);
  url.searchParams.set("callbackUrl", path);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/api/campaigns/:path*",
    "/api/board/:path*",
    "/api/admin/:path*",
  ],
};
