import { NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { lerConfig } from "@/lib/storage/google";
import { CFG_DYNAMO } from "@/lib/integracoes";

const num = z.coerce.number().finite();
const Circuito = z.object({
  circuito: z.string().max(40),
  descricao: z.string().max(200).optional().default(""),
  potencia_va: num.nonnegative(),
  fases: z.string().max(10).optional().default(""), // ex.: "A", "AB", "ABC"
  polos: z.coerce.number().int().min(1).max(3).optional(),
  tensao_v: num.optional(),
  disjuntor_a: num.optional(),
  secao_mm2: z.string().max(40).optional(),
});
const Payload = z.object({
  projeto: z.string().min(1).max(40),
  arquivo: z.string().max(260).optional(),
  quadros: z
    .array(z.object({ nome: z.string().min(1).max(120), tensao: z.string().max(40).optional(), circuitos: z.array(Circuito).max(2000) }))
    .max(500)
    .default([]),
  quantitativos: z.array(z.object({ item: z.string().max(200), unidade: z.string().max(20), quantidade: num })).max(5000).default([]),
});

const hash = (t: string) => createHash("sha256").update(t).digest();

// Recebe do script do Dynamo os dados do modelo Revit (quadro de cargas, circuitos, quantitativos).
export async function POST(req: Request) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  const salvo = await lerConfig(CFG_DYNAMO);
  if (!token || !salvo || !timingSafeEqual(hash(token), Buffer.from(salvo, "hex"))) {
    return NextResponse.json({ erro: "Token inválido. Gere um em Configurações > Integração com Dynamo." }, { status: 401 });
  }

  const corpo = await req.json().catch(() => null);
  const r = Payload.safeParse(corpo);
  if (!r.success) {
    return NextResponse.json({ erro: "Dados inválidos.", detalhes: r.error.issues.slice(0, 10) }, { status: 400 });
  }

  const projeto = await db.projeto.findUnique({ where: { codigo: r.data.projeto.trim().toUpperCase() } });
  if (!projeto) return NextResponse.json({ erro: `Projeto ${r.data.projeto} não encontrado. Use o código do projeto no sistema.` }, { status: 404 });

  const reg = await db.dadosModelo.create({
    data: { projetoId: projeto.id, arquivoRvt: r.data.arquivo ?? null, payload: r.data },
  });
  const circuitos = r.data.quadros.reduce((s, q) => s + q.circuitos.length, 0);
  return NextResponse.json({
    ok: true,
    projeto: projeto.codigo,
    recebidoEm: reg.recebidoEm,
    resumo: `${r.data.quadros.length} quadro(s), ${circuitos} circuito(s), ${r.data.quantitativos.length} item(ns) de quantitativo`,
  });
}
