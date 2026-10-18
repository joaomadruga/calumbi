import { NextRequest, NextResponse } from "next/server.js";
import { authorized } from "./lib/session.ts";
import { requestOrigin } from "./lib/request-origin.ts";

export function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  if (path === "/api/session") return NextResponse.next();
  const signedIn = authorized(req);
  const origin = requestOrigin(req) ?? req.nextUrl.origin;
  if (path === "/login") {
    return signedIn
      ? NextResponse.redirect(new URL("/", origin))
      : NextResponse.next();
  }
  if (signedIn) return NextResponse.next();
  if (path.startsWith("/api/")) {
    return NextResponse.json(
      { error: "Entre com a senha da fazenda.", login: true },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }
  return NextResponse.redirect(new URL("/login", origin));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
