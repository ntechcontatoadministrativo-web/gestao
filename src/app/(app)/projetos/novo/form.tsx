"use client";

import { useState } from "react";
import type { ModeloEtapa } from "@prisma/client";
import { criarProjeto } from "@/actions/projetos";
import { BotaoEnviar, Formulario } from "@/components/client";

export function FormNovoProjeto({
  modelos,
  pessoas,
  hoje,
}: {
  modelos: ModeloEtapa[];
  pessoas: { id: string; nome: string }[];
  hoje: string;
}) {
  const [usarModelo, setUsarModelo] = useState(modelos.length > 0);
  const [inicio, setInicio] = useState(hoje);

  // Prévia dos prazos sugeridos (mesma regra do servidor).
  let cursor = new Date(`${inicio}T12:00:00`).getTime();
  const previa = modelos.map((m) => {
    cursor += m.diasPadrao * 86400000;
    return new Date(cursor).toLocaleDateString("pt-BR");
  });

  return (
    <Formulario acao={criarProjeto} className="space-y-6">
      <section className="card space-y-4 p-5">
        <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
          <div>
            <label className="label">Nome do projeto *</label>
            <input name="nome" required className="input" placeholder="Ex.: Subestação 225 kVA — Galpão Industrial" />
          </div>
          <div>
            <label className="label">Código</label>
            <input name="codigo" className="input font-mono uppercase" placeholder="Automático" />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Cliente</label>
            <input name="cliente" className="input" />
          </div>
          <div>
            <label className="label">Endereço da obra</label>
            <input name="endereco" className="input" />
          </div>
        </div>
        <div>
          <label className="label">Descrição / escopo</label>
          <textarea name="descricao" rows={3} className="input" placeholder="Resumo do que será entregue" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Início</label>
            <input name="dataInicio" type="date" className="input" value={inicio} onChange={(e) => setInicio(e.target.value)} />
          </div>
          <div>
            <label className="label">Prazo final de entrega</label>
            <input name="prazoFinal" type="date" className="input" />
            <p className="mt-1 text-xs text-ink-400">Em branco: usa o prazo da última etapa.</p>
          </div>
        </div>
      </section>

      {modelos.length > 0 && (
        <section className="card p-5">
          <label className="flex cursor-pointer items-center gap-3">
            <input type="checkbox" name="usarModelo" checked={usarModelo} onChange={(e) => setUsarModelo(e.target.checked)} className="h-4 w-4 accent-[#5CFF4F]" />
            <span>
              <span className="block font-medium text-white">Criar com as etapas padrão</span>
              <span className="block text-xs text-ink-400">Defina já os responsáveis de cada etapa (opcional).</span>
            </span>
          </label>

          {usarModelo && (
            <ol className="mt-4 divide-y divide-ink-800 rounded-xl border border-ink-700">
              {modelos.map((m, i) => (
                <li key={m.id} className="grid items-center gap-3 px-4 py-3 sm:grid-cols-[1fr_200px]">
                  <div>
                    <div className="text-sm font-medium text-ink-100">
                      <span className="mr-2 font-mono text-xs text-neon">{String(i + 1).padStart(2, "0")}</span>
                      {m.nome}
                    </div>
                    <div className="text-xs text-ink-400">
                      {m.diasPadrao} dias · prazo sugerido {previa[i]}
                    </div>
                  </div>
                  <select name={`resp_${m.id}`} className="input py-2" defaultValue="">
                    <option value="">Sem responsável</option>
                    {pessoas.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome}
                      </option>
                    ))}
                  </select>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}

      <div className="flex justify-end">
        <BotaoEnviar pendente="Criando...">Criar projeto</BotaoEnviar>
      </div>
    </Formulario>
  );
}
