"use client";

import { useState, useTransition } from "react";
import { Check, Copy, ExternalLink, Eye, EyeOff, Loader2, RefreshCw, UserRound } from "lucide-react";
import { alternarVisivelCliente, ativarAreaCliente, desativarAreaCliente, trocarLinkCliente } from "@/actions/cliente";
import { BotaoConfirmar } from "./client";
import { BotaoWhatsapp } from "./whatsapp";

export function CartaoAreaCliente({
  projetoId,
  ativo,
  link,
  nomeProjeto,
  cliente,
  arquivosVisiveis,
}: {
  projetoId: string;
  ativo: boolean;
  link: string | null;
  nomeProjeto: string;
  cliente: string | null;
  arquivosVisiveis: number;
}) {
  const [pendente, iniciar] = useTransition();
  const [copiado, setCopiado] = useState(false);
  const mensagem = [
    `Olá${cliente ? `, ${cliente.split(" ")[0]}` : ""}! 👋`,
    "",
    `Você pode acompanhar o andamento do projeto *${nomeProjeto}* por este link:`,
    link ?? "",
    "",
    "Lá aparecem as etapas, os prazos e os documentos liberados para você.",
  ].join("\n");

  return (
    <section className="card p-5">
      <div className="flex items-center gap-2">
        <UserRound className="h-4 w-4 text-neon" />
        <h2 className="font-semibold text-white">Área do cliente</h2>
      </div>
      {!ativo || !link ? (
        <>
          <p className="mt-2 text-sm text-ink-400">Gere um link para o cliente acompanhar etapas, prazos e os arquivos que você liberar, sem precisar de login.</p>
          <button className="btn-secundario btn-sm mt-3 w-full" disabled={pendente} onClick={() => iniciar(() => ativarAreaCliente(projetoId))}>
            {pendente && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Ativar área do cliente
          </button>
        </>
      ) : (
        <div className="mt-3 space-y-3">
          <div className="flex gap-2">
            <code className="input truncate py-2 font-mono text-[11px]">{link}</code>
            <button
              type="button"
              className="btn-secundario shrink-0 px-2.5"
              aria-label="Copiar link"
              onClick={async () => {
                await navigator.clipboard.writeText(link);
                setCopiado(true);
                setTimeout(() => setCopiado(false), 2000);
              }}
            >
              {copiado ? <Check className="h-4 w-4 text-neon" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-xs text-ink-400">
            {arquivosVisiveis} arquivo(s) visíveis para o cliente. Libere na tela de cada arquivo, em &quot;Visível para o cliente&quot;.
          </p>
          <div className="flex flex-wrap gap-2">
            <a href={link} target="_blank" rel="noreferrer" className="btn-fantasma btn-sm">
              <ExternalLink className="h-3.5 w-3.5" /> Ver como cliente
            </a>
            <BotaoWhatsapp nome={cliente ?? "o cliente"} telefone={null} mensagem={mensagem} rotulo="Enviar ao cliente" />
          </div>
          <div className="flex flex-wrap gap-2 border-t border-ink-800 pt-3">
            <BotaoConfirmar acao={() => trocarLinkCliente(projetoId)} mensagem="O link atual para de funcionar." rotuloConfirmar="Gerar novo" className="btn-fantasma btn-sm">
              <RefreshCw className="h-3.5 w-3.5" /> Novo link
            </BotaoConfirmar>
            <button className="btn-fantasma btn-sm text-red-300" disabled={pendente} onClick={() => iniciar(() => desativarAreaCliente(projetoId))}>
              Desativar
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

export function BotaoVisivelCliente({ arquivoId, visivel }: { arquivoId: string; visivel: boolean }) {
  const [pendente, iniciar] = useTransition();
  return (
    <button
      type="button"
      disabled={pendente}
      onClick={() => iniciar(() => alternarVisivelCliente(arquivoId))}
      className={visivel ? "btn-secundario btn-sm w-full border-neon/40 text-neon" : "btn-secundario btn-sm w-full"}
    >
      {pendente ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : visivel ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
      {visivel ? "Visível para o cliente" : "Oculto para o cliente"}
    </button>
  );
}
