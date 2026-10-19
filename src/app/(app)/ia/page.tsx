import Link from "next/link";
import { FileSearch, Sparkles } from "lucide-react";
import { exigirGestor } from "@/lib/auth";
import { db } from "@/lib/db";
import { iaConfigurada } from "@/lib/ia/levantamento";
import { fmtDataHora } from "@/lib/utils";
import { Aviso, Badge, Cabecalho, Vazio } from "@/components/ui";
import { NovoLevantamento } from "./cliente";

export const metadata = { title: "Levantamento IA" };

export default async function PaginaIA() {
  await exigirGestor();
  const levantamentos = await db.levantamento.findMany({
    include: { criadoPor: { select: { nome: true } }, projeto: { select: { id: true, codigo: true } } },
    orderBy: { criadoEm: "desc" },
    take: 100,
  });
  const configurada = iaConfigurada();

  return (
    <>
      <Cabecalho
        eyebrow="Fase 2 · Inteligência"
        titulo={
          <span className="flex items-center gap-3">
            <Sparkles className="h-7 w-7 text-neon" /> Levantamento com IA
          </span>
        }
        descricao="Envie os documentos do cliente (memorial, plantas, fotos). A IA lê tudo e propõe escopo, etapas e prazos com base no histórico do escritório."
      />

      {!configurada && (
        <div className="mb-6">
          <Aviso tom="alerta">
            Para ativar a IA, crie uma chave em <b>console.anthropic.com</b> e adicione a variável <code>ANTHROPIC_API_KEY</code> no servidor (Render →
            Environment). O custo é por uso, conforme o volume de documentos analisados.
          </Aviso>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,420px)_1fr]">
        <section className="card p-5">
          <h2 className="mb-4 font-semibold text-white">Novo levantamento</h2>
          <NovoLevantamento desabilitado={!configurada} />
        </section>

        <section className="card">
          <div className="border-b border-ink-700 px-5 py-4">
            <h2 className="font-semibold text-white">Levantamentos</h2>
          </div>
          {levantamentos.length === 0 ? (
            <Vazio icone={<FileSearch className="h-8 w-8" />} titulo="Nenhum levantamento ainda" texto="O resultado fica salvo aqui e vira projeto com um clique." />
          ) : (
            <ul className="divide-y divide-ink-800">
              {levantamentos.map((l) => {
                const docs = (l.documentos as { nome: string }[]) ?? [];
                return (
                  <li key={l.id}>
                    <Link href={`/ia/${l.id}`} className="flex items-center gap-3 px-5 py-4 hover:bg-ink-800/40">
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium text-ink-100">{l.titulo}</div>
                        <div className="mt-0.5 truncate text-xs text-ink-400">
                          {l.cliente && `${l.cliente} · `}
                          {docs.length} documento(s) · {fmtDataHora(l.criadoEm)}
                          {l.criadoPor && ` · ${l.criadoPor.nome.split(" ")[0]}`}
                        </div>
                      </div>
                      {l.projeto && <Badge tom="roxo">{l.projeto.codigo}</Badge>}
                      {l.status === "PROCESSANDO" ? (
                        <Badge tom="azul">Analisando…</Badge>
                      ) : l.status === "ERRO" ? (
                        <Badge tom="vermelho">Erro</Badge>
                      ) : (
                        <Badge tom="verde">Pronto</Badge>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
