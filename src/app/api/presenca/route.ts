import { NextResponse } from "next/server";
import { usuarioAtual } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST() {
  const u = await usuarioAtual();
  if (!u) return NextResponse.json({ erro: "Sessão encerrada" }, { status: 401 });
  await db.usuario.update({ where: { id: u.id }, data: { ultimoAcesso: new Date() } });
  return NextResponse.json({ ok: true });
}
