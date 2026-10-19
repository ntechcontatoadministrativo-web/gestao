import { Cpu } from "lucide-react";
import { resumoQuadro, type PayloadDynamo } from "@/lib/integracoes";
import { fmtDataHora } from "@/lib/utils";
import { Badge } from "./ui";

const kva = (va: number) => `${(va / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} kVA`;

export function DadosModelo({ registro, envios }: { registro: { payload: unknown; recebidoEm: Date; arquivoRvt: string | null }; envios: number }) {
  const p = registro.payload as PayloadDynamo;
  const totalGeral = p.quadros.reduce((s, q) => s + resumoQuadro(q.circuitos).total, 0);

  return (
    <section className="card mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-700 px-5 py-4">
        <div>
          <h2 className="flex items-center gap-2 font-semibold text-white">
            <Cpu className="h-4 w-4 text-neon" /> Dados do modelo (Revit · Dynamo)
          </h2>
          <p className="text-xs text-ink-400">
            Último envio {fmtDataHora(registro.recebidoEm)}
            {registro.arquivoRvt && ` · ${registro.arquivoRvt}`} · {envios} envio(s) no total
          </p>
        </div>
        <div className="flex gap-2">
          <Badge tom="verde">{kva(totalGeral)} instalados</Badge>
          <Badge>{p.quadros.length} quadro(s)</Badge>
        </div>
      </div>

      <div className="divide-y divide-ink-800">
        {p.quadros.map((q) => {
          const r = resumoQuadro(q.circuitos);
          return (
            <details key={q.nome} className="group px-5 py-3">
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3">
                <span className="font-medium text-ink-100">{q.nome}</span>
                {q.tensao && <span className="text-xs text-ink-400">{q.tensao}</span>}
                <span className="text-xs text-ink-400">{q.circuitos.length} circuitos</span>
                <span className="ml-auto flex items-center gap-2 text-xs">
                  <span className="font-semibold text-white">{kva(r.total)}</span>
                  {r.desequilibrio > 0 && (
                    <Badge tom={r.desequilibrio > 20 ? "vermelho" : r.desequilibrio > 10 ? "amarelo" : "verde"}>
                      desequilíbrio {r.desequilibrio.toFixed(0)}%
                    </Badge>
                  )}
                  <span className="text-ink-500 group-open:rotate-90">›</span>
                </span>
              </summary>
              <div className="mt-3 overflow-x-auto">
                <table className="tabela">
                  <thead>
                    <tr>
                      <th>Circ.</th>
                      <th>Descrição</th>
                      <th className="text-right">Potência</th>
                      <th>Fases</th>
                      <th className="text-right">Disjuntor</th>
                      <th>Cabo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {q.circuitos.map((c, i) => (
                      <tr key={i}>
                        <td className="font-mono text-xs">{c.circuito}</td>
                        <td className="text-ink-300">{c.descricao}</td>
                        <td className="text-right tabular-nums">{c.potencia_va.toLocaleString("pt-BR")} VA</td>
                        <td className="text-xs">{c.fases || (c.polos ? `${c.polos}P` : "—")}</td>
                        <td className="text-right tabular-nums">{c.disjuntor_a ? `${c.disjuntor_a} A` : "—"}</td>
                        <td className="text-xs text-ink-400">{c.secao_mm2 ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {(r.fases.A || r.fases.B || r.fases.C) > 0 && (
                  <p className="mt-2 text-xs text-ink-400">
                    Fase A {kva(r.fases.A)} · Fase B {kva(r.fases.B)} · Fase C {kva(r.fases.C)}
                  </p>
                )}
              </div>
            </details>
          );
        })}
        {p.quantitativos.length > 0 && (
          <details className="group px-5 py-3">
            <summary className="flex cursor-pointer list-none items-center gap-3">
              <span className="font-medium text-ink-100">Quantitativos</span>
              <span className="text-xs text-ink-400">{p.quantitativos.length} itens</span>
              <span className="ml-auto text-ink-500 group-open:rotate-90">›</span>
            </summary>
            <div className="mt-3 overflow-x-auto">
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th className="text-right">Quantidade</th>
                  </tr>
                </thead>
                <tbody>
                  {p.quantitativos.map((x, i) => (
                    <tr key={i}>
                      <td className="text-ink-300">{x.item}</td>
                      <td className="text-right tabular-nums">
                        {x.quantidade.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} {x.unidade}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}
      </div>
    </section>
  );
}
