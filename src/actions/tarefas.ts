"use server";

import { revalidatePath } from "next/cache";
import type { Prioridade, StatusTarefa } from "@prisma/client";
import { db } from "@/lib/db";
import { exigirGestor, exigirUsuario, urlBase } from "@/lib/auth";
import { parseDataInput } from "@/lib/utils";
import { mensagemTarefa } from "@/lib/whatsapp";
import { enviarWhatsapp, whatsappApiAtiva } from "@/lib/whatsapp-api";
import { avisar } from "@/lib/avisos";
import { fmtData } from "@/lib/utils";
import type { EstadoForm } from "@/components/client";

const PRIORIDADES: Prioridade[] = ["BAIXA", "MEDIA", "ALTA", "URGENTE"];
const STATUS: StatusTarefa[] = ["A_FAZER", "FAZENDO", "FEITA", "CANCELADA"];

const texto = (fd: FormData, k: string) => {
  const v = String(fd.get(k) ?? "").trim();
  return v || null;
};

function revalidar(projetoId?: string | null) {
  revalidatePath("/tarefas");
  revalidatePath("/painel");
  if (projetoId) revalidatePath(`/projetos/${projetoId}`);
}

async function dadosDoForm(fd: FormData) {
  const titulo = texto(fd, "titulo");
  const responsavelId = texto(fd, "responsavelId");
  if (!titulo) return { erro: "Informe o título da tarefa." } as const;
  if (!responsavelId) return { erro: "Escolha para quem é a tarefa." } as const;

  const etapaId = texto(fd, "etapaId");
  let projetoId = texto(fd, "projetoId");
  if (etapaId) {
    const etapa = await db.etapa.findUnique({ where: { id: etapaId }, select: { projetoId: true } });
    if (!etapa) return { erro: "Etapa inválida." } as const;
    projetoId = etapa.projetoId;
  }
  const p = String(fd.get("prioridade")) as Prioridade;
  return {
    dados: {
      titulo: titulo.slice(0, 200),
      descricao: texto(fd, "descricao")?.slice(0, 4000) ?? null,
      responsavelId,
      projetoId,
      etapaId,
      prazo: parseDataInput(fd.get("prazo")),
      prioridade: PRIORIDADES.includes(p) ? p : "MEDIA",
    },
  } as const;
}

// Cria a tarefa e devolve a mensagem de WhatsApp pronta para o gestor enviar.
export async function criarTarefa(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const gestor = await exigirGestor();
  const r = await dadosDoForm(fd);
  if ("erro" in r) return { erro: r.erro };

  const t = await db.tarefa.create({
    data: { ...r.dados, criadoPorId: gestor.id },
    include: {
      responsavel: { select: { nome: true, telefone: true, missao: true, modeloWhatsapp: true } },
      criadoPor: { select: { nome: true } },
      projeto: { select: { codigo: true, nome: true, cliente: true } },
      etapa: { select: { nome: true } },
    },
  });
  await avisar(
    [t.responsavelId],
    {
      tipo: "tarefa",
      titulo: `Nova tarefa: ${t.titulo}`,
      texto: [t.projeto ? `${t.projeto.codigo} · ${t.projeto.nome}` : null, t.prazo ? `prazo ${fmtData(t.prazo)}` : null].filter(Boolean).join(" · ") || null,
      link: `/tarefas?t=${t.id}#${t.id}`,
    },
    gestor.id,
  );
  const mensagem = mensagemTarefa({ ...t, url: `${urlBase()}/tarefas?t=${t.id}` });
  // Envio automático pela API, se o gestor marcou a opção.
  let envio = "";
  if (fd.get("enviarAuto") === "on" && whatsappApiAtiva()) {
    const r = await enviarWhatsapp({ usuarioId: t.responsavelId, telefone: t.responsavel.telefone, mensagem, referencia: `tarefa:${t.id}` });
    envio = r.ok ? "enviado" : r.erro;
    if (r.ok) await db.tarefa.update({ where: { id: t.id }, data: { avisadoEm: new Date() } });
  }
  revalidar(t.projetoId);
  return {
    ok: `Tarefa designada para ${t.responsavel.nome}.`,
    dados: {
      tarefaId: t.id,
      usuarioId: t.responsavelId,
      nome: t.responsavel.nome,
      telefone: t.responsavel.telefone ?? "",
      mensagem,
      envio,
      apiAtiva: whatsappApiAtiva() ? "1" : "",
    },
  };
}

export async function editarTarefa(id: string, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  await exigirGestor();
  const r = await dadosDoForm(fd);
  if ("erro" in r) return { erro: r.erro };
  const t = await db.tarefa.update({ where: { id }, data: r.dados });
  revalidar(t.projetoId);
  return { ok: "Tarefa atualizada." };
}

// O responsável (ou o gestor) atualiza o andamento.
export async function alterarStatusTarefa(id: string, status: StatusTarefa) {
  const u = await exigirUsuario();
  if (!STATUS.includes(status)) return;
  const t = await db.tarefa.findUniqueOrThrow({ where: { id } });
  if (u.perfil !== "GESTOR" && t.responsavelId !== u.id) throw new Error("Esta tarefa não é sua.");
  if (u.perfil !== "GESTOR" && status === "CANCELADA") throw new Error("Só o gestor cancela tarefas.");
  await db.tarefa.update({
    where: { id },
    data: { status, concluidaEm: status === "FEITA" ? new Date() : null },
  });
  if (status === "FEITA" && t.status !== "FEITA") {
    await avisar([t.criadoPorId], { tipo: "tarefa", titulo: `${u.nome.split(" ")[0]} concluiu: ${t.titulo}`, link: `/tarefas?t=${t.id}#${t.id}` }, u.id);
  }
  revalidar(t.projetoId);
}

export async function excluirTarefa(id: string) {
  await exigirGestor();
  const t = await db.tarefa.delete({ where: { id } });
  revalidar(t.projetoId);
}

export async function registrarAviso(id: string) {
  await exigirGestor();
  await db.tarefa.update({ where: { id }, data: { avisadoEm: new Date() } });
  revalidatePath("/tarefas");
}
