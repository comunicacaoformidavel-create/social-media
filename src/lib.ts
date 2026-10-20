import type { State } from "./types";
export const today = () => dateKey(new Date());
export function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function offsetDate(date: string, offset: number) {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + offset);
  return dateKey(d);
}
export function formatDate(
  date: string,
  options: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short" },
) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR", options);
}
export const number = (n: number) =>
  new Intl.NumberFormat("pt-BR", {
    notation: n >= 10000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(n);
export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new Error(
      "Não foi possível conectar ao servidor. Confira se ele está em execução.",
    );
  }
  const result = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(
      result?.error || "Não foi possível concluir a operação. Tente novamente.",
    );
  return result;
}
export const loadState = () => api<State>("/state");
export function download(
  name: string,
  content: string,
  type = "text/csv;charset=utf-8;",
) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function csvCell(value: unknown) {
  const text = String(value ?? "");
  const safe = /^[\s]*[=+@-]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}
export const emptyMetrics = () => ({
  reach: 0,
  impressions: 0,
  likes: 0,
  comments: 0,
  saves: 0,
});
