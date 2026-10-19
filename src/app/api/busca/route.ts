import { NextResponse } from "next/server";
import { usuarioAtual } from "@/lib/auth";
import { db } from "@/lib/db";
import { filtroArquivosVisiveis } from "@/lib/permissoes";

export const dynamic = "force-dynamic";

type Resultado = { tipo: "projeto" | "etapa" | "tarefa" | "arquivo" | "pessoa"; titulo: string; detalhe: string; link: string };

// Busca global (Ctrl+K). Cada perfil só encontra o que já pode ver.
export async function GET(req: Request) {
  const u = await usuarioAtual();
  if (!u) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  const q = new URL(req.url).searchParams.get("q")?.trim().slice(0, 80) ?? "";
  if (q.length < 2) return NextResponse.json({ resultados: [] });
  const gestor = u.perfil === "GESTOR";
  const contem = { contains: q, mode: "insensitive" as const };

  const [projetos, etapas, tarefas, arquivos, pessoas] = await Promise.all([
    db.projeto.findMany({
      where: {
        AND: [
          { OR: [{ nome: contem }, { codigo: contem }, { cliente: contem }] },
          gestor ? {} : { OR: [{ etapas: { some: { responsavelId: u.id } } }, { tarefas: { some: { responsavelId: u.id } } }] },
        ],
      },
      select: { id: true, codigo: true, nome: true, cliente: true, status: true },
      take: 6,
    }),
    db.etapa.findMany({
      where: { nome: contem, ...(gestor ? {} : { responsavelId: u.id }) },
      select: { id: true, nome: true, projeto: { select: { id: true, codigo: true } }, responsavel: { select: { nome: true } } },
      take: 6,
    }),
    db.tarefa.findMany({
      where: { OR: [{ titulo: contem }, { descricao: contem }], ...(gestor ? {} : { responsavelId: u.id }) },
      select: { id: true, titulo: true, status: true, responsavel: { select: { nome: true } } },
      orderBy: { criadoEm: "desc" },
      take: 6,
    }),
    db.arquivo.findMany({
      where: { AND: [{ nome: contem }, gestor ? {} : filtroArquivosVisiveis(u.id)] },
      select: { id: true, nome: true, revisaoAtual: true, projeto: { select: { codigo: true } } },
      orderBy: { atualizadoEm: "desc" },
      take: 8,
    }),
    gestor
      ? db.usuario.findMany({ where: { OR: [{ nome: contem }, { email: contem }, { cargo: contem }] }, select: { id: true, nome: true, cargo: true, email: true }, take: 5 })
      : Promise.resolve([]),
  ]);

  const resultados: Resultado[] = [
    ...projetos.map((p) => ({ tipo: "projeto" as const, titulo: `${p.codigo} · ${p.nome}`, detalhe: p.cliente ?? p.status.toLowerCase(), link: `/projetos/${p.id}` })),
    ...etapas.map((e) => ({
      tipo: "etapa" as const,
      titulo: e.nome,
      detalhe: `${e.projeto.codigo}${e.responsavel ? ` · ${e.responsavel.nome}` : ""}`,
      link: `/projetos/${e.projeto.id}/etapas/${e.id}`,
    })),
    ...tarefas.map((t) => ({ tipo: "tarefa" as const, titulo: t.titulo, detalhe: `${t.responsavel.nome} · ${t.status.replace("_", " ").toLowerCase()}`, link: `/tarefas?t=${t.id}#${t.id}` })),
    ...arquivos.map((a) => ({
      tipo: "arquivo" as const,
      titulo: a.nome,
      detalhe: `${a.projeto.codigo} · R${String(a.revisaoAtual).padStart(2, "0")}`,
      link: `/arquivos/${a.id}`,
    })),
    ...pessoas.map((p) => ({ tipo: "pessoa" as const, titulo: p.nome, detalhe: p.cargo ?? p.email, link: `/equipe/${p.id}` })),
  ];
  return NextResponse.json({ resultados });
}
