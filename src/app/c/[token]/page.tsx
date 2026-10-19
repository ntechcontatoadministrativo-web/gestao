import Link from "next/link";
import { notFound } from "next/navigation";
import { Calendar, CheckCircle2, Circle, Clock3, FileText, Hourglass } from "lucide-react";
import { projetoDoCliente } from "@/lib/cliente";
import { progresso } from "@/lib/consultas";
import { cn, fmtData, fmtDataHora, fmtRevisao } from "@/lib/utils";
import { Logo } from "@/components/logo";
import { Progresso } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Acompanhamento do projeto", robots: { index: false, follow: false } };

const ROTULO = { PENDENTE: "A iniciar", EM_ANDAMENTO: "Em andamento", AGUARDANDO_APROVACAO: "Em revisão", CONCLUIDA: "Concluída" } as const;

// Área pública do cliente final: sem login, só o que o gestor liberou.
export default async function AreaCliente({ params }: { params: { token: string } }) {
  const p = await projetoDoCliente(params.token);
  if (!p) notFound();
  const pct = progresso(p.etapas);
  const atual = p.etapas.find((e) => e.status !== "CONCLUIDA");

  return (
    <div className="min-h-screen">
      <header className="border-b border-ink-700 bg-ink-950">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 sm:px-6">
          <Logo />
          <span className="text-xs text-ink-500">Acompanhamento do cliente</span>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <div className="eyebrow mb-2">{p.codigo}</div>
        <h1 className="text-2xl font-bold text-white sm:text-3xl">{p.nome}</h1>
        {p.cliente && <p className="mt-1 text-ink-300">{p.cliente}</p>}

        <section className="card mt-6 p-6">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-ink-400">Andamento</div>
              <div className="mt-1 text-sm text-ink-300">{atual ? <>Etapa atual: <b className="text-white">{atual.nome}</b></> : "Projeto concluído 🎉"}</div>
            </div>
            <div className="text-3xl font-bold text-neon">{pct}%</div>
          </div>
          <Progresso valor={pct} className="mt-4 h-2.5" />
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-xs text-ink-400">
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" /> Início {fmtData(p.dataInicio)}
            </span>
            {p.prazoFinal && (
              <span className="inline-flex items-center gap-1.5">
                <Clock3 className="h-3.5 w-3.5" /> Entrega prevista {fmtData(p.prazoFinal)}
              </span>
            )}
          </div>
        </section>

        <section className="card mt-6">
          <div className="border-b border-ink-700 px-5 py-4">
            <h2 className="font-semibold text-white">Etapas</h2>
          </div>
          <ol className="divide-y divide-ink-800">
            {p.etapas.map((e) => (
              <li key={e.id} className="flex items-center gap-4 px-5 py-4">
                {e.status === "CONCLUIDA" ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-neon" />
                ) : e.status === "PENDENTE" ? (
                  <Circle className="h-5 w-5 shrink-0 text-ink-500" />
                ) : (
                  <Hourglass className="h-5 w-5 shrink-0 text-sky-300" />
                )}
                <div className="min-w-0 flex-1">
                  <div className={cn("font-medium", e.status === "CONCLUIDA" ? "text-ink-300" : "text-ink-100")}>{e.nome}</div>
                  <div className="text-xs text-ink-500">
                    {e.status === "CONCLUIDA" ? `Concluída em ${fmtData(e.concluidaEm)}` : e.prazo ? `Previsão ${fmtData(e.prazo)}` : ROTULO[e.status]}
                  </div>
                </div>
                <span className="text-xs text-ink-400">{ROTULO[e.status]}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="card mt-6">
          <div className="border-b border-ink-700 px-5 py-4">
            <h2 className="font-semibold text-white">Documentos</h2>
          </div>
          {p.arquivos.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-ink-500">Os documentos aparecerão aqui conforme forem liberados.</p>
          ) : (
            <ul className="divide-y divide-ink-800">
              {p.arquivos.map((a) => (
                <li key={a.id}>
                  <Link href={`/c/${params.token}/arquivo/${a.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-ink-800/40">
                    <FileText className="h-4 w-4 shrink-0 text-ink-400" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink-100">{a.nome}</span>
                      <span className="text-xs text-ink-500">
                        {a.etapa?.nome ?? "Geral"} · atualizado {fmtDataHora(a.atualizadoEm)}
                      </span>
                    </span>
                    <span className="rounded bg-ink-700 px-1.5 py-0.5 font-mono text-[11px] text-ink-100">{fmtRevisao(a.revisaoAtual)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <p className="mt-8 text-center text-xs text-ink-600">NTECH · ntech.dev.br</p>
      </main>
    </div>
  );
}
