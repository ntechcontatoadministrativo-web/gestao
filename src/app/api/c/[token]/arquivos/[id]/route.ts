import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { projetoDoCliente } from "@/lib/cliente";
import { infoRequisicao } from "@/lib/auth";
import { abrirConteudo } from "@/lib/storage";
import { fmtRevisao } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Conteúdo dos arquivos liberados ao cliente final (link público com token).
export async function GET(req: Request, { params }: { params: { token: string; id: string } }) {
  const p = await projetoDoCliente(params.token);
  const arquivo = p?.arquivos.find((a) => a.id === params.id);
  if (!p || !arquivo) return NextResponse.json({ erro: "Documento não disponível." }, { status: 404 });
  const versao = await db.arquivoVersao.findFirst({ where: { arquivoId: arquivo.id }, orderBy: { revisao: "desc" } });
  if (!versao) return NextResponse.json({ erro: "Documento não disponível." }, { status: 404 });

  const modo = new URL(req.url).searchParams.get("modo") === "ver" ? "ver" : "baixar";
  const range = req.headers.get("range");
  if (modo === "baixar" && (!range || /^bytes=0-/.test(range))) {
    const { ip, userAgent } = infoRequisicao();
    await db.logAcesso.create({
      data: { acao: "BAIXOU", arquivoId: arquivo.id, versaoId: versao.id, detalhe: `Cliente final${p.cliente ? ` (${p.cliente})` : ""}`, ip, userAgent },
    });
  }

  const i = arquivo.nome.lastIndexOf(".");
  const nome = i > 0 ? `${arquivo.nome.slice(0, i)} - ${fmtRevisao(versao.revisao)}${arquivo.nome.slice(i)}` : arquivo.nome;
  const ascii = nome.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "");
  const { corpo, status, headers } = await abrirConteudo(versao, range);
  return new Response(corpo, {
    status,
    headers: {
      ...headers,
      "Content-Type": versao.mimeType,
      "Content-Disposition": `${modo === "ver" ? "inline" : "attachment"}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(nome)}`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
