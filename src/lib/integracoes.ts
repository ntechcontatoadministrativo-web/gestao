// Integração com o Dynamo (Revit): o token fica salvo só como hash SHA-256.
export const CFG_DYNAMO = "dynamo.tokenHash";

export type CircuitoDynamo = {
  circuito: string;
  descricao: string;
  potencia_va: number;
  fases: string;
  polos?: number;
  tensao_v?: number;
  disjuntor_a?: number;
  secao_mm2?: string;
};

export type PayloadDynamo = {
  projeto: string;
  arquivo?: string;
  quadros: { nome: string; tensao?: string; circuitos: CircuitoDynamo[] }[];
  quantitativos: { item: string; unidade: string; quantidade: number }[];
};

// Soma a potência por fase de um quadro. Circuitos bi/trifásicos dividem a carga entre as fases.
export function resumoQuadro(circuitos: CircuitoDynamo[]) {
  const fases = { A: 0, B: 0, C: 0 };
  let total = 0;
  for (const c of circuitos) {
    total += c.potencia_va;
    const fs = (c.fases || "").toUpperCase().split("").filter((f): f is "A" | "B" | "C" => f === "A" || f === "B" || f === "C");
    if (fs.length) for (const f of fs) fases[f] += c.potencia_va / fs.length;
  }
  const valores = Object.values(fases).filter((v) => v > 0);
  const desequilibrio = valores.length > 1 ? ((Math.max(...valores) - Math.min(...valores)) / Math.max(...valores)) * 100 : 0;
  return { total, fases, desequilibrio };
}
