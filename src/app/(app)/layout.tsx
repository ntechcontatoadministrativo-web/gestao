import { exigirUsuario } from "@/lib/auth";
import { db } from "@/lib/db";
import { Shell } from "@/components/shell";
import { Presenca } from "@/components/client";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const usuario = await exigirUsuario();
  const pendencias =
    usuario.perfil === "GESTOR"
      ? await db.etapa.count({ where: { status: "AGUARDANDO_APROVACAO" } })
      : await db.etapa.count({ where: { responsavelId: usuario.id, status: { in: ["PENDENTE", "EM_ANDAMENTO"] } } });

  const tarefasAbertas = await db.tarefa.count({
    where: { status: { in: ["A_FAZER", "FAZENDO"] }, ...(usuario.perfil === "GESTOR" ? {} : { responsavelId: usuario.id }) },
  });

  return (
    <Shell usuario={usuario} pendencias={pendencias} tarefasAbertas={tarefasAbertas}>
      <Presenca />
      {children}
    </Shell>
  );
}
