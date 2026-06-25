import { auth } from "@/auth";
import { NextResponse } from "next/server";

const PUBLIC_PATHS = [
  "/login",
  "/connect",
  "/admin/login",
  "/api/",
  "/privacy-policy",
  "/_next/",
  "/favicon.ico",
];

export default auth(async (req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth?.user?.id;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) return;

  if (pathname.startsWith("/admin")) {
    if (!isLoggedIn || req.auth?.user?.role !== "admin") {
      return NextResponse.redirect(new URL("/admin/login", req.url));
    }
    return;
  }

  if (!isLoggedIn) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
