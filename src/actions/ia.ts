"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { exigirGestor } from "@/lib/auth";
import { parseDataInput } from "@/lib/utils";
import type { ResultadoLevantamento } from "@/lib/ia/levantamento";
import type { EstadoForm } from "@/components/client";

// Cria o projeto com as etapas e prazos propostos pela IA (ajustados pelo gestor no formulário).
export async function criarProjetoDoLevantamento(id: string, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const gestor = await exigirGestor();
  const lev = await db.levantamento.findUniqueOrThrow({ where: { id } });
  if (lev.status !== "CONCLUIDO" || !lev.resultado) return { erro: "O levantamento ainda não terminou." };
  if (lev.projetoId) redirect(`/projetos/${lev.projetoId}`);
  const r = lev.resultado as unknown as ResultadoLevantamento;

  const nome = String(fd.get("nome") ?? "").trim() || lev.titulo;
  const ano = new Date().getFullYear();
  let codigo = String(fd.get("codigo") ?? "").trim().toUpperCase();
  if (!codigo) {
    const n = await db.projeto.count({ where: { codigo: { startsWith: `P${ano}-` } } });
    for (let i = n + 1; ; i++) {
      codigo = `P${ano}-${String(i).padStart(3, "0")}`;
      if (!(await db.projeto.findUnique({ where: { codigo } }))) break;
    }
  } else if (await db.projeto.findUnique({ where: { codigo } })) {
    return { erro: `Já existe um projeto com o código ${codigo}.` };
  }

  const inicio = parseDataInput(fd.get("dataInicio")) ?? new Date();
  let cursor = inicio.getTime();
  const etapas = r.etapas
    .map((e, i) => ({ e, i, incluir: fd.get(`incluir_${i}`) === "on" }))
    .filter((x) => x.incluir)
    .map(({ e, i }, ordem) => {
      const dias = Math.max(1, Math.round(Number(fd.get(`dias_${i}`)) || e.dias));
      cursor += dias * 86400000;
      const entregas = e.entregaveis.length ? `\n\nEntregáveis:\n${e.entregaveis.map((x) => `• ${x}`).join("\n")}` : "";
      return {
        nome: String(fd.get(`nome_${i}`) ?? e.nome).trim() || e.nome,
        descricao: `${e.descricao}${entregas}`.slice(0, 4000),
        ordem: ordem + 1,
        prazo: new Date(cursor),
        responsavelId: String(fd.get(`resp_${i}`) ?? "") || null,
      };
    });
  if (!etapas.length) return { erro: "Selecione ao menos uma etapa." };

  const escopo = [
    r.resumo,
    "",
    "Escopo:",
    ...r.escopo.map((s) => `• ${s.item}: ${s.descricao}`),
    "",
    "Premissas:",
    ...r.premissas.map((p) => `• ${p}`),
  ].join("\n");

  const projeto = await db.projeto.create({
    data: {
      codigo,
      nome,
      cliente: lev.cliente,
      descricao: escopo.slice(0, 8000),
      dataInicio: inicio,
      prazoFinal: new Date(cursor),
      criadoPorId: gestor.id,
      etapas: { create: etapas },
    },
  });
  await db.levantamento.update({ where: { id }, data: { projetoId: projeto.id } });
  revalidatePath("/projetos");
  revalidatePath("/ia");
  redirect(`/projetos/${projeto.id}`);
}

export async function excluirLevantamento(id: string) {
  await exigirGestor();
  await db.levantamento.delete({ where: { id } });
  revalidatePath("/ia");
  redirect("/ia");
}
