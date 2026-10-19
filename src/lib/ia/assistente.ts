import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod/v4";
import type { Prisma } from "@prisma/client";
import { db } from "../db";
import type { UsuarioSessao } from "../auth";
import { etapaAtrasada, progresso, ROTULO_ACAO } from "../consultas";
import { filtroArquivosVisiveis } from "../permissoes";
import { diaBelem, estaOnline, fmtMinutos, intervaloDia } from "../utils";
import { MODELO_IA } from "./levantamento";

const hora = (d: Date) => d.toLocaleTimeString("pt-BR", { timeZone: "America/Belem", hour: "2-digit", minute: "2-digit" });
const dataHora = (d: Date | null | undefined) =>
  d ? d.toLocaleString("pt-BR", { timeZone: "America/Belem", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : null;
const dia = (d: Date | null | undefined) => (d ? diaBelem(d).split("-").reverse().join("/") : null);

const Periodo = {
  de: z.string().optional().describe('Primeiro dia, "YYYY-MM-DD" (fuso de Belém). Padrão: hoje.'),
  ate: z.string().optional().describe('Último dia, inclusive, "YYYY-MM-DD". Padrão: igual a "de".'),
};

function intervalo(de?: string, ate?: string): [Date, Date] {
  const ok = (s?: string) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : undefined);
  const ini = ok(de) ?? diaBelem();
  const fim = ok(ate) ?? ini;
  return [intervaloDia(ini)[0], intervaloDia(fim)[1]];
}

// Ferramentas que a IA usa para consultar o sistema. Para colaboradores, tudo
// fica restrito aos dados da própria pessoa.
export function ferramentas(u: UsuarioSessao) {
  const gestor = u.perfil === "GESTOR";
  const pessoaPermitida = (id: string) => gestor || id === u.id;
  const filtroProjeto: Prisma.ProjetoWhereInput = gestor
    ? {}
    : { OR: [{ etapas: { some: { responsavelId: u.id } } }, { tarefas: { some: { responsavelId: u.id } } }, { arquivos: { some: filtroArquivosVisiveis(u.id) } }] };

  const buscarPessoas = betaZodTool({
    name: "buscar_pessoas",
    description:
      "Lista as pessoas da equipe (id, nome, cargo, perfil, se está online, último acesso). Use para descobrir o id de alguém citado pelo nome (aceita apelido ou só o primeiro nome).",
    inputSchema: z.object({ nome: z.string().optional().describe("Parte do nome para filtrar. Vazio = todos.") }),
    run: async ({ nome }) => {
      const pessoas = await db.usuario.findMany({
        where: { ...(nome ? { nome: { contains: nome.trim(), mode: "insensitive" } } : {}), ...(gestor ? {} : { id: u.id }) },
        select: { id: true, nome: true, cargo: true, perfil: true, ativo: true, ultimoAcesso: true, missao: true },
        orderBy: { nome: "asc" },
      });
      return JSON.stringify(
        pessoas.map((p) => ({ ...p, online: p.ativo && estaOnline(p.ultimoAcesso), ultimoAcesso: dataHora(p.ultimoAcesso) })),
      );
    },
  });

  const atividadePessoa = betaZodTool({
    name: "atividade_pessoa",
    description:
      "Tudo o que uma pessoa fez num período: entradas no sistema, arquivos abertos/baixados/enviados, revisões, comentários, mudanças de status de etapas, etapas concluídas, tarefas criadas/concluídas e horas apontadas. Use para perguntas como 'o que o Yuri fez hoje?'.",
    inputSchema: z.object({ pessoa_id: z.string(), ...Periodo }),
    run: async ({ pessoa_id, de, ate }) => {
      if (!pessoaPermitida(pessoa_id)) return "Sem permissão: colaboradores só consultam a própria atividade.";
      const [ini, fim] = intervalo(de, ate);
      const periodo = { gte: ini, lt: fim };
      const [pessoa, logs, comentarios, etapasConcluidas, tarefasFeitas, tarefasRecebidas, horas] = await Promise.all([
        db.usuario.findUnique({ where: { id: pessoa_id }, select: { nome: true, ultimoAcesso: true } }),
        db.logAcesso.findMany({
          where: { usuarioId: pessoa_id, criadoEm: periodo },
          include: { arquivo: { select: { nome: true, projeto: { select: { codigo: true } } } }, versao: { select: { revisao: true } } },
          orderBy: { criadoEm: "asc" },
          take: 300,
        }),
        db.comentario.findMany({
          where: { autorId: pessoa_id, criadoEm: periodo },
          include: { etapa: { select: { nome: true, projeto: { select: { codigo: true, nome: true } } } } },
          orderBy: { criadoEm: "asc" },
          take: 200,
        }),
        db.etapa.findMany({
          where: { responsavelId: pessoa_id, concluidaEm: periodo },
          select: { nome: true, prazo: true, concluidaEm: true, projeto: { select: { codigo: true } } },
        }),
        db.tarefa.findMany({ where: { responsavelId: pessoa_id, concluidaEm: periodo }, select: { titulo: true, prazo: true, concluidaEm: true } }),
        db.tarefa.findMany({ where: { responsavelId: pessoa_id, criadoEm: periodo }, select: { titulo: true, status: true, prazo: true } }),
        db.apontamento.findMany({
          where: { usuarioId: pessoa_id, data: periodo },
          include: { projeto: { select: { codigo: true } }, etapa: { select: { nome: true } }, tarefa: { select: { titulo: true } } },
        }),
      ]);
      if (!pessoa) return "Pessoa não encontrada.";
      return JSON.stringify({
        pessoa: pessoa.nome,
        periodo: `${dia(ini)} a ${dia(new Date(fim.getTime() - 1))}`,
        ultimoAcesso: dataHora(pessoa.ultimoAcesso),
        eventos_arquivos_e_acesso: logs.map((l) => ({
          hora: dataHora(l.criadoEm),
          acao: ROTULO_ACAO[l.acao],
          arquivo: l.arquivo ? `${l.arquivo.projeto.codigo} · ${l.arquivo.nome}${l.versao ? ` R${String(l.versao.revisao).padStart(2, "0")}` : ""}` : undefined,
          detalhe: l.detalhe ?? undefined,
        })),
        comentarios_e_mudancas_de_etapa: comentarios.map((c) => ({
          hora: dataHora(c.criadoEm),
          projeto: c.etapa.projeto.codigo,
          etapa: c.etapa.nome,
          tipo: c.sistema ? "ação no fluxo" : "comentário",
          texto: c.texto.slice(0, 300),
        })),
        etapas_concluidas: etapasConcluidas.map((e) => ({
          projeto: e.projeto.codigo,
          etapa: e.nome,
          concluida: dataHora(e.concluidaEm),
          no_prazo: e.prazo ? e.concluidaEm! <= new Date(e.prazo.getTime() + 12 * 3600 * 1000) : null,
        })),
        tarefas_concluidas: tarefasFeitas.map((t) => ({ titulo: t.titulo, concluida: dataHora(t.concluidaEm) })),
        tarefas_recebidas: tarefasRecebidas.map((t) => ({ titulo: t.titulo, status: t.status, prazo: dia(t.prazo) })),
        horas_apontadas: {
          total: fmtMinutos(horas.reduce((s, h) => s + h.minutos, 0)),
          itens: horas.map((h) => ({
            dia: dia(h.data),
            horas: fmtMinutos(h.minutos),
            projeto: h.projeto.codigo,
            etapa: h.etapa?.nome,
            tarefa: h.tarefa?.titulo,
            descricao: h.descricao ?? undefined,
          })),
        },
      });
    },
  });

  const listarProjetos = betaZodTool({
    name: "listar_projetos",
    description: "Lista projetos com status, progresso (%), etapa atual, prazo final e quantidade de etapas atrasadas.",
    inputSchema: z.object({
      status: z.enum(["ATIVO", "PAUSADO", "CONCLUIDO", "CANCELADO", "TODOS"]).optional().describe("Padrão: ATIVO"),
      busca: z.string().optional().describe("Parte do nome, código ou cliente"),
    }),
    run: async ({ status, busca }) => {
      const projetos = await db.projeto.findMany({
        where: {
          AND: [
            filtroProjeto,
            !status || status === "ATIVO" ? { status: "ATIVO" } : status === "TODOS" ? {} : { status },
            busca
              ? { OR: [{ nome: { contains: busca, mode: "insensitive" } }, { codigo: { contains: busca, mode: "insensitive" } }, { cliente: { contains: busca, mode: "insensitive" } }] }
              : {},
          ],
        },
        include: { etapas: { select: { nome: true, status: true, prazo: true, ordem: true } } },
        orderBy: { codigo: "desc" },
        take: 60,
      });
      return JSON.stringify(
        projetos.map((p) => ({
          id: p.id,
          codigo: p.codigo,
          nome: p.nome,
          cliente: p.cliente,
          status: p.status,
          progresso: `${progresso(p.etapas)}%`,
          etapa_atual: p.etapas.sort((a, b) => a.ordem - b.ordem).find((e) => e.status !== "CONCLUIDA")?.nome ?? null,
          prazo_final: dia(p.prazoFinal),
          etapas_atrasadas: p.etapas.filter(etapaAtrasada).length,
        })),
      );
    },
  });

  const detalhesProjeto = betaZodTool({
    name: "detalhes_projeto",
    description: "Detalhes de um projeto: etapas (responsável, status, prazo, horas), tarefas abertas, últimos arquivos e horas totais.",
    inputSchema: z.object({ projeto: z.string().describe("id ou código do projeto (ex.: P2026-001)") }),
    run: async ({ projeto }) => {
      const p = await db.projeto.findFirst({
        where: { AND: [filtroProjeto, { OR: [{ id: projeto }, { codigo: { equals: projeto.trim(), mode: "insensitive" } }] }] },
        include: {
          etapas: { include: { responsavel: { select: { nome: true } }, apontamentos: { select: { minutos: true } } }, orderBy: { ordem: "asc" } },
          tarefas: { where: { status: { in: ["A_FAZER", "FAZENDO"] } }, include: { responsavel: { select: { nome: true } } } },
          arquivos: { orderBy: { atualizadoEm: "desc" }, take: 10, select: { nome: true, revisaoAtual: true, atualizadoEm: true } },
          apontamentos: { select: { minutos: true } },
        },
      });
      if (!p) return "Projeto não encontrado (ou sem acesso).";
      const etapas = gestor ? p.etapas : p.etapas.filter((e) => e.responsavelId === u.id);
      return JSON.stringify({
        codigo: p.codigo,
        nome: p.nome,
        cliente: p.cliente,
        status: p.status,
        inicio: dia(p.dataInicio),
        prazo_final: dia(p.prazoFinal),
        progresso: `${progresso(p.etapas)}%`,
        horas_totais: fmtMinutos(p.apontamentos.reduce((s, a) => s + a.minutos, 0)),
        etapas: etapas.map((e) => ({
          ordem: e.ordem,
          nome: e.nome,
          responsavel: e.responsavel?.nome ?? null,
          status: e.status,
          prazo: dia(e.prazo),
          atrasada: etapaAtrasada(e),
          concluida_em: dia(e.concluidaEm),
          horas: fmtMinutos(e.apontamentos.reduce((s, a) => s + a.minutos, 0)),
        })),
        tarefas_abertas: p.tarefas
          .filter((t) => gestor || t.responsavelId === u.id)
          .map((t) => ({ titulo: t.titulo, responsavel: t.responsavel.nome, prioridade: t.prioridade, prazo: dia(t.prazo) })),
        ultimos_arquivos: gestor ? p.arquivos.map((a) => ({ nome: a.nome, revisao: `R${String(a.revisaoAtual).padStart(2, "0")}`, atualizado: dataHora(a.atualizadoEm) })) : undefined,
      });
    },
  });

  const buscarTarefas = betaZodTool({
    name: "buscar_tarefas",
    description: "Busca tarefas por responsável, status e atraso.",
    inputSchema: z.object({
      responsavel_id: z.string().optional(),
      status: z.enum(["ABERTAS", "A_FAZER", "FAZENDO", "FEITA", "CANCELADA", "TODAS"]).optional().describe("Padrão: ABERTAS"),
      somente_atrasadas: z.boolean().optional(),
    }),
    run: async ({ responsavel_id, status, somente_atrasadas }) => {
      const resp = gestor ? responsavel_id : u.id;
      const st = status ?? "ABERTAS";
      const tarefas = await db.tarefa.findMany({
        where: {
          ...(resp ? { responsavelId: resp } : {}),
          ...(st === "ABERTAS" ? { status: { in: ["A_FAZER", "FAZENDO"] } } : st === "TODAS" ? {} : { status: st }),
          ...(somente_atrasadas ? { prazo: { lt: intervaloDia(diaBelem())[0] }, status: { in: ["A_FAZER", "FAZENDO"] } } : {}),
        },
        include: { responsavel: { select: { nome: true } }, projeto: { select: { codigo: true } } },
        orderBy: { prazo: "asc" },
        take: 100,
      });
      return JSON.stringify(
        tarefas.map((t) => ({
          titulo: t.titulo,
          responsavel: t.responsavel.nome,
          status: t.status,
          prioridade: t.prioridade,
          prazo: dia(t.prazo),
          projeto: t.projeto?.codigo,
          concluida: dataHora(t.concluidaEm),
        })),
      );
    },
  });

  const horasApontadas = betaZodTool({
    name: "horas_apontadas",
    description: "Soma das horas apontadas num período, agrupadas por pessoa e por projeto. Pode filtrar por pessoa ou projeto.",
    inputSchema: z.object({ pessoa_id: z.string().optional(), projeto: z.string().optional().describe("id ou código"), ...Periodo }),
    run: async ({ pessoa_id, projeto, de, ate }) => {
      const [ini, fim] = intervalo(de, ate);
      const pid = gestor ? pessoa_id : u.id;
      const proj = projeto ? await db.projeto.findFirst({ where: { OR: [{ id: projeto }, { codigo: { equals: projeto, mode: "insensitive" } }] } }) : null;
      const itens = await db.apontamento.findMany({
        where: { data: { gte: ini, lt: fim }, ...(pid ? { usuarioId: pid } : {}), ...(proj ? { projetoId: proj.id } : {}) },
        include: { usuario: { select: { nome: true } }, projeto: { select: { codigo: true } } },
      });
      const soma = (k: (a: (typeof itens)[number]) => string) => {
        const m = new Map<string, number>();
        for (const a of itens) m.set(k(a), (m.get(k(a)) ?? 0) + a.minutos);
        return Object.fromEntries(Array.from(m, ([c, v]) => [c, fmtMinutos(v)]));
      };
      return JSON.stringify({
        periodo: `${dia(ini)} a ${dia(new Date(fim.getTime() - 1))}`,
        total: fmtMinutos(itens.reduce((s, a) => s + a.minutos, 0)),
        por_pessoa: soma((a) => a.usuario.nome),
        por_projeto: soma((a) => a.projeto.codigo),
      });
    },
  });

  const pendencias = betaZodTool({
    name: "pendencias",
    description: "Visão geral do que precisa de atenção: etapas aguardando aprovação, etapas atrasadas, etapas vencendo em até 3 dias e tarefas atrasadas.",
    inputSchema: z.object({}),
    run: async () => {
      const hoje = intervaloDia(diaBelem())[0];
      const em3 = new Date(hoje.getTime() + 4 * 86400000);
      const base: Prisma.EtapaWhereInput = { projeto: { status: "ATIVO" }, ...(gestor ? {} : { responsavelId: u.id }) };
      const [aguardando, atrasadas, vencendo, tarefas] = await Promise.all([
        db.etapa.findMany({ where: { ...base, status: "AGUARDANDO_APROVACAO" }, include: { projeto: { select: { codigo: true } }, responsavel: { select: { nome: true } } } }),
        db.etapa.findMany({ where: { ...base, status: { not: "CONCLUIDA" }, prazo: { lt: hoje } }, include: { projeto: { select: { codigo: true } }, responsavel: { select: { nome: true } } } }),
        db.etapa.findMany({ where: { ...base, status: { not: "CONCLUIDA" }, prazo: { gte: hoje, lt: em3 } }, include: { projeto: { select: { codigo: true } }, responsavel: { select: { nome: true } } } }),
        db.tarefa.findMany({
          where: { status: { in: ["A_FAZER", "FAZENDO"] }, prazo: { lt: hoje }, ...(gestor ? {} : { responsavelId: u.id }) },
          include: { responsavel: { select: { nome: true } } },
        }),
      ]);
      const fmt = (e: (typeof aguardando)[number]) => ({ projeto: e.projeto.codigo, etapa: e.nome, responsavel: e.responsavel?.nome ?? null, prazo: dia(e.prazo) });
      return JSON.stringify({
        aguardando_aprovacao: aguardando.map(fmt),
        etapas_atrasadas: atrasadas.map(fmt),
        etapas_vencendo_em_3_dias: vencendo.map(fmt),
        tarefas_atrasadas: tarefas.map((t) => ({ titulo: t.titulo, responsavel: t.responsavel.nome, prazo: dia(t.prazo) })),
      });
    },
  });

  const acessosArquivo = betaZodTool({
    name: "acessos_arquivo",
    description: "Quem abriu, baixou ou teve acesso negado a arquivos cujo nome contém o texto informado (auditoria). Só para gestores.",
    inputSchema: z.object({ nome_arquivo: z.string(), ...Periodo }),
    run: async ({ nome_arquivo, de, ate }) => {
      if (!gestor) return "Sem permissão: a auditoria de arquivos é só para gestores.";
      const [ini, fim] = de || ate ? intervalo(de, ate) : [new Date(0), new Date(Date.now() + 86400000)];
      const logs = await db.logAcesso.findMany({
        where: { arquivo: { nome: { contains: nome_arquivo, mode: "insensitive" } }, criadoEm: { gte: ini, lt: fim } },
        include: { usuario: { select: { nome: true } }, arquivo: { select: { nome: true } }, versao: { select: { revisao: true } } },
        orderBy: { criadoEm: "desc" },
        take: 80,
      });
      return JSON.stringify(
        logs.map((l) => ({
          quando: dataHora(l.criadoEm),
          pessoa: l.usuario?.nome ?? l.detalhe,
          acao: ROTULO_ACAO[l.acao],
          arquivo: l.arquivo?.nome,
          revisao: l.versao ? `R${String(l.versao.revisao).padStart(2, "0")}` : undefined,
        })),
      );
    },
  });

  return [buscarPessoas, atividadePessoa, listarProjetos, detalhesProjeto, buscarTarefas, horasApontadas, pendencias, acessosArquivo];
}

function sistema(u: UsuarioSessao) {
  const agora = new Date();
  const hoje = diaBelem(agora);
  const semana = agora.toLocaleDateString("pt-BR", { timeZone: "America/Belem", weekday: "long" });
  return `Você é o assistente de organização do sistema de gestão de projetos elétricos da NTECH, usado por um escritório em Belém (PA).
Responda em português do Brasil, de forma direta e organizada (listas curtas, negrito nos nomes e números importantes). Sem enrolação.

Contexto:
- Hoje é ${semana}, ${hoje.split("-").reverse().join("/")} (${hoje}); agora são ${hora(agora)} no horário de Belém. Interprete "hoje", "ontem", "essa semana" (segunda a hoje) e "mês" a partir disso.
- Quem está perguntando: ${u.nome} (${u.perfil === "GESTOR" ? "gestor, vê toda a equipe" : "colaborador, só pode ver os próprios dados"}).

Como trabalhar:
- Use as ferramentas para buscar os dados reais antes de responder. Nunca invente atividades, números ou nomes.
- Quando citarem uma pessoa pelo nome, primeiro use buscar_pessoas para achar o id; se houver mais de uma pessoa com aquele nome, pergunte qual.
- Para "o que fulano fez", use atividade_pessoa e conte a história do dia em ordem cronológica, agrupando por projeto: arquivos trabalhados, etapas que andaram, tarefas concluídas, comentários e horas. Termine com um resumo de uma linha.
- Se não houver registro no período, diga isso claramente (o sistema só sabe o que foi feito por dentro dele).
- Se a pergunta pedir algo que o perfil da pessoa não permite, explique de forma educada.`;
}

export type MensagemChat = { papel: "usuario" | "assistente"; texto: string };

// Cada pergunta vira uma conversa nova de uma única mensagem, levando o histórico
// recente como texto. Assim nada da conversa anterior é reenviado alterado.
export async function perguntarAssistente(u: UsuarioSessao, historico: MensagemChat[], pergunta: string) {
  const anteriores = historico.slice(-10);
  const contexto = anteriores.length
    ? `<conversa_anterior>\n${anteriores.map((m) => `${m.papel === "usuario" ? "Usuário" : "Assistente"}: ${m.texto.slice(0, 2000)}`).join("\n\n")}\n</conversa_anterior>\n\n`
    : "";

  const usadas: string[] = [];
  const tools = ferramentas(u).map((t) => ({
    ...t,
    run: async (input: never) => {
      usadas.push(t.name);
      return (t.run as (i: never) => Promise<string>)(input);
    },
  }));

  const resposta = await new Anthropic().beta.messages.toolRunner({
    model: MODELO_IA,
    max_tokens: 8000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium" },
    max_iterations: 12,
    system: sistema(u),
    tools,
    messages: [{ role: "user", content: `${contexto}Pergunta: ${pergunta}` }],
  });

  if (resposta.stop_reason === "refusal") {
    return { texto: "Não consegui responder essa pergunta. Tente reformular.", ferramentas: usadas };
  }
  const texto = resposta.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
  return { texto: texto || "Não encontrei uma resposta. Tente perguntar de outro jeito.", ferramentas: Array.from(new Set(usadas)) };
}
