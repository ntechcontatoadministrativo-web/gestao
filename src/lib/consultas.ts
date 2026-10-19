import "server-only";
import type { AcaoLog, Etapa, Prisma } from "@prisma/client";
import { hojeInicio, parseDataInput } from "./utils";

export function progresso(etapas: Pick<Etapa, "status">[]) {
  if (!etapas.length) return 0;
  // Etapa aguardando aprovação conta como 75% feita; em andamento, 40%.
  const peso = { PENDENTE: 0, EM_ANDAMENTO: 0.4, AGUARDANDO_APROVACAO: 0.75, CONCLUIDA: 1 } as const;
  return Math.round((etapas.reduce((s, e) => s + peso[e.status], 0) / etapas.length) * 100);
}

export const etapaAtrasada = (e: Pick<Etapa, "status" | "prazo">) =>
  e.status !== "CONCLUIDA" && !!e.prazo && e.prazo < hojeInicio();

export function etapaAtual<T extends Pick<Etapa, "status" | "ordem">>(etapas: T[]) {
  return [...etapas].sort((a, b) => a.ordem - b.ordem).find((e) => e.status !== "CONCLUIDA") ?? null;
}

export const ROTULO_ACAO: Record<string, string> = {
  LOGIN: "Entrou no sistema",
  LOGIN_FALHOU: "Falha de login",
  VISUALIZOU: "Visualizou",
  BAIXOU: "Baixou",
  ENVIOU: "Enviou",
  NOVA_REVISAO: "Nova revisão",
  ACESSO_NEGADO: "Acesso negado",
  LIBEROU: "Liberou acesso",
  BLOQUEOU: "Bloqueou acesso",
  REMOVEU_ACESSO: "Removeu liberação",
  EXCLUIU: "Excluiu arquivo",
};

// Filtros da tela de auditoria (datas no fuso de Belém).
export function filtroAuditoria(sp: Record<string, string | undefined>): Prisma.LogAcessoWhereInput {
  const de = parseDataInput(sp.de ?? null);
  const ate = parseDataInput(sp.ate ?? null);
  return {
    ...(sp.usuario ? { usuarioId: sp.usuario } : {}),
    ...(sp.acao && sp.acao in ROTULO_ACAO ? { acao: sp.acao as AcaoLog } : {}),
    ...(sp.arquivo ? { arquivoId: sp.arquivo } : {}),
    ...(de || ate
      ? {
          criadoEm: {
            ...(de ? { gte: new Date(de.getTime() - 12 * 3600 * 1000) } : {}),
            ...(ate ? { lt: new Date(ate.getTime() + 12 * 3600 * 1000) } : {}),
          },
        }
      : {}),
  };
}

