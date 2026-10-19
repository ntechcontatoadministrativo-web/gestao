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

  return (
    <Shell usuario={usuario} pendencias={pendencias}>
      <Presenca />
      {children}
    </Shell>
  );
}
