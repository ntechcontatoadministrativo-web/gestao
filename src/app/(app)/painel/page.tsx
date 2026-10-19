import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCheck, Clock, Download, Eye, FileText, Hourglass } from "lucide-react";
import { exigirUsuario, type UsuarioSessao } from "@/lib/auth";
import { db } from "@/lib/db";
import { etapaAtrasada, etapaAtual, progresso, ROTULO_ACAO } from "@/lib/consultas";
import { filtroArquivosVisiveis } from "@/lib/permissoes";
import { diasAte, estaOnline, fmtData, fmtRevisao, hojeInicio, tempoRelativo, ONLINE_JANELA_MS } from "@/lib/utils";
import { Avatar, Badge, Cabecalho, Kpi, PrazoBadge, Progresso, StatusEtapaBadge, Vazio } from "@/components/ui";
import { BotoesAprovacao, BotoesFluxo } from "./botoes";

export const metadata = { title: "Painel" };

export default async function Painel() {
  const u = await exigirUsuario();
  return u.perfil === "GESTOR" ? <PainelGestor u={u} /> : <PainelColaborador u={u} />;
}

async function PainelGestor({ u }: { u: UsuarioSessao }) {
  const hoje = hojeInicio();
  const em2dias = new Date(hoje.getTime() + 3 * 86400000);
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);

  const [projetos, aguardando, alertas, equipe, logs] = await Promise.all([
    db.projeto.findMany({
      where: { status: "ATIVO" },
      include: { etapas: { include: { responsavel: { select: { nome: true } } }, orderBy: { ordem: "asc" } } },
      orderBy: [{ prazoFinal: "asc" }, { criadoEm: "desc" }],
    }),
    db.etapa.findMany({
      where: { status: "AGUARDANDO_APROVACAO" },
      include: { projeto: { select: { id: true, codigo: true, nome: true } }, responsavel: { select: { nome: true } } },
      orderBy: { enviadaEm: "asc" },
    }),
    db.etapa.findMany({
      where: { status: { not: "CONCLUIDA" }, prazo: { lt: em2dias }, projeto: { status: "ATIVO" } },
      include: { projeto: { select: { id: true, codigo: true, nome: true } }, responsavel: { select: { nome: true, ultimoAcesso: true } } },
      orderBy: { prazo: "asc" },
      take: 12,
    }),
    db.usuario.findMany({
      where: { ativo: true },
      include: { etapas: { where: { projeto: { status: "ATIVO" } }, select: { status: true, prazo: true, concluidaEm: true } } },
      orderBy: { nome: "asc" },
    }),
    db.logAcesso.findMany({
      where: { acao: { in: ["VISUALIZOU", "BAIXOU", "ENVIOU", "NOVA_REVISAO", "ACESSO_NEGADO"] } },
      include: { usuario: { select: { nome: true } }, arquivo: { select: { id: true, nome: true } }, versao: { select: { revisao: true } } },
      orderBy: { criadoEm: "desc" },
      take: 10,
    }),
  ]);

  const todasEtapas = projetos.flatMap((p) => p.etapas);
  const atrasadas = todasEtapas.filter(etapaAtrasada).length;
  const online = equipe.filter((m) => estaOnline(m.ultimoAcesso));

  return (
    <>
      <Cabecalho
        eyebrow="Painel do gestor"
        titulo={`Olá, ${u.nome.split(" ")[0]}`}
        descricao="Acompanhe o andamento de todos os projetos e da equipe."
        acoes={
          <Link href="/projetos/novo" className="btn-primario">
            Novo projeto
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi rotulo="Projetos ativos" valor={projetos.length} />
        <Kpi rotulo="Em andamento" valor={todasEtapas.filter((e) => e.status === "EM_ANDAMENTO").length} detalhe="etapas" />
        <Kpi rotulo="Para aprovar" valor={aguardando.length} detalhe="etapas aguardando você" destaque={aguardando.length > 0} />
        <Kpi rotulo="Atrasadas" valor={<span className={atrasadas ? "text-red-300" : ""}>{atrasadas}</span>} detalhe="etapas fora do prazo" />
        <Kpi rotulo="Online agora" valor={online.length} detalhe={online.map((o) => o.nome.split(" ")[0]).join(", ") || "ninguém"} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          {aguardando.length > 0 && (
            <section className="card border-amber-400/25">
              <div className="flex items-center gap-2 border-b border-ink-700 px-5 py-4">
                <Hourglass className="h-4 w-4 text-amber-300" />
                <h2 className="font-semibold text-white">Aguardando sua aprovação</h2>
              </div>
              <ul className="divide-y divide-ink-800">
                {aguardando.map((e) => (
                  <li key={e.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <Link href={`/projetos/${e.projeto.id}/etapas/${e.id}`} className="font-medium text-ink-100 hover:text-neon">
                        {e.nome}
                      </Link>
                      <div className="mt-0.5 text-xs text-ink-400">
                        {e.projeto.codigo} · {e.projeto.nome} · enviada por {e.responsavel?.nome ?? "—"} {tempoRelativo(e.enviadaEm)}
                      </div>
                    </div>
                    <BotoesAprovacao etapaId={e.id} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="card">
            <div className="flex items-center justify-between border-b border-ink-700 px-5 py-4">
              <h2 className="font-semibold text-white">Progresso por projeto</h2>
              <Link href="/projetos" className="text-xs font-semibold text-ink-400 hover:text-neon">
                Ver todos
              </Link>
            </div>
            {projetos.length === 0 ? (
              <Vazio titulo="Nenhum projeto ativo" texto="Cadastre o primeiro projeto para começar." acao={<Link href="/projetos/novo" className="btn-primario btn-sm">Novo projeto</Link>} />
            ) : (
              <ul className="divide-y divide-ink-800">
                {projetos.map((p) => {
                  const pct = progresso(p.etapas);
                  const atual = etapaAtual(p.etapas);
                  const atr = p.etapas.filter(etapaAtrasada).length;
                  return (
                    <li key={p.id}>
                      <Link href={`/projetos/${p.id}`} className="block px-5 py-4 transition hover:bg-ink-800/50">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate font-medium text-ink-100">
                              <span className="mr-2 font-mono text-xs text-ink-400">{p.codigo}</span>
                              {p.nome}
                            </div>
                            <div className="mt-0.5 truncate text-xs text-ink-400">
                              {atual ? (
                                <>
                                  Etapa atual: <span className="text-ink-200">{atual.nome}</span>
                                  {atual.responsavel && <> · {atual.responsavel.nome}</>}
                                </>
                              ) : p.etapas.length ? (
                                "Todas as etapas concluídas"
                              ) : (
                                "Sem etapas"
                              )}
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            {atr > 0 && <Badge tom="vermelho">{atr} atrasada{atr > 1 && "s"}</Badge>}
                            {p.prazoFinal && <span className="hidden text-xs text-ink-400 sm:inline">até {fmtData(p.prazoFinal)}</span>}
                            <span className="w-10 text-right text-sm font-semibold tabular-nums text-white">{pct}%</span>
                          </div>
                        </div>
                        <Progresso valor={pct} className="mt-3" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="card">
            <div className="border-b border-ink-700 px-5 py-4">
              <h2 className="font-semibold text-white">Progresso por funcionário</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Pessoa</th>
                    <th className="text-center">Em aberto</th>
                    <th className="text-center">Atrasadas</th>
                    <th className="text-center">Concluídas no mês</th>
                    <th>Último acesso</th>
                  </tr>
                </thead>
                <tbody>
                  {equipe.map((m) => {
                    const abertas = m.etapas.filter((e) => e.status !== "CONCLUIDA").length;
                    const atr = m.etapas.filter(etapaAtrasada).length;
                    const mes = m.etapas.filter((e) => e.concluidaEm && e.concluidaEm >= inicioMes).length;
                    return (
                      <tr key={m.id}>
                        <td>
                          <Link href={`/equipe/${m.id}`} className="flex items-center gap-3 hover:text-neon">
                            <Avatar nome={m.nome} online={m.ultimoAcesso} tamanho="sm" />
                            <span className="font-medium">{m.nome}</span>
                          </Link>
                        </td>
                        <td className="text-center tabular-nums">{abertas}</td>
                        <td className="text-center tabular-nums">{atr ? <span className="text-red-300">{atr}</span> : "0"}</td>
                        <td className="text-center tabular-nums">{mes}</td>
                        <td className="text-xs text-ink-400">
                          {estaOnline(m.ultimoAcesso) ? <span className="text-neon">online</span> : tempoRelativo(m.ultimoAcesso)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="card">
            <div className="flex items-center gap-2 border-b border-ink-700 px-5 py-4">
              <AlertTriangle className="h-4 w-4 text-red-300" />
              <h2 className="font-semibold text-white">Alertas de prazo</h2>
            </div>
            {alertas.length === 0 ? (
              <Vazio titulo="Tudo dentro do prazo" texto="Nenhuma etapa atrasada ou vencendo nos próximos dias." />
            ) : (
              <ul className="divide-y divide-ink-800">
                {alertas.map((e) => (
                  <li key={e.id} className="px-5 py-3">
                    <Link href={`/projetos/${e.projeto.id}/etapas/${e.id}`} className="block">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-medium text-ink-100">{e.nome}</span>
                        <PrazoBadge prazo={e.prazo} />
                      </div>
                      <div className="mt-0.5 text-xs text-ink-400">
                        {e.projeto.codigo} · {e.responsavel?.nome ?? "sem responsável"} · {fmtData(e.prazo)}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card">
            <div className="flex items-center justify-between border-b border-ink-700 px-5 py-4">
              <h2 className="font-semibold text-white">Acessos recentes</h2>
              <Link href="/auditoria" className="text-xs font-semibold text-ink-400 hover:text-neon">
                Auditoria
              </Link>
            </div>
            {logs.length === 0 ? (
              <Vazio titulo="Sem acessos ainda" />
            ) : (
              <ul className="divide-y divide-ink-800">
                {logs.map((l) => (
                  <li key={l.id} className="flex items-start gap-3 px-5 py-3 text-sm">
                    <span className="mt-0.5 text-ink-400">
                      {l.acao === "BAIXOU" ? <Download className="h-4 w-4" /> : l.acao === "VISUALIZOU" ? <Eye className="h-4 w-4" /> : l.acao === "ACESSO_NEGADO" ? <AlertTriangle className="h-4 w-4 text-red-300" /> : <FileText className="h-4 w-4" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate">
                        <span className="font-medium text-ink-100">{l.usuario?.nome ?? "—"}</span>{" "}
                        <span className="text-ink-400">{ROTULO_ACAO[l.acao].toLowerCase()}</span>
                      </div>
                      {l.arquivo && (
                        <Link href={`/arquivos/${l.arquivo.id}`} className="block truncate text-xs text-ink-300 hover:text-neon">
                          {l.arquivo.nome} {l.versao && `· ${fmtRevisao(l.versao.revisao)}`}
                        </Link>
                      )}
                    </div>
                    <span className="shrink-0 text-[11px] text-ink-500">{tempoRelativo(l.criadoEm)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

async function PainelColaborador({ u }: { u: UsuarioSessao }) {
  const [etapas, arquivos] = await Promise.all([
    db.etapa.findMany({
      where: { responsavelId: u.id, projeto: { status: { in: ["ATIVO", "PAUSADO"] } } },
      include: { projeto: { select: { id: true, codigo: true, nome: true, status: true } }, _count: { select: { comentarios: true, arquivos: true } } },
      orderBy: [{ prazo: "asc" }, { ordem: "asc" }],
    }),
    db.arquivo.findMany({
      where: filtroArquivosVisiveis(u.id),
      include: { projeto: { select: { codigo: true } } },
      orderBy: { atualizadoEm: "desc" },
      take: 8,
    }),
  ]);

  const abertas = etapas.filter((e) => e.status === "PENDENTE" || e.status === "EM_ANDAMENTO");
  const aguardando = etapas.filter((e) => e.status === "AGUARDANDO_APROVACAO");
  const concluidas = etapas.filter((e) => e.status === "CONCLUIDA");
  const atrasadas = etapas.filter(etapaAtrasada);

  return (
    <>
      <Cabecalho eyebrow="Minhas etapas" titulo={`Olá, ${u.nome.split(" ")[0]}`} descricao="Aqui estão as etapas sob sua responsabilidade." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi rotulo="Para fazer" valor={abertas.length} destaque={abertas.length > 0} />
        <Kpi rotulo="Atrasadas" valor={<span className={atrasadas.length ? "text-red-300" : ""}>{atrasadas.length}</span>} />
        <Kpi rotulo="Em aprovação" valor={aguardando.length} detalhe="aguardando o gestor" />
        <Kpi rotulo="Concluídas" valor={concluidas.length} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <section className="card xl:col-span-2">
          <div className="border-b border-ink-700 px-5 py-4">
            <h2 className="font-semibold text-white">Etapas em aberto</h2>
          </div>
          {abertas.length + aguardando.length === 0 ? (
            <Vazio icone={<CheckCheck className="h-8 w-8" />} titulo="Nada pendente" texto="Quando o gestor designar uma etapa para você, ela aparece aqui." />
          ) : (
            <ul className="divide-y divide-ink-800">
              {[...abertas, ...aguardando].map((e) => (
                <li key={e.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/projetos/${e.projeto.id}/etapas/${e.id}`} className="font-medium text-ink-100 hover:text-neon">
                        {e.nome}
                      </Link>
                      <StatusEtapaBadge status={e.status} />
                      <PrazoBadge prazo={e.prazo} concluida={e.status === "CONCLUIDA"} />
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-ink-400">
                      <span>
                        {e.projeto.codigo} · {e.projeto.nome}
                      </span>
                      {e.prazo && (
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {fmtData(e.prazo)}
                          {diasAte(e.prazo) >= 0 && ` (${diasAte(e.prazo)}d)`}
                        </span>
                      )}
                      <span>{e._count.arquivos} arquivo(s)</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <BotoesFluxo etapaId={e.id} status={e.status} />
                    <Link href={`/projetos/${e.projeto.id}/etapas/${e.id}`} className="btn-fantasma btn-sm">
                      Abrir <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <div className="flex items-center justify-between border-b border-ink-700 px-5 py-4">
            <h2 className="font-semibold text-white">Arquivos liberados</h2>
            <Link href="/arquivos" className="text-xs font-semibold text-ink-400 hover:text-neon">
              Todos
            </Link>
          </div>
          {arquivos.length === 0 ? (
            <Vazio titulo="Nenhum arquivo liberado" />
          ) : (
            <ul className="divide-y divide-ink-800">
              {arquivos.map((a) => (
                <li key={a.id}>
                  <Link href={`/arquivos/${a.id}`} className="flex items-center gap-3 px-5 py-3 text-sm hover:bg-ink-800/50">
                    <FileText className="h-4 w-4 shrink-0 text-ink-400" />
                    <span className="min-w-0 flex-1 truncate">{a.nome}</span>
                    <span className="font-mono text-[11px] text-ink-400">
                      {a.projeto.codigo} · {fmtRevisao(a.revisaoAtual)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <p className="mt-6 text-center text-[11px] text-ink-500">Online = ativo nos últimos {ONLINE_JANELA_MS / 60000} minutos.</p>
    </>
  );
}
