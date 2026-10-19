import { exigirUsuario } from "@/lib/auth";
import { Avatar, Cabecalho } from "@/components/ui";
import { FormSenha } from "./form";

export const metadata = { title: "Minha conta" };

export default async function Conta() {
  const u = await exigirUsuario();
  return (
    <div className="mx-auto max-w-xl">
      <Cabecalho eyebrow="Minha conta" titulo="Minha conta" />
      <section className="card mb-6 flex items-center gap-4 p-5">
        <Avatar nome={u.nome} tamanho="lg" />
        <div>
          <div className="font-semibold text-white">{u.nome}</div>
          <div className="text-sm text-ink-400">
            {u.email} · {u.perfil === "GESTOR" ? "Gestor" : "Colaborador"}
            {u.cargo && ` · ${u.cargo}`}
          </div>
        </div>
      </section>
      <section className="card p-5">
        <h2 className="mb-4 font-semibold text-white">Trocar senha</h2>
        <FormSenha />
      </section>
    </div>
  );
}
