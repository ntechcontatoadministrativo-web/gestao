import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, FileWarning } from "lucide-react";
import { db } from "@/lib/db";
import { projetoDoCliente } from "@/lib/cliente";
import { visualizavel } from "@/lib/storage";
import { infoRequisicao } from "@/lib/auth";
import { fmtDataHora, fmtRevisao, fmtTamanho } from "@/lib/utils";
import { Logo } from "@/components/logo";
import { VisualizadorImagem, VisualizadorPdf } from "@/components/visualizador";

export const dynamic = "force-dynamic";
export const metadata = { title: "Documento", robots: { index: false, follow: false } };

export default async function ArquivoCliente({ params }: { params: { token: string; id: string } }) {
  const p = await projetoDoCliente(params.token);
  const arquivo = p?.arquivos.find((a) => a.id === params.id);
  if (!p || !arquivo) notFound();
  const versao = await db.arquivoVersao.findFirst({ where: { arquivoId: arquivo.id }, orderBy: { revisao: "desc" } });
  if (!versao) notFound();

  const { ip, userAgent } = infoRequisicao();
  if (visualizavel(versao.mimeType)) {
    await db.logAcesso.create({
      data: { acao: "VISUALIZOU", arquivoId: arquivo.id, versaoId: versao.id, detalhe: `Cliente final${p.cliente ? ` (${p.cliente})` : ""}`, ip, userAgent },
    });
  }
  const base = `/api/c/${params.token}/arquivos/${arquivo.id}`;
  const marca = `${p.cliente ?? "Cliente"} · ${p.codigo} · ${fmtDataHora(new Date())}`;

  return (
    <div className="min-h-screen">
      <header className="border-b border-ink-700 bg-ink-950">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <Logo />
          <a href={`${base}?modo=baixar`} className="btn-primario btn-sm">
            <Download className="h-3.5 w-3.5" /> Baixar {fmtRevisao(versao.revisao)}
          </a>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <Link href={`/c/${params.token}`} className="mb-3 inline-flex items-center gap-1 text-sm text-ink-400 hover:text-ink-100">
          <ArrowLeft className="h-4 w-4" /> {p.nome}
        </Link>
        <h1 className="text-xl font-bold text-white">{arquivo.nome}</h1>
        <p className="mb-5 mt-1 text-sm text-ink-400">
          {fmtRevisao(versao.revisao)} · {fmtTamanho(versao.tamanho)} · {fmtDataHora(versao.criadoEm)}
        </p>
        <section className="card p-3 sm:p-4">
          {versao.mimeType === "application/pdf" ? (
            <VisualizadorPdf src={`${base}?modo=ver`} marca={marca} />
          ) : versao.mimeType.startsWith("image/") ? (
            <VisualizadorImagem src={`${base}?modo=ver`} marca={marca} alt={arquivo.nome} />
          ) : (
            <div className="flex flex-col items-center py-16 text-center">
              <FileWarning className="h-8 w-8 text-ink-500" />
              <p className="mt-3 text-sm text-ink-300">Este formato não abre no navegador. Use o botão Baixar.</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
