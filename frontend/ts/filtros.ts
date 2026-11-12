// Filtros das tabelas: ordenacao e busca por texto OU valor (como o
// RealizarBusca do VBA). Funcoes puras testadas em desktop/teste-filtros.js.
// (Periodo/Ordenar na tela foram removidos a pedido do usuario em 2026-11-11.)
//
// Datas: SEMPRE no horario local. toISOString() usa UTC e, no Brasil (UTC-3),
// das 21h a meia-noite ja seria "amanha" — uma conta que vence hoje aparecia
// como atrasada.

import { formatarMoedaBR, paraCentavos } from "./mascaras";

export function isoLocal(data: Date = new Date()): string {
  const a = data.getFullYear();
  const m = String(data.getMonth() + 1).padStart(2, "0");
  const d = String(data.getDate()).padStart(2, "0");
  return `${a}-${m}-${d}`;
}

export function hojeIso(): string {
  return isoLocal(new Date());
}

/** Dias do dia `base` ate a data ISO (negativo = ja passou). */
export function diasAte(iso: string, base: string = hojeIso()): number {
  const [a1, m1, d1] = base.split("-").map(Number);
  const [a2, m2, d2] = iso.split("-").map(Number);
  return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86400000);
}

export type Ordem = "DATA_ASC" | "DATA_DESC" | "VALOR_DESC" | "VALOR_ASC" | "NOME";

export interface ChavesOrdenacao<T> {
  data: (item: T) => string;
  valor: (item: T) => number;
  nome: (item: T) => string;
}

/** Ordena uma COPIA da lista (estavel; empates mantem a ordem original). */
export function ordenar<T>(lista: T[], ordem: Ordem, chaves: ChavesOrdenacao<T>): T[] {
  const comparar: Record<Ordem, (a: T, b: T) => number> = {
    DATA_ASC: (a, b) => chaves.data(a).localeCompare(chaves.data(b)),
    DATA_DESC: (a, b) => chaves.data(b).localeCompare(chaves.data(a)),
    VALOR_DESC: (a, b) => chaves.valor(b) - chaves.valor(a),
    VALOR_ASC: (a, b) => chaves.valor(a) - chaves.valor(b),
    NOME: (a, b) => chaves.nome(a).localeCompare(chaves.nome(b), "pt-BR", { sensitivity: "base" }),
  };
  return [...lista].sort(comparar[ordem]);
}

function semAcento(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * Busca por texto (sem diferenciar maiusculas/acentos) OU por valor:
 * "150" acha R$ 150,00 e R$ 1.150,00; "150,00" / "R$ 150" acham o valor exato.
 */
export function correspondeBusca(termo: string, textos: (string | null | undefined)[], valorReais?: number): boolean {
  const t = termo.trim();
  if (!t) return true;
  const alvo = semAcento(t);
  if (textos.some((x) => x && semAcento(x).includes(alvo))) return true;
  if (valorReais === undefined || !/\d/.test(t)) return false;
  const centavos = Math.round(valorReais * 100);
  const termoCentavos = paraCentavos(t);
  if (termoCentavos !== null && /[,.]|R\$/i.test(t) && termoCentavos === centavos) return true;
  const digitos = t.replace(/\D/g, "");
  const formatado = formatarMoedaBR(centavos).replace(/\D/g, "");
  return digitos.length > 0 && /^[\d.,R$\s]+$/i.test(t) && formatado.includes(digitos);
}
