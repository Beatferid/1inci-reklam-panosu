import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

export const { auth } = NextAuth(authConfig);

export default auth((req) => {
  if (!req.auth && req.nextUrl.pathname.startsWith("/admin")) {
    const url = new URL("/login", req.nextUrl.origin);
    url.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return Response.redirect(url);
  }
  if (
    !req.auth &&
    (req.nextUrl.pathname.startsWith("/api/campaigns") ||
      req.nextUrl.pathname.startsWith("/api/board") ||
      req.nextUrl.pathname.startsWith("/api/admin"))
  ) {
    return Response.json({ error: "Yetkisiz" }, { status: 401 });
  }
});

export const config = {
  matcher: [
    "/admin/:path*",
    "/api/campaigns/:path*",
    "/api/board/:path*",
    "/api/admin/:path*",
  ],
};
