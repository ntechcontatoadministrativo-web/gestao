"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { exigirGestor } from "@/lib/auth";

const novoToken = () => randomBytes(18).toString("base64url");

export async function ativarAreaCliente(projetoId: string) {
  await exigirGestor();
  const p = await db.projeto.findUniqueOrThrow({ where: { id: projetoId } });
  await db.projeto.update({ where: { id: projetoId }, data: { clienteAtivo: true, tokenCliente: p.tokenCliente ?? novoToken() } });
  revalidatePath(`/projetos/${projetoId}`);
}

export async function desativarAreaCliente(projetoId: string) {
  await exigirGestor();
  await db.projeto.update({ where: { id: projetoId }, data: { clienteAtivo: false } });
  revalidatePath(`/projetos/${projetoId}`);
}

// Gera um link novo; o anterior para de funcionar na hora.
export async function trocarLinkCliente(projetoId: string) {
  await exigirGestor();
  await db.projeto.update({ where: { id: projetoId }, data: { tokenCliente: novoToken(), clienteAtivo: true } });
  revalidatePath(`/projetos/${projetoId}`);
}

export async function alternarVisivelCliente(arquivoId: string) {
  await exigirGestor();
  const a = await db.arquivo.findUniqueOrThrow({ where: { id: arquivoId } });
  await db.arquivo.update({ where: { id: arquivoId }, data: { visivelCliente: !a.visivelCliente } });
  revalidatePath(`/arquivos/${arquivoId}`);
  revalidatePath(`/projetos/${a.projetoId}`);
}
