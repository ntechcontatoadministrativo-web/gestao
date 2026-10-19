"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BarChart3, Bot, CheckSquare, Clock, FolderKanban, LayoutDashboard, LogOut, Menu, Settings, ShieldCheck, Sparkles, UserCog, Users, X, Files } from "lucide-react";
import { Logo } from "./logo";
import { cn, iniciais } from "@/lib/utils";

type Item = { href: string; rotulo: string; icone: React.ElementType };

const ITENS_GESTOR: Item[] = [
  { href: "/painel", rotulo: "Painel", icone: LayoutDashboard },
  { href: "/projetos", rotulo: "Projetos", icone: FolderKanban },
  { href: "/tarefas", rotulo: "Tarefas", icone: CheckSquare },
  { href: "/horas", rotulo: "Horas", icone: Clock },
  { href: "/relatorios", rotulo: "Relatórios", icone: BarChart3 },
  { href: "/assistente", rotulo: "Assistente IA", icone: Bot },
  { href: "/ia", rotulo: "Levantamento IA", icone: Sparkles },
  { href: "/arquivos", rotulo: "Arquivos", icone: Files },
  { href: "/equipe", rotulo: "Equipe", icone: Users },
  { href: "/auditoria", rotulo: "Auditoria", icone: ShieldCheck },
  { href: "/configuracoes", rotulo: "Configurações", icone: Settings },
];

const ITENS_COLAB: Item[] = [
  { href: "/painel", rotulo: "Minhas etapas", icone: LayoutDashboard },
  { href: "/tarefas", rotulo: "Minhas tarefas", icone: CheckSquare },
  { href: "/horas", rotulo: "Minhas horas", icone: Clock },
  { href: "/assistente", rotulo: "Assistente IA", icone: Bot },
  { href: "/projetos", rotulo: "Projetos", icone: FolderKanban },
  { href: "/arquivos", rotulo: "Arquivos", icone: Files },
];

export function Shell({
  usuario,
  pendencias,
  tarefasAbertas,
  children,
}: {
  usuario: { nome: string; email: string; perfil: "GESTOR" | "COLABORADOR" };
  pendencias: number;
  tarefasAbertas: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [aberto, setAberto] = useState(false);
  useEffect(() => setAberto(false), [pathname]);
  const itens = usuario.perfil === "GESTOR" ? ITENS_GESTOR : ITENS_COLAB;

  const nav = (
    <nav className="flex h-full flex-col">
      <div className="px-5 pb-6 pt-6">
        <Logo />
      </div>
      <div className="flex-1 space-y-1 overflow-y-auto px-3">
        {itens.map((i) => {
          const ativo = pathname === i.href || pathname.startsWith(i.href + "/");
          const Icone = i.icone;
          return (
            <Link
              key={i.href}
              href={i.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                ativo ? "bg-neon/10 text-neon" : "text-ink-300 hover:bg-ink-800 hover:text-ink-100",
              )}
            >
              <Icone className="h-[18px] w-[18px]" />
              <span className="flex-1">{i.rotulo}</span>
              {i.href === "/painel" && pendencias > 0 && (
                <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-bold text-amber-300">{pendencias}</span>
              )}
              {i.href === "/tarefas" && tarefasAbertas > 0 && (
                <span className="rounded-full bg-sky-400/20 px-2 py-0.5 text-[10px] font-bold text-sky-300">{tarefasAbertas}</span>
              )}
            </Link>
          );
        })}
      </div>
      <div className="border-t border-ink-700 p-3">
        <Link href="/conta" className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-ink-800">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-ink-700 text-xs font-bold ring-1 ring-ink-600">
            {iniciais(usuario.nome)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-ink-100">{usuario.nome}</span>
            <span className="block truncate text-[11px] text-ink-400">{usuario.perfil === "GESTOR" ? "Gestor" : "Colaborador"}</span>
          </span>
          <UserCog className="h-4 w-4 text-ink-400" />
        </Link>
        <form action="/api/sair" method="post">
          <button className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-ink-400 hover:bg-ink-800 hover:text-red-300">
            <LogOut className="h-4 w-4" /> Sair
          </button>
        </form>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-ink-700 bg-ink-900 lg:block">{nav}</aside>

      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-ink-700 bg-ink-900/90 px-4 py-3 backdrop-blur lg:hidden">
        <Logo subtitulo={false} />
        <button onClick={() => setAberto(true)} className="rounded-lg p-2 text-ink-200 hover:bg-ink-800" aria-label="Abrir menu">
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {aberto && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setAberto(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 border-r border-ink-700 bg-ink-900">
            <button onClick={() => setAberto(false)} className="absolute right-3 top-5 rounded-lg p-2 text-ink-300 hover:bg-ink-800" aria-label="Fechar menu">
              <X className="h-5 w-5" />
            </button>
            {nav}
          </aside>
        </div>
      )}

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
    </div>
  );
}
