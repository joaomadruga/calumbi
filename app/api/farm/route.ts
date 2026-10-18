import { NextRequest, NextResponse } from "next/server";
import { configured, readFarm, writeAction } from "@/lib/sheets";
import { validateAction } from "@/lib/actions";
import { authorized } from "@/lib/session";
import { isSameOrigin } from "@/lib/request-origin";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function guard(req: NextRequest) {
  if (!process.env.APP_PASSWORD)
    return NextResponse.json(
      {
        error: "Defina APP_PASSWORD no .env para acessar a fazenda.",
      },
      { status: 503 },
    );
  if (!authorized(req))
    return NextResponse.json(
      { error: "Entre com a senha da fazenda.", login: true },
      { status: 401 },
    );
}
export async function GET(req: NextRequest) {
  const denied = guard(req);
  if (denied) return denied;
  if (!configured()) return NextResponse.json({ mode: "demo" });
  try {
    return NextResponse.json({ mode: "sheets", farm: await readFarm() });
  } catch {
    return NextResponse.json(
      {
        error:
          "Não foi possível ler a planilha. Confira as credenciais, o compartilhamento e execute npm run sheets:init.",
      },
      { status: 502 },
    );
  }
}
export async function POST(req: NextRequest) {
  const denied = guard(req);
  if (denied) return denied;
  if (!configured())
    return NextResponse.json(
      { error: "Planilha não configurada." },
      { status: 503 },
    );
  if (!isSameOrigin(req))
    return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  try {
    const f = await readFarm();
    let action;
    try {
      action = validateAction(await req.json(), f);
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Dados inválidos." },
        { status: 400 },
      );
    }
    await writeAction(f, action);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      {
        error:
          "Não foi possível salvar. Atualize os dados antes de tentar novamente.",
      },
      { status: 502 },
    );
  }
}
