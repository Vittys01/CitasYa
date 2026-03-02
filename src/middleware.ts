import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;

  const isPublic =
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/whatsapp/webhook");

  if (!req.auth && !isPublic) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const role = req.auth?.user?.role;

  // OWNER trying to access /dashboard → send them to /owner
  if (role === "OWNER" && pathname.startsWith("/dashboard")) {
    return NextResponse.redirect(new URL("/owner", req.url));
  }

  // Non-OWNER trying to access /owner → send them to /dashboard
  if (role && role !== "OWNER" && pathname.startsWith("/owner")) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
