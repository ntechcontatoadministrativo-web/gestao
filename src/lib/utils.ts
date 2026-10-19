import clsx, { type ClassValue } from "clsx";

export function cn(...classes: ClassValue[]) {
  return clsx(classes);
}

export const fmtData = (d: Date | string | null | undefined) =>
  d ? new Date(d).toLocaleDateString("pt-BR", { timeZone: "America/Belem" }) : "—";

export const fmtDataHora = (d: Date | string | null | undefined) =>
  d
    ? new Date(d).toLocaleString("pt-BR", {
        timeZone: "America/Belem",
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

export function fmtTamanho(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

// R00, R01, R02...
export const fmtRevisao = (n: number) => `R${String(n).padStart(2, "0")}`;

export function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes.length > 1 ? partes[partes.length - 1][0] : "")).toUpperCase();
}

export function tempoRelativo(d: Date | string | null | undefined) {
  if (!d) return "nunca";
  const seg = Math.round((Date.now() - new Date(d).getTime()) / 1000);
  if (seg < 60) return "agora";
  const min = Math.round(seg / 60);
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const dias = Math.round(h / 24);
  return `há ${dias} dia${dias > 1 ? "s" : ""}`;
}

export const ONLINE_JANELA_MS = 2 * 60 * 1000;
export const estaOnline = (d: Date | null | undefined) => !!d && Date.now() - new Date(d).getTime() < ONLINE_JANELA_MS;

// Início do dia de hoje em Belém (UTC-3, sem horário de verão)
export function hojeInicio() {
  const agora = new Date();
  const belem = new Date(agora.getTime() - 3 * 3600 * 1000);
  belem.setUTCHours(0, 0, 0, 0);
  return new Date(belem.getTime() + 3 * 3600 * 1000);
}

export function diasAte(d: Date | string) {
  return Math.ceil((new Date(d).getTime() - hojeInicio().getTime()) / 86400000);
}

// "2026-10-19" -> Date ao meio-dia de Belém (evita virar o dia por fuso)
export function parseDataInput(v: FormDataEntryValue | null): Date | null {
  if (!v || typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  return new Date(`${v}T15:00:00.000Z`);
}

export function dataParaInput(d: Date | string | null | undefined) {
  if (!d) return "";
  return new Date(new Date(d).getTime() - 3 * 3600 * 1000).toISOString().slice(0, 10);
}
