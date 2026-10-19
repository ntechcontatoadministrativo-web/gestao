import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Calendar, ChevronRight, MapPin, MessageSquare, Paperclip, User } from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import { db } from "@/lib/db";
import { etapaAtrasada, progresso } from "@/lib/consultas";
import { nivelCalculado, podeVerProjeto } from "@/lib/permissoes";
import { modoArmazenamento } from "@/lib/storage";
import { dataParaInput, fmtData } from "@/lib/utils";
import { Avatar, Cabecalho, PrazoBadge, Progresso, StatusEtapaBadge, StatusProjetoBadge, Vazio } from "@/components/ui";
import { TabelaArquivos } from "@/components/tabela-arquivos";
import { EnviarArquivo } from "@/components/upload";
import { AcoesEtapa, AcoesProjeto, CartaoDrive, NovaEtapa } from "./acoes";
import { DadosModelo } from "@/components/dados-modelo";
import { CartaoAreaCliente } from "@/components/area-cliente";
import { urlBase } from "@/lib/auth";
import { fmtMinutos } from "@/lib/utils";

export default async function ProjetoPage({ params }: { params: { id: string } }) {
  const u = await exigirUsuario();
  if (!(await podeVerProjeto(u, params.id))) notFound();
  const gestor = u.perfil === "GESTOR";

  const projeto = await db.projeto.findUnique({
    where: { id: params.id },
    include: {
      etapas: {
        include: {
          responsavel: { select: { id: true, nome: true, ultimoAcesso: true } },
          _count: { select: { comentarios: { where: { sistema: false } }, arquivos: true } },
        },
        orderBy: { ordem: "asc" },
      },
      arquivos: {
        include: {
          etapa: { select: { nome: true, ordem: true } },
          acessos: { select: { usuarioId: true, nivel: true } },
          versoes: { orderBy: { revisao: "desc" }, take: 1, select: { tamanho: true } },
        },
        orderBy: [{ etapaId: "asc" }, { nome: "asc" }],
      },
    },
  });
  if (!projeto) notFound();

  const [pessoas, modo, ultimoModelo, envios, horasProjeto] = await Promise.all([
    gestor ? db.usuario.findMany({ where: { ativo: true }, select: { id: true, nome: true }, orderBy: { nome: "asc" } }) : Promise.resolve([]),
    modoArmazenamento(),
    db.dadosModelo.findFirst({ where: { projetoId: params.id }, orderBy: { recebidoEm: "desc" } }),
    db.dadosModelo.count({ where: { projetoId: params.id } }),
    db.apontamento.aggregate({ where: { projetoId: params.id }, _sum: { minutos: true } }),
  ]);

  const minhasEtapas = new Set(projeto.etapas.filter((e) => e.responsavelId === u.id).map((e) => e.id));
  const etapasVisiveis = gestor ? projeto.etapas : projeto.etapas.filter((e) => minhasEtapas.has(e.id));
  const ocultas = projeto.etapas.length - etapasVisiveis.length;
  const pct = progresso(projeto.etapas);

  const arquivos = projeto.arquivos
    .map((a) => ({
      ...a,
      tamanho: a.versoes[0]?.tamanho ?? 0,
      nivel: nivelCalculado(u, a, minhasEtapas, minhasEtapas.size > 0),
    }))
    .filter((a) => gestor || a.nivel);

  return (
    <>
      <Link href="/projetos" className="mb-4 inline-flex items-center gap-1 text-sm text-ink-400 hover:text-ink-100">
        <ArrowLeft className="h-4 w-4" /> Projetos
      </Link>

      <Cabecalho
        eyebrow={projeto.codigo}
        titulo={projeto.nome}
        descricao={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <StatusProjetoBadge status={projeto.status} />
            {projeto.cliente && (
              <span className="inline-flex items-center gap-1">
                <User className="h-3.5 w-3.5" /> {projeto.cliente}
              </span>
            )}
            {projeto.endereco && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" /> {projeto.endereco}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" /> {fmtData(projeto.dataInicio)} → {fmtData(projeto.prazoFinal)}
            </span>
          </span>
        }
        acoes={
          gestor && (
            <AcoesProjeto
              projeto={{
                id: projeto.id,
                nome: projeto.nome,
                codigo: projeto.codigo,
                cliente: projeto.cliente,
                endereco: projeto.endereco,
                descricao: projeto.descricao,
                status: projeto.status,
                dataInicio: dataParaInput(projeto.dataInicio),
                prazoFinal: dataParaInput(projeto.prazoFinal),
              }}
            />
          )
        }
      />

      {projeto.descricao && <p className="-mt-2 mb-6 max-w-3xl whitespace-pre-line text-sm text-ink-300">{projeto.descricao}</p>}

      <div className="mb-6 card p-5">
        <div className="flex items-center justify-between text-sm">
          <span className="text-ink-300">
            Progresso geral · {projeto.etapas.filter((e) => e.status === "CONCLUIDA").length} de {projeto.etapas.length} etapas concluídas
          </span>
          <span className="text-lg font-bold text-white">{pct}%</span>
        </div>
        <Progresso valor={pct} className="mt-3 h-2" />
        {/* Linha do tempo compacta das etapas */}
        {projeto.etapas.length > 0 && (
          <div className="mt-4 flex gap-1">
            {projeto.etapas.map((e) => (
              <div
                key={e.id}
                title={`${e.nome} — ${e.status.replace(/_/g, " ").toLowerCase()}`}
                className={
                  "h-1.5 flex-1 rounded-full " +
                  (e.status === "CONCLUIDA"
                    ? "bg-neon"
                    : e.status === "AGUARDANDO_APROVACAO"
                      ? "bg-amber-300"
                      : e.status === "EM_ANDAMENTO"
                        ? "bg-sky-400"
                        : etapaAtrasada(e)
                          ? "bg-red-400"
                          : "bg-ink-600")
                }
              />
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <section className="card xl:col-span-2">
          <div className="flex items-center justify-between border-b border-ink-700 px-5 py-4">
            <h2 className="font-semibold text-white">{gestor ? "Etapas" : "Suas etapas"}</h2>
            {gestor && <NovaEtapa projetoId={projeto.id} pessoas={pessoas} />}
          </div>
          {etapasVisiveis.length === 0 ? (
            <Vazio titulo="Nenhuma etapa" texto={gestor ? "Adicione as etapas do projeto." : "Você não tem etapas neste projeto."} />
          ) : (
            <ol className="divide-y divide-ink-800">
              {etapasVisiveis.map((e, i) => (
                <li key={e.id} className="group flex items-center gap-3 px-5 py-4">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ink-800 font-mono text-xs font-bold text-ink-300">
                    {String(e.ordem).padStart(2, "0")}
                  </span>
                  <Link href={`/projetos/${projeto.id}/etapas/${e.id}`} className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-ink-100 group-hover:text-neon">{e.nome}</span>
                      <StatusEtapaBadge status={e.status} />
                      <PrazoBadge prazo={e.prazo} concluida={e.status === "CONCLUIDA"} />
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-400">
                      <span className="inline-flex items-center gap-1.5">
                        {e.responsavel ? (
                          <>
                            <Avatar nome={e.responsavel.nome} online={e.responsavel.ultimoAcesso} tamanho="sm" /> {e.responsavel.nome}
                          </>
                        ) : (
                          <span className="text-amber-300/80">Sem responsável</span>
                        )}
                      </span>
                      <span>Prazo {fmtData(e.prazo)}</span>
                      <span className="inline-flex items-center gap-1">
                        <Paperclip className="h-3 w-3" /> {e._count.arquivos}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" /> {e._count.comentarios}
                      </span>
                    </div>
                  </Link>
                  {gestor ? (
                    <AcoesEtapa
                      etapa={{
                        id: e.id,
                        nome: e.nome,
                        descricao: e.descricao,
                        responsavelId: e.responsavelId,
                        prazo: dataParaInput(e.prazo),
                      }}
                      pessoas={pessoas}
                      primeira={i === 0}
                      ultima={i === etapasVisiveis.length - 1}
                    />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-ink-500" />
                  )}
                </li>
              ))}
            </ol>
          )}
          {ocultas > 0 && (
            <div className="border-t border-ink-800 px-5 py-3 text-xs text-ink-500">
              + {ocultas} etapa(s) sob responsabilidade de outras pessoas.
            </div>
          )}
        </section>

        <div className="space-y-6">
          {gestor && (
            <section className="card p-5">
              <div className="text-xs font-bold uppercase tracking-wider text-ink-400">Horas apontadas</div>
              <div className="mt-1 text-2xl font-bold text-white">{fmtMinutos(horasProjeto._sum.minutos ?? 0)}</div>
              <a href={`/horas?periodo=90`} className="text-xs text-ink-400 hover:text-neon">
                Ver apontamentos
              </a>
            </section>
          )}
          {gestor && (
            <CartaoAreaCliente
              projetoId={projeto.id}
              ativo={projeto.clienteAtivo}
              link={projeto.tokenCliente ? `${urlBase()}/c/${projeto.tokenCliente}` : null}
              nomeProjeto={projeto.nome}
              cliente={projeto.cliente}
              arquivosVisiveis={projeto.arquivos.filter((a) => a.visivelCliente).length}
            />
          )}
          {gestor && <CartaoDrive projetoId={projeto.id} pastaId={projeto.pastaDriveId} modo={modo} />}
        </div>
      </div>

      <section className="card mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-700 px-5 py-4">
          <div>
            <h2 className="font-semibold text-white">Arquivos do projeto</h2>
            <p className="text-xs text-ink-400">{gestor ? "Todos os arquivos, gerais e por etapa." : "Arquivos liberados para você."}</p>
          </div>
          {(gestor || minhasEtapas.size > 0) && (
            <EnviarArquivo
              projetoId={projeto.id}
              ehGestor={gestor}
              etapaId={gestor ? null : etapasVisiveis[0]?.id}
              etapas={etapasVisiveis.map((e) => ({ id: e.id, nome: e.nome, ordem: e.ordem }))}
            />
          )}
        </div>
        {arquivos.length === 0 ? (
          <Vazio titulo="Nenhum arquivo ainda" texto="Envie plantas, memoriais e modelos. Cada novo envio com o mesmo nome vira uma nova revisão (R01, R02…)." />
        ) : (
          <TabelaArquivos arquivos={arquivos} mostrarNivel={!gestor} />
        )}
      </section>

      {ultimoModelo && <DadosModelo registro={ultimoModelo} envios={envios} />}
    </>
  );
}
