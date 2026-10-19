import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod/v4";
import { db } from "../db";
import { avisar } from "../avisos";

export const MODELO_IA = "claude-opus-5-5";

export const iaConfigurada = () => !!process.env.ANTHROPIC_API_KEY;

// Formato do levantamento devolvido pela IA (structured outputs: o JSON sempre segue este schema).
export const Levantamento = z.object({
  resumo: z.string().describe("Resumo executivo do projeto em 3 a 5 frases."),
  tipoProjeto: z.string().describe("Ex.: Instalações elétricas BT de galpão industrial; Subestação abrigada 13,8 kV; SPDA; Entrada de energia."),
  complexidade: z.enum(["baixa", "media", "alta"]),
  dadosIdentificados: z
    .array(
      z.object({
        campo: z.string().describe("Ex.: Área construída, Tensão de fornecimento, Potência instalada estimada, Nº de pavimentos."),
        valor: z.string(),
        fonte: z.string().describe("Documento/página de onde veio, ou 'estimativa' / 'a confirmar'."),
      }),
    )
    .describe("Dados técnicos extraídos dos documentos."),
  escopo: z.array(z.object({ item: z.string(), descricao: z.string() })).describe("Itens do escopo de projeto elétrico."),
  entregaveis: z.array(z.string()).describe("Pranchas, memoriais, quadros, listas de materiais, ART etc."),
  etapas: z
    .array(
      z.object({
        nome: z.string(),
        descricao: z.string(),
        dias: z.number().describe("Dias corridos previstos para a etapa."),
        entregaveis: z.array(z.string()),
      }),
    )
    .describe("Etapas na ordem de execução, usando os nomes de etapa do escritório quando fizer sentido."),
  prazoTotalDias: z.number(),
  justificativaPrazos: z.string().describe("Como os prazos foram estimados, citando o histórico do escritório quando houver."),
  premissas: z.array(z.string()),
  riscos: z.array(z.object({ descricao: z.string(), impacto: z.enum(["baixo", "medio", "alto"]), mitigacao: z.string() })),
  perguntasCliente: z.array(z.string()).describe("Perguntas objetivas para fechar o escopo com o cliente."),
  documentosFaltantes: z.array(z.string()),
});
export type ResultadoLevantamento = z.infer<typeof Levantamento>;

const SISTEMA = `Você é um engenheiro eletricista sênior de um escritório de projetos elétricos em Belém (PA), Brasil.
Sua tarefa é fazer o LEVANTAMENTO de um novo projeto a partir dos documentos enviados pelo cliente (memoriais, plantas, fotos, e-mails, briefings) e propor escopo, etapas e prazos.

Como trabalhar:
- Leia todos os documentos com atenção: plantas (áreas, ambientes, pavimentos, cargas especiais), memoriais, fotos do local (padrão de entrada, quadros existentes, estado das instalações).
- Considere as normas aplicáveis (ABNT NBR 5410, NBR 14039 para média tensão, NBR 5419 para SPDA, NR-10) e as exigências da concessionária local (Equatorial Pará) quando forem relevantes.
- Separe com clareza o que foi LIDO nos documentos do que é ESTIMATIVA sua. Nunca invente valores: quando um dado não estiver nos documentos, registre como "a confirmar" ou como estimativa explícita e inclua a pergunta correspondente em perguntasCliente.
- Monte as etapas usando, sempre que fizer sentido, os nomes de etapa padrão do escritório. Pode acrescentar etapas específicas (ex.: aprovação na concessionária) se o projeto exigir.
- Calibre os prazos com o histórico real do escritório quando ele for fornecido (durações médias por etapa e atrasos recorrentes) e explique isso em justificativaPrazos.
- Escreva em português do Brasil, de forma objetiva e técnica, para ser lido pelo gestor do escritório.`;

const MIMES_IMAGEM = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
type MimeImagem = (typeof MIMES_IMAGEM)[number];

export type DocumentoEntrada = { nome: string; tipo: string; dados: Buffer };

export const LIMITES = { totalBytes: 22 * 1024 * 1024, imagemBytes: 5 * 1024 * 1024, arquivos: 20 };

export function tipoSuportado(tipo: string, nome: string) {
  if (tipo === "application/pdf" || MIMES_IMAGEM.includes(tipo as MimeImagem)) return true;
  return tipo.startsWith("text/") || /\.(txt|md|csv)$/i.test(nome);
}

// Histórico real: duração média de cada tipo de etapa nos projetos do escritório.
async function historicoDoEscritorio() {
  const [modelos, etapas, projetosRecentes] = await Promise.all([
    db.modeloEtapa.findMany({ where: { ativo: true }, orderBy: { ordem: "asc" } }),
    db.etapa.findMany({
      where: { status: "CONCLUIDA", iniciadaEm: { not: null }, concluidaEm: { not: null } },
      select: { nome: true, iniciadaEm: true, concluidaEm: true, prazo: true },
      orderBy: { concluidaEm: "desc" },
      take: 400,
    }),
    db.projeto.findMany({
      where: { status: { in: ["CONCLUIDO", "ATIVO"] } },
      select: { nome: true, dataInicio: true, prazoFinal: true, status: true, _count: { select: { etapas: true } } },
      orderBy: { criadoEm: "desc" },
      take: 15,
    }),
  ]);

  const porNome = new Map<string, { dias: number[]; atrasos: number }>();
  for (const e of etapas) {
    const dias = Math.max(1, Math.round((e.concluidaEm!.getTime() - e.iniciadaEm!.getTime()) / 86400000));
    const k = e.nome.trim().toLowerCase();
    const reg = porNome.get(k) ?? { dias: [], atrasos: 0 };
    reg.dias.push(dias);
    if (e.prazo && e.concluidaEm! > e.prazo) reg.atrasos++;
    porNome.set(k, reg);
  }

  const linhas: string[] = [];
  linhas.push("Etapas padrão do escritório (nome — dias planejados):");
  for (const m of modelos) linhas.push(`- ${m.nome} — ${m.diasPadrao} dias${m.descricao ? ` (${m.descricao})` : ""}`);

  if (porNome.size) {
    linhas.push("", "Duração REAL das etapas concluídas (média / mín–máx, nº de amostras, quantas atrasaram):");
    for (const [nome, r] of Array.from(porNome)) {
      const media = r.dias.reduce((a, b) => a + b, 0) / r.dias.length;
      linhas.push(`- ${nome}: ${media.toFixed(1)} dias (${Math.min(...r.dias)}–${Math.max(...r.dias)}), n=${r.dias.length}, atrasadas=${r.atrasos}`);
    }
  } else {
    linhas.push("", "Ainda não há etapas concluídas com datas reais no histórico — use os dias planejados como referência.");
  }
  if (projetosRecentes.length) {
    linhas.push("", "Projetos recentes do escritório:");
    for (const p of projetosRecentes) {
      const dur = p.prazoFinal ? Math.round((p.prazoFinal.getTime() - p.dataInicio.getTime()) / 86400000) : null;
      linhas.push(`- ${p.nome} — ${p._count.etapas} etapas${dur ? `, prazo total ${dur} dias` : ""} (${p.status.toLowerCase()})`);
    }
  }
  return linhas.join("\n");
}

function blocoDocumento(d: DocumentoEntrada): Anthropic.Beta.BetaContentBlockParam {
  if (d.tipo === "application/pdf") {
    return { type: "document", title: d.nome, source: { type: "base64", media_type: "application/pdf", data: d.dados.toString("base64") } };
  }
  if (MIMES_IMAGEM.includes(d.tipo as MimeImagem)) {
    return { type: "image", source: { type: "base64", media_type: d.tipo as MimeImagem, data: d.dados.toString("base64") } };
  }
  return { type: "text", text: `<documento nome="${d.nome}">\n${d.dados.toString("utf8").slice(0, 200_000)}\n</documento>` };
}

const client = () => new Anthropic();

// Roda em segundo plano depois que o gestor envia os documentos; grava o resultado no banco.
export async function executarLevantamento(
  id: string,
  dados: { titulo: string; cliente: string | null; observacoes: string | null; documentos: DocumentoEntrada[] },
) {
  try {
    const historico = await historicoDoEscritorio();
    const conteudo: Anthropic.Beta.BetaContentBlockParam[] = [];
    for (const d of dados.documentos) {
      if (MIMES_IMAGEM.includes(d.tipo as MimeImagem)) conteudo.push({ type: "text", text: `Imagem: ${d.nome}` });
      conteudo.push(blocoDocumento(d));
    }
    conteudo.push({
      type: "text",
      text: [
        `Projeto: ${dados.titulo}`,
        dados.cliente ? `Cliente: ${dados.cliente}` : null,
        dados.observacoes ? `Observações do gestor:\n${dados.observacoes}` : null,
        "",
        "<historico_do_escritorio>",
        historico,
        "</historico_do_escritorio>",
        "",
        "Faça o levantamento completo deste projeto a partir dos documentos acima.",
      ]
        .filter((l) => l !== null)
        .join("\n"),
    });

    const resposta = await client().beta.messages.parse({
      model: MODELO_IA,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "high", format: betaZodOutputFormat(Levantamento) },
      system: SISTEMA,
      messages: [{ role: "user", content: conteudo }],
    });

    if (resposta.stop_reason === "refusal") {
      throw new Error("A IA não pôde analisar estes documentos. Revise o conteúdo enviado e tente de novo.");
    }
    if (resposta.stop_reason === "max_tokens") {
      throw new Error("O levantamento ficou grande demais e foi interrompido. Envie menos documentos por vez.");
    }
    const resultado = resposta.parsed_output;
    if (!resultado) throw new Error("A IA não devolveu um levantamento válido. Tente novamente.");

    await db.levantamento.update({
      where: { id },
      data: {
        status: "CONCLUIDO",
        resultado,
        modelo: resposta.model,
        tokensEntrada: resposta.usage.input_tokens,
        tokensSaida: resposta.usage.output_tokens,
        concluidoEm: new Date(),
      },
    });
    const lev = await db.levantamento.findUnique({ where: { id }, select: { criadoPorId: true, titulo: true } });
    await avisar([lev?.criadoPorId], { tipo: "projeto", titulo: `Levantamento pronto: ${lev?.titulo ?? ""}`, link: `/ia/${id}` });
  } catch (e) {
    let msg = e instanceof Error ? e.message : "Erro desconhecido.";
    if (e instanceof Anthropic.AuthenticationError) msg = "Chave da API da Anthropic inválida. Confira ANTHROPIC_API_KEY.";
    else if (e instanceof Anthropic.RateLimitError) msg = "Limite de uso da IA atingido. Aguarde alguns minutos e tente de novo.";
    else if (e instanceof Anthropic.BadRequestError) msg = `A IA recusou a requisição: ${e.message.slice(0, 300)}`;
    else if (e instanceof Anthropic.APIError) msg = `Falha na API da IA (${e.status}). Tente novamente.`;
    console.error("[ia] levantamento", id, e);
    await db.levantamento.update({ where: { id }, data: { status: "ERRO", erro: msg.slice(0, 1000), concluidoEm: new Date() } });
  }
}
