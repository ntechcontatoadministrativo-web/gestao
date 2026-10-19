"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import type { Prioridade, StatusTarefa } from "@prisma/client";
import { alterarStatusTarefa, criarTarefa, editarTarefa, excluirTarefa, registrarAviso } from "@/actions/tarefas";
import { BotaoConfirmar, BotaoEnviar, Formulario, Modal } from "@/components/client";
import { BotaoWhatsapp, PainelWhatsapp } from "@/components/whatsapp";

export type OpcoesTarefa = {
  pessoas: { id: string; nome: string }[];
  projetos: { id: string; codigo: string; nome: string; etapas: { id: string; nome: string; ordem: number }[] }[];
};

type DadosTarefa = {
  id?: string;
  titulo?: string;
  descricao?: string | null;
  prioridade?: Prioridade;
  prazo?: string;
  responsavelId?: string;
  projetoId?: string | null;
  etapaId?: string | null;
};

function Campos({ opcoes, t }: { opcoes: OpcoesTarefa; t?: DadosTarefa }) {
  const [projetoId, setProjetoId] = useState(t?.projetoId ?? "");
  const etapas = opcoes.projetos.find((p) => p.id === projetoId)?.etapas ?? [];
  return (
    <>
      <div>
        <label className="label">Tarefa *</label>
        <input name="titulo" defaultValue={t?.titulo} required maxLength={200} className="input" placeholder="Ex.: Revisar quadro de cargas do QDG" />
      </div>
      <div>
        <label className="label">Detalhes</label>
        <textarea name="descricao" defaultValue={t?.descricao ?? ""} rows={3} className="input" placeholder="O que precisa ser feito, referências, critérios de entrega..." />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="sm:col-span-1">
          <label className="label">Para quem *</label>
          <select name="responsavelId" defaultValue={t?.responsavelId ?? ""} required className="input">
            <option value="" disabled>
              Escolha...
            </option>
            {opcoes.pessoas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Prioridade</label>
          <select name="prioridade" defaultValue={t?.prioridade ?? "MEDIA"} className="input">
            <option value="BAIXA">Baixa</option>
            <option value="MEDIA">Média</option>
            <option value="ALTA">Alta</option>
            <option value="URGENTE">Urgente</option>
          </select>
        </div>
        <div>
          <label className="label">Prazo</label>
          <input name="prazo" type="date" defaultValue={t?.prazo} className="input" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Projeto (opcional)</label>
          <select name="projetoId" value={projetoId} onChange={(e) => setProjetoId(e.target.value)} className="input">
            <option value="">Sem projeto</option>
            {opcoes.projetos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.codigo} · {p.nome}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Etapa (opcional)</label>
          <select name="etapaId" key={projetoId} defaultValue={t?.projetoId === projetoId ? (t?.etapaId ?? "") : ""} disabled={!etapas.length} className="input">
            <option value="">—</option>
            {etapas.map((e) => (
              <option key={e.id} value={e.id}>
                {String(e.ordem).padStart(2, "0")} · {e.nome}
              </option>
            ))}
          </select>
        </div>
      </div>
    </>
  );
}

export function NovaTarefa({ opcoes, rotulo = "Nova tarefa", padrao }: { opcoes: OpcoesTarefa; rotulo?: string; padrao?: DadosTarefa }) {
  return (
    <Modal
      titulo="Designar tarefa"
      largura="max-w-2xl"
      gatilho={(abrir) => (
        <button className="btn-primario" onClick={abrir}>
          <Plus className="h-4 w-4" /> {rotulo}
        </button>
      )}
    >
      {(fechar) => <FluxoNovaTarefa opcoes={opcoes} padrao={padrao} fechar={fechar} />}
    </Modal>
  );
}

// Depois de criar, mostra a mensagem de WhatsApp pronta no mesmo modal.
function FluxoNovaTarefa({ opcoes, padrao, fechar }: { opcoes: OpcoesTarefa; padrao?: DadosTarefa; fechar: () => void }) {
  const [criada, setCriada] = useState<Record<string, string> | null>(null);
  if (criada)
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 rounded-lg border border-neon/30 bg-neon/10 px-3 py-2 text-sm text-neon-400">
          <CheckCircle2 className="h-4 w-4" /> Tarefa designada para {criada.nome}. Avise pelo WhatsApp:
        </div>
        <PainelWhatsapp
          mensagem={criada.mensagem}
          telefone={criada.telefone || null}
          nome={criada.nome}
          aoAbrir={() => void registrarAviso(criada.tarefaId)}
        />
        <div className="flex justify-between border-t border-ink-700 pt-3">
          <button className="btn-fantasma btn-sm" onClick={() => setCriada(null)}>
            Criar outra
          </button>
          <button className="btn-secundario btn-sm" onClick={fechar}>
            Fechar
          </button>
        </div>
      </div>
    );
  return (
    <Formulario acao={criarTarefa} aoConcluir={(e) => e.dados && setCriada(e.dados)} className="space-y-4">
      <Campos opcoes={opcoes} t={padrao} />
      <div className="flex justify-end">
        <BotaoEnviar pendente="Salvando...">Designar e gerar mensagem</BotaoEnviar>
      </div>
    </Formulario>
  );
}

export function AcoesTarefaGestor({
  tarefa,
  opcoes,
  whatsapp,
}: {
  tarefa: DadosTarefa & { id: string };
  opcoes: OpcoesTarefa;
  whatsapp: { nome: string; telefone: string | null; mensagem: string };
}) {
  return (
    <>
      <BotaoWhatsapp {...whatsapp} aoAbrir={() => void registrarAviso(tarefa.id)} />
      <Modal
        titulo="Editar tarefa"
        largura="max-w-2xl"
        gatilho={(abrir) => (
          <button className="btn-fantasma btn-sm px-2" onClick={abrir} aria-label="Editar">
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
      >
        {(fechar) => (
          <Formulario acao={editarTarefa.bind(null, tarefa.id)} aoConcluir={fechar} className="space-y-4">
            <Campos opcoes={opcoes} t={tarefa} />
            <div className="flex items-center justify-between">
              <BotaoConfirmar acao={() => excluirTarefa(tarefa.id)} mensagem="Excluir tarefa?" rotuloConfirmar="Excluir">
                <Trash2 className="h-3.5 w-3.5" /> Excluir
              </BotaoConfirmar>
              <BotaoEnviar>Salvar</BotaoEnviar>
            </div>
          </Formulario>
        )}
      </Modal>
    </>
  );
}

export function StatusTarefaControle({ id, status, gestor }: { id: string; status: StatusTarefa; gestor: boolean }) {
  const [pendente, iniciar] = useTransition();
  const mudar = (s: StatusTarefa) => iniciar(() => alterarStatusTarefa(id, s));
  if (status === "A_FAZER")
    return (
      <span className="flex gap-2">
        <button className="btn-secundario btn-sm" disabled={pendente} onClick={() => mudar("FAZENDO")}>
          {pendente && <Loader2 className="h-3 w-3 animate-spin" />} Começar
        </button>
        <button className="btn-primario btn-sm" disabled={pendente} onClick={() => mudar("FEITA")}>
          Concluir
        </button>
      </span>
    );
  if (status === "FAZENDO")
    return (
      <button className="btn-primario btn-sm" disabled={pendente} onClick={() => mudar("FEITA")}>
        {pendente ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} Concluir
      </button>
    );
  return (
    <span className="flex items-center gap-2">
      <span className={status === "FEITA" ? "text-xs font-semibold text-neon" : "text-xs text-ink-400"}>{status === "FEITA" ? "Feita" : "Cancelada"}</span>
      {(gestor || status === "FEITA") && (
        <button className="btn-fantasma btn-sm" disabled={pendente} onClick={() => mudar("A_FAZER")}>
          Reabrir
        </button>
      )}
      {gestor && status !== "CANCELADA" && (
        <button className="btn-fantasma btn-sm" disabled={pendente} onClick={() => mudar("CANCELADA")}>
          Cancelar
        </button>
      )}
    </span>
  );
}
