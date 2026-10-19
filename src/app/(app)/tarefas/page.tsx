import Link from "next/link";
import { CheckSquare, Clock, FolderKanban } from "lucide-react";
import type { Prisma, StatusTarefa } from "@prisma/client";
import { exigirUsuario, urlBase } from "@/lib/auth";
import { db } from "@/lib/db";
import { mensagemTarefa } from "@/lib/whatsapp";
import { cn, dataParaInput, fmtData, tempoRelativo } from "@/lib/utils";
import { Avatar, Badge, Cabecalho, PrazoBadge, Vazio } from "@/components/ui";
import { opcoesTarefa } from "@/lib/consultas";
import { whatsappApiAtiva } from "@/lib/whatsapp-api";
import { AcoesTarefaGestor, NovaTarefa, StatusTarefaControle } from "./cliente";

export const metadata = { title: "Tarefas" };

const FILTROS = [
  { v: "abertas", rotulo: "Em aberto" },
  { v: "FEITA", rotulo: "Feitas" },
  { v: "CANCELADA", rotulo: "Canceladas" },
  { v: "todas", rotulo: "Todas" },
] as const;

const TOM_PRIORIDADE = { BAIXA: "neutro", MEDIA: "azul", ALTA: "amarelo", URGENTE: "vermelho" } as const;
const ROTULO_PRIORIDADE = { BAIXA: "Baixa", MEDIA: "Média", ALTA: "Alta", URGENTE: "Urgente" } as const;

export default async function Tarefas({ searchParams }: { searchParams: { status?: string; pessoa?: string; t?: string } }) {
  const u = await exigirUsuario();
  const gestor = u.perfil === "GESTOR";
  const filtro = FILTROS.some((f) => f.v === searchParams.status) ? searchParams.status! : "abertas";

  const where: Prisma.TarefaWhereInput = {
    ...(gestor ? (searchParams.pessoa ? { responsavelId: searchParams.pessoa } : {}) : { responsavelId: u.id }),
    ...(filtro === "abertas" ? { status: { in: ["A_FAZER", "FAZENDO"] as StatusTarefa[] } } : filtro === "todas" ? {} : { status: filtro as StatusTarefa }),
  };

  const [tarefas, opcoes] = await Promise.all([
    db.tarefa.findMany({
      where,
      include: {
        responsavel: { select: { id: true, nome: true, telefone: true, ultimoAcesso: true, missao: true, modeloWhatsapp: true } },
        criadoPor: { select: { nome: true } },
        projeto: { select: { id: true, codigo: true, nome: true, cliente: true } },
        etapa: { select: { id: true, nome: true } },
      },
      orderBy: [{ status: "asc" }, { prazo: { sort: "asc", nulls: "last" } }, { criadoEm: "desc" }],
      take: 300,
    }),
    gestor ? opcoesTarefa() : Promise.resolve(null),
  ]);
  const base = urlBase();
  const ordemPrioridade = { URGENTE: 0, ALTA: 1, MEDIA: 2, BAIXA: 3 };
  tarefas.sort((a, b) => {
    const abertaA = a.status === "A_FAZER" || a.status === "FAZENDO";
    const abertaB = b.status === "A_FAZER" || b.status === "FAZENDO";
    if (abertaA !== abertaB) return abertaA ? -1 : 1;
    return ordemPrioridade[a.prioridade] - ordemPrioridade[b.prioridade] || (a.prazo?.getTime() ?? Infinity) - (b.prazo?.getTime() ?? Infinity);
  });

  const qs = (extra: Record<string, string>) => new URLSearchParams({ ...(searchParams.pessoa ? { pessoa: searchParams.pessoa } : {}), status: filtro, ...extra }).toString();

  return (
    <>
      <Cabecalho
        eyebrow="Tarefas"
        titulo={gestor ? "Tarefas da equipe" : "Minhas tarefas"}
        descricao={gestor ? "Designe tarefas e avise o funcionário pelo WhatsApp com a mensagem pronta." : "Tarefas que o gestor designou para você."}
        acoes={gestor && opcoes && <NovaTarefa opcoes={opcoes} apiAtiva={whatsappApiAtiva()} />}
      />

      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {FILTROS.map((f) => (
            <Link
              key={f.v}
              href={`/tarefas?${qs({ status: f.v })}`}
              className={cn("rounded-lg px-3 py-1.5 text-xs font-semibold transition", filtro === f.v ? "bg-neon text-ink-950" : "bg-ink-800 text-ink-300 hover:bg-ink-700")}
            >
              {f.rotulo}
            </Link>
          ))}
        </div>
        {gestor && opcoes && (
          <form className="flex gap-2">
            <input type="hidden" name="status" value={filtro} />
            <select name="pessoa" defaultValue={searchParams.pessoa ?? ""} className="input py-2 md:w-60">
              <option value="">Todas as pessoas</option>
              {opcoes.pessoas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
            <button className="btn-secundario">Filtrar</button>
          </form>
        )}
      </div>

      {tarefas.length === 0 ? (
        <div className="card">
          <Vazio
            icone={<CheckSquare className="h-8 w-8" />}
            titulo="Nenhuma tarefa aqui"
            texto={gestor ? "Crie uma tarefa e envie o aviso pelo WhatsApp em um clique." : "Quando o gestor designar uma tarefa, ela aparece aqui."}
          />
        </div>
      ) : (
        <ul className="space-y-3">
          {tarefas.map((t) => {
            const aberta = t.status === "A_FAZER" || t.status === "FAZENDO";
            return (
              <li
                key={t.id}
                id={t.id}
                className={cn("card p-4 sm:p-5", searchParams.t === t.id && "border-neon/50 ring-1 ring-neon/30", !aberta && "opacity-70")}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn("font-semibold text-white", t.status === "FEITA" && "line-through decoration-ink-500")}>{t.titulo}</span>
                      <Badge tom={TOM_PRIORIDADE[t.prioridade]}>{ROTULO_PRIORIDADE[t.prioridade]}</Badge>
                      {aberta && <PrazoBadge prazo={t.prazo} />}
                    </div>
                    {t.descricao && <p className="mt-1.5 whitespace-pre-line text-sm text-ink-300">{t.descricao}</p>}
                    <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-400">
                      {gestor && (
                        <span className="inline-flex items-center gap-1.5">
                          <Avatar nome={t.responsavel.nome} online={t.responsavel.ultimoAcesso} tamanho="sm" /> {t.responsavel.nome}
                        </span>
                      )}
                      {t.projeto && (
                        <Link href={`/projetos/${t.projeto.id}`} className="inline-flex items-center gap-1 hover:text-neon">
                          <FolderKanban className="h-3.5 w-3.5" /> {t.projeto.codigo}
                          {t.etapa && ` · ${t.etapa.nome}`}
                        </Link>
                      )}
                      {t.prazo && (
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" /> {fmtData(t.prazo)}
                        </span>
                      )}
                      <span>
                        criada {tempoRelativo(t.criadoEm)}
                        {t.criadoPor && ` por ${t.criadoPor.nome.split(" ")[0]}`}
                      </span>
                      {gestor && t.avisadoEm && <span className="text-[#4ee68a]">avisado no WhatsApp {tempoRelativo(t.avisadoEm)}</span>}
                      {t.concluidaEm && <span className="text-neon">feita {tempoRelativo(t.concluidaEm)}</span>}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                    {(gestor || t.responsavelId === u.id) && <StatusTarefaControle id={t.id} status={t.status} gestor={gestor} />}
                    {gestor && opcoes && (
                      <AcoesTarefaGestor
                        tarefa={{
                          id: t.id,
                          titulo: t.titulo,
                          descricao: t.descricao,
                          prioridade: t.prioridade,
                          prazo: dataParaInput(t.prazo),
                          responsavelId: t.responsavelId,
                          projetoId: t.projetoId,
                          etapaId: t.etapaId,
                        }}
                        opcoes={opcoes}
                        whatsapp={{
                          nome: t.responsavel.nome,
                          telefone: t.responsavel.telefone,
                          usuarioId: t.responsavelId,
                          apiAtiva: whatsappApiAtiva(),
                          mensagem: mensagemTarefa({ ...t, url: `${base}/tarefas?t=${t.id}` }),
                        }}
                      />
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
