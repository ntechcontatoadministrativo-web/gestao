import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, CheckCircle2, FileQuestion, FileText, HelpCircle, ListChecks, Trash2 } from "lucide-react";
import { exigirGestor } from "@/lib/auth";
import { db } from "@/lib/db";
import type { ResultadoLevantamento } from "@/lib/ia/levantamento";
import { dataParaInput, fmtDataHora, fmtTamanho } from "@/lib/utils";
import { Aviso, Badge, Cabecalho } from "@/components/ui";
import { excluirLevantamento } from "@/actions/ia";
import { BotaoConfirmar } from "@/components/client";
import { AtualizarEnquantoProcessa } from "../cliente";
import { FormCriarProjeto } from "./form";

const TOM_IMPACTO = { baixo: "neutro", medio: "amarelo", alto: "vermelho" } as const;
const TOM_COMPLEXIDADE = { baixa: "verde", media: "amarelo", alta: "vermelho" } as const;

export default async function LevantamentoPage({ params }: { params: { id: string } }) {
  await exigirGestor();
  const lev = await db.levantamento.findUnique({
    where: { id: params.id },
    include: { projeto: { select: { id: true, codigo: true, nome: true } }, criadoPor: { select: { nome: true } } },
  });
  if (!lev) notFound();

  // Se o servidor reiniciou no meio da análise, o registro ficaria "processando" para sempre.
  const travado = lev.status === "PROCESSANDO" && Date.now() - lev.criadoEm.getTime() > 15 * 60 * 1000;
  const docs = (lev.documentos as { nome: string; tamanho: number }[]) ?? [];
  const r = lev.status === "CONCLUIDO" ? (lev.resultado as unknown as ResultadoLevantamento) : null;
  const pessoas = r ? await db.usuario.findMany({ where: { ativo: true }, select: { id: true, nome: true }, orderBy: { nome: "asc" } }) : [];

  return (
    <>
      <Link href="/ia" className="mb-4 inline-flex items-center gap-1 text-sm text-ink-400 hover:text-ink-100">
        <ArrowLeft className="h-4 w-4" /> Levantamentos
      </Link>
      <Cabecalho
        eyebrow="Levantamento com IA"
        titulo={lev.titulo}
        descricao={
          <span className="flex flex-wrap items-center gap-2">
            {lev.cliente && <span>{lev.cliente} ·</span>}
            <span>
              {docs.length} documento(s) · {fmtDataHora(lev.criadoEm)}
            </span>
            {r && <Badge tom={TOM_COMPLEXIDADE[r.complexidade]}>Complexidade {r.complexidade}</Badge>}
            {lev.projeto && (
              <Link href={`/projetos/${lev.projeto.id}`}>
                <Badge tom="roxo">Projeto {lev.projeto.codigo}</Badge>
              </Link>
            )}
          </span>
        }
        acoes={
          <BotaoConfirmar acao={excluirLevantamento.bind(null, lev.id)} mensagem="Excluir levantamento?" rotuloConfirmar="Excluir" className="btn-fantasma btn-sm text-red-300">
            <Trash2 className="h-3.5 w-3.5" /> Excluir
          </BotaoConfirmar>
        }
      />

      {lev.status === "PROCESSANDO" && !travado && <AtualizarEnquantoProcessa />}
      {(lev.status === "ERRO" || travado) && (
        <Aviso tom="erro">
          <b>Não foi possível concluir o levantamento.</b> {travado ? "A análise foi interrompida (o servidor reiniciou). Envie os documentos de novo." : lev.erro}
        </Aviso>
      )}

      {r && (
        <div className="grid gap-6 xl:grid-cols-3">
          <div className="space-y-6 xl:col-span-2">
            <section className="card p-6">
              <div className="eyebrow mb-2">{r.tipoProjeto}</div>
              <p className="text-[15px] leading-relaxed text-ink-100">{r.resumo}</p>
            </section>

            {lev.projeto ? (
              <Aviso tom="ok">
                <CheckCircle2 className="mr-1 inline h-4 w-4" /> Projeto criado a partir deste levantamento:{" "}
                <Link href={`/projetos/${lev.projeto.id}`} className="font-semibold underline">
                  {lev.projeto.codigo} · {lev.projeto.nome}
                </Link>
              </Aviso>
            ) : (
              <section className="card">
                <div className="border-b border-ink-700 px-5 py-4">
                  <h2 className="font-semibold text-white">Etapas e prazos propostos</h2>
                  <p className="mt-0.5 text-xs text-ink-400">
                    Total sugerido: <b className="text-ink-200">{r.prazoTotalDias} dias</b>. Ajuste nomes, dias e responsáveis e crie o projeto.
                  </p>
                </div>
                <FormCriarProjeto id={lev.id} titulo={lev.titulo} etapas={r.etapas} pessoas={pessoas} hoje={dataParaInput(new Date())} />
              </section>
            )}

            <section className="card p-5">
              <h2 className="mb-3 flex items-center gap-2 font-semibold text-white">
                <ListChecks className="h-4 w-4 text-neon" /> Escopo
              </h2>
              <ul className="space-y-2.5">
                {r.escopo.map((s, i) => (
                  <li key={i} className="text-sm">
                    <span className="font-semibold text-ink-100">{s.item}</span> <span className="text-ink-300">— {s.descricao}</span>
                  </li>
                ))}
              </ul>
              {r.entregaveis.length > 0 && (
                <>
                  <h3 className="mb-2 mt-5 text-xs font-bold uppercase tracking-wider text-ink-400">Entregáveis</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {r.entregaveis.map((e, i) => (
                      <Badge key={i}>{e}</Badge>
                    ))}
                  </div>
                </>
              )}
            </section>

            <section className="card">
              <div className="border-b border-ink-700 px-5 py-4">
                <h2 className="font-semibold text-white">Dados identificados nos documentos</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="tabela">
                  <thead>
                    <tr>
                      <th>Dado</th>
                      <th>Valor</th>
                      <th>Fonte</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.dadosIdentificados.map((d, i) => (
                      <tr key={i}>
                        <td className="text-ink-300">{d.campo}</td>
                        <td className="font-medium text-ink-100">{d.valor}</td>
                        <td className="text-xs text-ink-400">
                          {/a confirmar|estimativa/i.test(d.fonte) ? <Badge tom="amarelo">{d.fonte}</Badge> : d.fonte}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="card p-5">
              <h2 className="mb-3 font-semibold text-white">Como os prazos foram estimados</h2>
              <p className="whitespace-pre-line text-sm text-ink-300">{r.justificativaPrazos}</p>
              {r.premissas.length > 0 && (
                <>
                  <h3 className="mb-2 mt-5 text-xs font-bold uppercase tracking-wider text-ink-400">Premissas</h3>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-ink-300">
                    {r.premissas.map((p, i) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          </div>

          <aside className="space-y-6">
            <section className="card p-5">
              <h2 className="mb-3 flex items-center gap-2 font-semibold text-white">
                <HelpCircle className="h-4 w-4 text-sky-300" /> Perguntas para o cliente
              </h2>
              <ol className="list-decimal space-y-2 pl-5 text-sm text-ink-200">
                {r.perguntasCliente.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ol>
            </section>
            <section className="card p-5">
              <h2 className="mb-3 flex items-center gap-2 font-semibold text-white">
                <AlertTriangle className="h-4 w-4 text-amber-300" /> Riscos
              </h2>
              <ul className="space-y-3">
                {r.riscos.map((x, i) => (
                  <li key={i} className="text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-ink-100">{x.descricao}</span>
                      <Badge tom={TOM_IMPACTO[x.impacto]}>{x.impacto}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-ink-400">Mitigação: {x.mitigacao}</p>
                  </li>
                ))}
              </ul>
            </section>
            {r.documentosFaltantes.length > 0 && (
              <section className="card p-5">
                <h2 className="mb-3 flex items-center gap-2 font-semibold text-white">
                  <FileQuestion className="h-4 w-4 text-red-300" /> Documentos faltantes
                </h2>
                <ul className="list-disc space-y-1 pl-5 text-sm text-ink-300">
                  {r.documentosFaltantes.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              </section>
            )}
            <section className="card p-5">
              <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-ink-400">Documentos analisados</h2>
              <ul className="space-y-1.5 text-sm">
                {docs.map((d, i) => (
                  <li key={i} className="flex items-center gap-2 text-ink-300">
                    <FileText className="h-3.5 w-3.5 shrink-0 text-ink-500" />
                    <span className="min-w-0 flex-1 truncate">{d.nome}</span>
                    <span className="text-xs text-ink-500">{fmtTamanho(d.tamanho)}</span>
                  </li>
                ))}
              </ul>
              {lev.tokensEntrada != null && (
                <p className="mt-3 text-[11px] text-ink-500">
                  {lev.modelo} · {lev.tokensEntrada.toLocaleString("pt-BR")} tokens lidos · {lev.tokensSaida?.toLocaleString("pt-BR")} gerados
                </p>
              )}
            </section>
          </aside>
        </div>
      )}
    </>
  );
}
