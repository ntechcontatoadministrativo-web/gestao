// Mensagens de WhatsApp via link wa.me: o gestor revisa o texto e envia pelo próprio WhatsApp.
import type { Prioridade } from "@prisma/client";
import { fmtData } from "./utils";

// "(91) 98888-7777" -> "5591988887777". Retorna null se não parecer um celular brasileiro/internacional.
export function normalizarTelefone(v: string | null | undefined): string | null {
  const d = (v ?? "").replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) return `55${d}`;
  if (d.length >= 12 && d.length <= 15) return d;
  return null;
}

export function formatarTelefone(v: string | null | undefined) {
  const d = (v ?? "").replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return v ?? "";
}

export function linkWhatsapp(telefone: string | null | undefined, texto: string) {
  const n = normalizarTelefone(telefone);
  const q = `text=${encodeURIComponent(texto)}`;
  // Sem telefone cadastrado, o WhatsApp abre para escolher o contato.
  return n ? `https://wa.me/${n}?${q}` : `https://wa.me/?${q}`;
}

const ROTULO_PRIORIDADE: Record<Prioridade, string> = {
  BAIXA: "Baixa",
  MEDIA: "Média",
  ALTA: "Alta",
  URGENTE: "🔴 URGENTE",
};

const primeiroNome = (nome: string) => nome.trim().split(/\s+/)[0];

export function mensagemTarefa(t: {
  titulo: string;
  descricao: string | null;
  prioridade: Prioridade;
  prazo: Date | null;
  responsavel: { nome: string };
  criadoPor?: { nome: string } | null;
  projeto?: { codigo: string; nome: string } | null;
  etapa?: { nome: string } | null;
  url: string;
}) {
  const linhas = [
    `Olá, ${primeiroNome(t.responsavel.nome)}! 👋`,
    "",
    `${t.criadoPor ? primeiroNome(t.criadoPor.nome) : "O gestor"} designou uma nova tarefa para você:`,
    "",
    `📌 *${t.titulo}*`,
  ];
  if (t.projeto) linhas.push(`🏗️ Projeto: ${t.projeto.codigo} · ${t.projeto.nome}${t.etapa ? ` (${t.etapa.nome})` : ""}`);
  if (t.prazo) linhas.push(`📅 Prazo: ${fmtData(t.prazo)}`);
  linhas.push(`⚡ Prioridade: ${ROTULO_PRIORIDADE[t.prioridade]}`);
  if (t.descricao) linhas.push("", t.descricao.length > 600 ? `${t.descricao.slice(0, 600)}…` : t.descricao);
  linhas.push("", `Detalhes e atualização de status no sistema:`, t.url, "", "Qualquer dúvida, me chama por aqui.");
  return linhas.join("\n");
}

export function mensagemEtapa(e: {
  nome: string;
  descricao: string | null;
  prazo: Date | null;
  responsavel: { nome: string };
  projeto: { codigo: string; nome: string; cliente?: string | null };
  url: string;
}) {
  const linhas = [
    `Olá, ${primeiroNome(e.responsavel.nome)}! 👋`,
    "",
    "Você é o responsável por uma etapa de projeto:",
    "",
    `🏗️ *${e.projeto.codigo} · ${e.projeto.nome}*`,
    `📐 Etapa: *${e.nome}*`,
  ];
  if (e.projeto.cliente) linhas.push(`👤 Cliente: ${e.projeto.cliente}`);
  if (e.prazo) linhas.push(`📅 Prazo: ${fmtData(e.prazo)}`);
  if (e.descricao) linhas.push("", e.descricao.length > 600 ? `${e.descricao.slice(0, 600)}…` : e.descricao);
  linhas.push("", "Os arquivos liberados e o andamento estão no sistema:", e.url, "", "Quando terminar, envie para aprovação por lá. 👍");
  return linhas.join("\n");
}
