"use client";

import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Check, Copy, Download, KeyRound, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import type { ModeloEtapa } from "@prisma/client";
import { alternarModelo, definirPastaRaiz, desconectarDrive, excluirModelo, gerarTokenDynamo, moverModelo, salvarModelo } from "@/actions/config";
import { BotaoConfirmar, BotaoEnviar, Formulario, Modal } from "@/components/client";
import { cn } from "@/lib/utils";

export function FormPastaRaiz() {
  return (
    <Formulario acao={definirPastaRaiz} className="space-y-2">
      <label className="label">Pasta principal (opcional)</label>
      <div className="flex gap-2">
        <input name="pasta" className="input" placeholder="Link de uma pasta existente do Drive" />
        <BotaoEnviar className="btn-secundario shrink-0">Usar</BotaoEnviar>
      </div>
      <p className="text-xs text-ink-500">As pastas dos novos projetos são criadas dentro dela.</p>
    </Formulario>
  );
}

export function BotaoDesconectar() {
  return (
    <BotaoConfirmar acao={() => desconectarDrive()} mensagem="Desconectar? Os arquivos do Drive ficam inacessíveis pelo sistema." rotuloConfirmar="Desconectar">
      Desconectar Drive
    </BotaoConfirmar>
  );
}

function FormModelo({ modelo, fechar }: { modelo?: ModeloEtapa; fechar: () => void }) {
  return (
    <Formulario acao={salvarModelo.bind(null, modelo?.id ?? null)} aoConcluir={fechar} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
        <div>
          <label className="label">Nome</label>
          <input name="nome" defaultValue={modelo?.nome} required className="input" />
        </div>
        <div>
          <label className="label">Dias</label>
          <input name="diasPadrao" type="number" min={1} max={365} defaultValue={modelo?.diasPadrao ?? 7} className="input" />
        </div>
      </div>
      <div>
        <label className="label">Descrição / entregáveis</label>
        <textarea name="descricao" rows={3} defaultValue={modelo?.descricao ?? ""} className="input" />
      </div>
      <div className="flex justify-end">
        <BotaoEnviar>Salvar</BotaoEnviar>
      </div>
    </Formulario>
  );
}

export function ListaModelos({ modelos }: { modelos: ModeloEtapa[] }) {
  const [pendente, iniciar] = useTransition();
  return (
    <>
      <ol className="divide-y divide-ink-800 rounded-xl border border-ink-700">
        {modelos.map((m, i) => (
          <li key={m.id} className={cn("flex items-center gap-3 px-4 py-3", !m.ativo && "opacity-50")}>
            <span className="font-mono text-xs text-neon">{String(i + 1).padStart(2, "0")}</span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-ink-100">{m.nome}</div>
              <div className="text-xs text-ink-400">
                {m.diasPadrao} dias{!m.ativo && " · desativado"}
              </div>
            </div>
            <div className="flex items-center gap-0.5">
              {pendente && <Loader2 className="h-3.5 w-3.5 animate-spin text-ink-400" />}
              <button className="btn-fantasma btn-sm px-2" disabled={i === 0} onClick={() => iniciar(() => moverModelo(m.id, "cima"))} aria-label="Subir">
                <ArrowUp className="h-3.5 w-3.5" />
              </button>
              <button className="btn-fantasma btn-sm px-2" disabled={i === modelos.length - 1} onClick={() => iniciar(() => moverModelo(m.id, "baixo"))} aria-label="Descer">
                <ArrowDown className="h-3.5 w-3.5" />
              </button>
              <Modal
                titulo="Editar etapa padrão"
                gatilho={(abrir) => (
                  <button className="btn-fantasma btn-sm px-2" onClick={abrir} aria-label="Editar">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
              >
                {(fechar) => <FormModelo modelo={m} fechar={fechar} />}
              </Modal>
              <button className="btn-fantasma btn-sm" onClick={() => iniciar(() => alternarModelo(m.id))}>
                {m.ativo ? "Desativar" : "Ativar"}
              </button>
              <BotaoConfirmar acao={() => excluirModelo(m.id)} mensagem="Excluir?" rotuloConfirmar="Sim" className="btn-fantasma btn-sm px-2 text-red-300">
                <Trash2 className="h-3.5 w-3.5" />
              </BotaoConfirmar>
            </div>
          </li>
        ))}
      </ol>
      <Modal
        titulo="Nova etapa padrão"
        gatilho={(abrir) => (
          <button className="btn-secundario btn-sm mt-3" onClick={abrir}>
            <Plus className="h-3.5 w-3.5" /> Adicionar etapa padrão
          </button>
        )}
      >
        {(fechar) => <FormModelo fechar={fechar} />}
      </Modal>
    </>
  );
}

export function CartaoDynamo({ endpoint, temToken }: { endpoint: string; temToken: boolean }) {
  const [token, setToken] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const copiar = async (v: string, k: string) => {
    await navigator.clipboard.writeText(v);
    setCopiado(k);
    setTimeout(() => setCopiado(null), 2000);
  };
  return (
    <div className="space-y-4">
      <div>
        <label className="label">Endereço (URL) para o script</label>
        <div className="flex gap-2">
          <code className="input truncate font-mono text-xs">{endpoint}</code>
          <button type="button" className="btn-secundario shrink-0 px-3" onClick={() => copiar(endpoint, "url")} aria-label="Copiar URL">
            {copiado === "url" ? <Check className="h-4 w-4 text-neon" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>
      </div>
      {token ? (
        <div className="rounded-xl border border-neon/30 bg-neon/[0.05] p-4">
          <div className="mb-2 text-xs font-semibold text-neon">Token gerado. Copie agora: ele não será mostrado de novo.</div>
          <div className="flex gap-2">
            <code className="input truncate font-mono text-xs">{token}</code>
            <button type="button" className="btn-secundario shrink-0 px-3" onClick={() => copiar(token, "tk")} aria-label="Copiar token">
              {copiado === "tk" ? <Check className="h-4 w-4 text-neon" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="btn-secundario"
          disabled={pendente}
          onClick={() => iniciar(async () => setToken(await gerarTokenDynamo()))}
        >
          {pendente ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
          {temToken ? "Gerar novo token (o anterior para de funcionar)" : "Gerar token de acesso"}
        </button>
      )}
      <a href="/dynamo/enviar_ntech.py" download className="btn-fantasma btn-sm">
        <Download className="h-3.5 w-3.5" /> Baixar script Python para o Dynamo
      </a>
    </div>
  );
}
