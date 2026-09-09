import { NextRequest, NextResponse } from "next/server";

function sessionCookieName(): string {
  return process.env.NODE_ENV === "production"
    ? "__Host-halcyon_session"
    : "halcyon_session";
}

export function middleware(request: NextRequest) {
  const session = request.cookies.get(sessionCookieName())?.value;
  const isLogin = request.nextUrl.pathname === "/login";

  if (!session && !isLogin) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (session && isLogin) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api).*)"],
};
