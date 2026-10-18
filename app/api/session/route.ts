import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { signSession } from "@/lib/session";
import { isSameOrigin, requestOrigin } from "@/lib/request-origin";
const attempts = new Map<string, { count: number; until: number }>();
export async function POST(req: NextRequest) {
  if (!isSameOrigin(req))
    return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  if (!process.env.APP_PASSWORD)
    return NextResponse.json(
      { error: "Senha não configurada no servidor." },
      { status: 503 },
    );
  const key = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
  const attempt = attempts.get(key);
  if (attempt && attempt.until > Date.now() && attempt.count >= 8)
    return NextResponse.json(
      { error: "Muitas tentativas. Aguarde 15 minutos." },
      { status: 429 },
    );
  let password: unknown;
  try {
    const body = await req.json();
    password = body?.password;
  } catch {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }
  const supplied = Buffer.from(typeof password === "string" ? password : "");
  const expected = Buffer.from(process.env.APP_PASSWORD);
  if (
    supplied.length !== expected.length ||
    !timingSafeEqual(supplied, expected)
  ) {
    attempts.set(key, {
      count: attempt && attempt.until > Date.now() ? attempt.count + 1 : 1,
      until: Date.now() + 900000,
    });
    return NextResponse.json({ error: "Senha incorreta." }, { status: 401 });
  }
  attempts.delete(key);
  const response = NextResponse.json({ ok: true });
  response.cookies.set("fazenda-session", signSession(Date.now() + 86400000), {
    httpOnly: true,
    sameSite: "strict",
    secure: requestOrigin(req)?.startsWith("https://") ?? false,
    maxAge: 86400,
    path: "/",
  });
  return response;
}
export async function DELETE(req: NextRequest) {
  if (!isSameOrigin(req))
    return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  const response = NextResponse.json({ ok: true });
  response.cookies.delete("fazenda-session");
  return response;
}
