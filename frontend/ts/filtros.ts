// Filtros avancados das tabelas (Fase 4): periodo, ordenacao e busca por
// texto OU valor (como o RealizarBusca do VBA). Funcoes puras testadas em
// desktop/teste-filtros.js; montarControlesAvancados liga os <select> na tela.
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

export type Periodo = "TUDO" | "MES" | "MES_PASSADO" | "PROXIMO_MES" | "ANO";

export const PERIODOS: { valor: Periodo; rotulo: string }[] = [
  { valor: "TUDO", rotulo: "Todo o período" },
  { valor: "MES", rotulo: "Este mês" },
  { valor: "MES_PASSADO", rotulo: "Mês passado" },
  { valor: "PROXIMO_MES", rotulo: "Próximo mês" },
  { valor: "ANO", rotulo: "Este ano" },
];

/** A data ISO cai no periodo? (`base` = hoje, em ISO local) */
export function noPeriodo(iso: string | null | undefined, periodo: Periodo, base: string = hojeIso()): boolean {
  if (periodo === "TUDO") return true;
  if (!iso) return false;
  const [ano, mes] = base.split("-").map(Number);
  const [a, m] = iso.split("-").map(Number);
  if (periodo === "ANO") return a === ano;
  const deslocamento = periodo === "MES" ? 0 : periodo === "MES_PASSADO" ? -1 : 1;
  const alvo = new Date(ano, mes - 1 + deslocamento, 1);
  return a === alvo.getFullYear() && m === alvo.getMonth() + 1;
}

export type Ordem = "DATA_ASC" | "DATA_DESC" | "VALOR_DESC" | "VALOR_ASC" | "NOME";

export const ORDENS: { valor: Ordem; rotulo: string }[] = [
  { valor: "DATA_ASC", rotulo: "Data (mais antiga primeiro)" },
  { valor: "DATA_DESC", rotulo: "Data (mais recente primeiro)" },
  { valor: "VALOR_DESC", rotulo: "Valor (maior primeiro)" },
  { valor: "VALOR_ASC", rotulo: "Valor (menor primeiro)" },
  { valor: "NOME", rotulo: "Empresa (A a Z)" },
];

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

// ---------- controles na tela ----------

const CLASSE_SELECT =
  "border-2 border-[#1c1b1b] bg-white font-mono text-xs font-bold px-2 py-2 uppercase shadow-[2px_2px_0px_0px_#1c1b1b] focus:outline-none focus:ring-2 focus:ring-[#2165ef] cursor-pointer";

function select<T extends string>(id: string, rotulo: string, opcoes: { valor: T; rotulo: string }[], inicial: T): HTMLLabelElement {
  const label = document.createElement("label");
  label.className = "inline-flex items-center gap-1.5 font-mono text-xs font-bold uppercase text-neutral-600";
  label.htmlFor = id;
  label.textContent = rotulo;
  const sel = document.createElement("select");
  sel.id = id;
  sel.className = CLASSE_SELECT;
  for (const o of opcoes) {
    const opt = document.createElement("option");
    opt.value = o.valor;
    opt.textContent = o.rotulo;
    sel.appendChild(opt);
  }
  sel.value = inicial;
  label.appendChild(sel);
  return label;
}

export interface EstadoFiltroAvancado {
  periodo: Periodo;
  ordem: Ordem;
}

/** Insere "Período" e "Ordenar" logo depois de `ancora` e avisa a cada mudança. */
export function montarControlesAvancados(
  ancora: HTMLElement,
  inicial: EstadoFiltroAvancado,
  aoMudar: (estado: EstadoFiltroAvancado) => void,
  rotuloData = "Data",
): EstadoFiltroAvancado {
  const estado = { ...inicial };
  const linha = document.createElement("div");
  linha.className = "w-full flex flex-wrap items-center justify-center lg:justify-end gap-3";
  linha.dataset.filtrosAvancados = "";
  const ordens = ORDENS.map((o) => ({ ...o, rotulo: o.rotulo.replace("Data", rotuloData) }));
  const periodo = select("filtroPeriodo", "Período", PERIODOS, estado.periodo);
  const ordem = select("filtroOrdem", "Ordenar", ordens, estado.ordem);
  linha.append(periodo, ordem);
  ancora.insertAdjacentElement("afterend", linha);
  periodo.querySelector("select")!.addEventListener("change", (e) => {
    estado.periodo = (e.target as HTMLSelectElement).value as Periodo;
    aoMudar({ ...estado });
  });
  ordem.querySelector("select")!.addEventListener("change", (e) => {
    estado.ordem = (e.target as HTMLSelectElement).value as Ordem;
    aoMudar({ ...estado });
  });
  return estado;
}
