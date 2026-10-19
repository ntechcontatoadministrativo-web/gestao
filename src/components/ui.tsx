import type { StatusEtapa, StatusProjeto, NivelAcesso } from "@prisma/client";
import { cn, iniciais, estaOnline, diasAte } from "@/lib/utils";

export function Cabecalho({
  eyebrow,
  titulo,
  descricao,
  acoes,
}: {
  eyebrow?: string;
  titulo: React.ReactNode;
  descricao?: React.ReactNode;
  acoes?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="eyebrow mb-2">{eyebrow}</div>}
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">{titulo}</h1>
        {descricao && <p className="mt-1.5 text-sm text-ink-300">{descricao}</p>}
      </div>
      {acoes && <div className="flex flex-wrap items-center gap-2">{acoes}</div>}
    </div>
  );
}

export function Progresso({ valor, className }: { valor: number; className?: string }) {
  const v = Math.max(0, Math.min(100, valor));
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-ink-700", className)}>
      <div className="h-full rounded-full bg-neon transition-all" style={{ width: `${v}%` }} />
    </div>
  );
}

export function Avatar({
  nome,
  online,
  tamanho = "md",
}: {
  nome: string;
  online?: Date | null | boolean;
  tamanho?: "sm" | "md" | "lg";
}) {
  const on = typeof online === "boolean" ? online : online !== undefined ? estaOnline(online) : undefined;
  const t = { sm: "h-7 w-7 text-[10px]", md: "h-9 w-9 text-xs", lg: "h-12 w-12 text-sm" }[tamanho];
  return (
    <span className="relative inline-flex shrink-0">
      <span className={cn("inline-flex items-center justify-center rounded-full bg-ink-700 font-bold text-ink-100 ring-1 ring-ink-600", t)}>
        {iniciais(nome)}
      </span>
      {on !== undefined && (
        <span
          title={on ? "Online" : "Offline"}
          className={cn(
            "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-ink-850",
            on ? "bg-neon" : "bg-ink-500",
          )}
        />
      )}
    </span>
  );
}

export function Badge({ children, tom = "neutro", className }: { children: React.ReactNode; tom?: Tom; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-semibold", TONS[tom], className)}>
      {children}
    </span>
  );
}

type Tom = "neutro" | "verde" | "amarelo" | "vermelho" | "azul" | "roxo";
const TONS: Record<Tom, string> = {
  neutro: "bg-ink-700 text-ink-200",
  verde: "bg-neon/15 text-neon",
  amarelo: "bg-amber-400/15 text-amber-300",
  vermelho: "bg-red-500/15 text-red-300",
  azul: "bg-sky-400/15 text-sky-300",
  roxo: "bg-violet-400/15 text-violet-300",
};

export const ROTULO_ETAPA: Record<StatusEtapa, string> = {
  PENDENTE: "Pendente",
  EM_ANDAMENTO: "Em andamento",
  AGUARDANDO_APROVACAO: "Aguardando aprovação",
  CONCLUIDA: "Concluída",
};
const TOM_ETAPA: Record<StatusEtapa, Tom> = {
  PENDENTE: "neutro",
  EM_ANDAMENTO: "azul",
  AGUARDANDO_APROVACAO: "amarelo",
  CONCLUIDA: "verde",
};

export function StatusEtapaBadge({ status }: { status: StatusEtapa }) {
  return <Badge tom={TOM_ETAPA[status]}>{ROTULO_ETAPA[status]}</Badge>;
}

export const ROTULO_PROJETO: Record<StatusProjeto, string> = {
  ATIVO: "Ativo",
  PAUSADO: "Pausado",
  CONCLUIDO: "Concluído",
  CANCELADO: "Cancelado",
};
const TOM_PROJETO: Record<StatusProjeto, Tom> = { ATIVO: "azul", PAUSADO: "amarelo", CONCLUIDO: "verde", CANCELADO: "neutro" };

export function StatusProjetoBadge({ status }: { status: StatusProjeto }) {
  return <Badge tom={TOM_PROJETO[status]}>{ROTULO_PROJETO[status]}</Badge>;
}

export const ROTULO_NIVEL: Record<NivelAcesso, string> = {
  VISUALIZAR: "Só visualizar",
  BAIXAR: "Visualizar e baixar",
  BLOQUEADO: "Bloqueado",
};
const TOM_NIVEL: Record<NivelAcesso, Tom> = { VISUALIZAR: "azul", BAIXAR: "verde", BLOQUEADO: "vermelho" };

export function NivelBadge({ nivel }: { nivel: NivelAcesso | null }) {
  if (!nivel) return <Badge>Sem acesso</Badge>;
  return <Badge tom={TOM_NIVEL[nivel]}>{ROTULO_NIVEL[nivel]}</Badge>;
}

export function PrazoBadge({ prazo, concluida }: { prazo: Date | null; concluida?: boolean }) {
  if (!prazo || concluida) return null;
  const dias = diasAte(prazo);
  if (dias < 0) return <Badge tom="vermelho">Atrasada {Math.abs(dias)}d</Badge>;
  if (dias === 0) return <Badge tom="amarelo">Vence hoje</Badge>;
  if (dias <= 2) return <Badge tom="amarelo">Vence em {dias}d</Badge>;
  return null;
}

export function Vazio({ icone, titulo, texto, acao }: { icone?: React.ReactNode; titulo: string; texto?: string; acao?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {icone && <div className="mb-3 text-ink-500">{icone}</div>}
      <div className="font-semibold text-ink-100">{titulo}</div>
      {texto && <p className="mt-1 max-w-sm text-sm text-ink-400">{texto}</p>}
      {acao && <div className="mt-4">{acao}</div>}
    </div>
  );
}

export function Kpi({ rotulo, valor, detalhe, destaque }: { rotulo: string; valor: React.ReactNode; detalhe?: React.ReactNode; destaque?: boolean }) {
  return (
    <div className={cn("card p-5", destaque && "border-neon/30 bg-neon/[0.04]")}>
      <div className="text-[11px] font-bold uppercase tracking-wider text-ink-400">{rotulo}</div>
      <div className={cn("mt-2 text-3xl font-bold tabular-nums", destaque ? "text-neon" : "text-white")}>{valor}</div>
      {detalhe && <div className="mt-1 text-xs text-ink-400">{detalhe}</div>}
    </div>
  );
}

export function Aviso({ children, tom = "info" }: { children: React.ReactNode; tom?: "info" | "alerta" | "erro" | "ok" }) {
  const t = {
    info: "border-sky-400/25 bg-sky-400/[0.06] text-sky-200",
    alerta: "border-amber-400/25 bg-amber-400/[0.06] text-amber-200",
    erro: "border-red-500/30 bg-red-500/[0.07] text-red-200",
    ok: "border-neon/30 bg-neon/[0.06] text-neon-400",
  }[tom];
  return <div className={cn("rounded-xl border px-4 py-3 text-sm", t)}>{children}</div>;
}
