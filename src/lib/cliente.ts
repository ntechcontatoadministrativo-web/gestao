import "server-only";
import { db } from "./db";

// Projeto da área pública do cliente (link com token, só se estiver ativo).
export async function projetoDoCliente(token: string) {
  if (!/^[\w-]{20,}$/.test(token)) return null;
  return db.projeto.findFirst({
    where: { tokenCliente: token, clienteAtivo: true },
    include: {
      etapas: { orderBy: { ordem: "asc" }, select: { id: true, nome: true, ordem: true, status: true, prazo: true, concluidaEm: true } },
      arquivos: {
        where: { visivelCliente: true },
        orderBy: { atualizadoEm: "desc" },
        include: { etapa: { select: { nome: true } } },
      },
    },
  });
}
