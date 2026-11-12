// Impressao de relatorios: o processo principal gera um PDF em Downloads e o
// abre no leitor padrao, onde o usuario imprime. Sem window.print(): a janela
// nativa de impressao e modal e causava o bug de foco dos inputs no Electron.
//
// imprimirRelatorio: PDF da tela atual (Graficos).
// imprimirDocumento: monta uma FOLHA formal (so texto e tabelas, sem o visual da
// tela) num elemento proprio; o CSS de impressao mostra apenas essa folha.
import { notificar } from "./notificacoes";

async function gerar(nome: string, opcoes?: { retrato?: boolean; anexoPdf?: Uint8Array; formal?: boolean }): Promise<boolean> {
  try {
    const r = await window.finDesk!.imprimirPdf(nome, opcoes);
    if (!r.ok || !r.caminho) throw new Error("falha ao gerar o PDF");
    const caminho = r.caminho;
    document.body.dataset.relatorioPdf = caminho;
    notificar("Documento aberto em PDF para imprimir.", "sucesso", {
      rotulo: "Abrir",
      aoClicar: () => void window.finDesk!.abrirArquivo(caminho),
    });
    return r.anexoIncluido ?? false;
  } catch {
    notificar("Não foi possível gerar o documento. Tente de novo.", "erro");
    return false;
  }
}

export async function imprimirRelatorio(nome: string): Promise<void> {
  await gerar(nome);
}

// ---------- folha formal ----------

export function criar<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  classe = "",
  texto?: string,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (classe) e.className = classe;
  if (texto !== undefined) e.textContent = texto;
  return e;
}

/** Cabecalho padrao: empresa, titulo do documento e data/hora de emissao. */
export function cabecalhoFolha(titulo: string): HTMLElement {
  const cab = criar("header", "folha__cabecalho");
  cab.append(
    criar("p", "folha__empresa", "Chaveiro Universal — Sistema de Contas a Pagar"),
    criar("h1", "folha__titulo", titulo),
    criar("p", "folha__emissao", `Emitido em ${new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}`),
  );
  return cab;
}

/** Tabela de 2 colunas "campo: valor" (formulario respondido). */
export function tabelaCampos(linhas: [string, string][]): HTMLTableElement {
  const tabela = criar("table", "folha__campos");
  const corpo = criar("tbody");
  for (const [rotulo, valor] of linhas) {
    const tr = criar("tr");
    tr.append(criar("th", "", rotulo), criar("td", "", valor || "—"));
    corpo.appendChild(tr);
  }
  tabela.appendChild(corpo);
  return tabela;
}

/** Linhas de assinatura no rodape. */
export function assinaturas(rotulos: string[]): HTMLElement {
  const area = criar("div", "folha__assinaturas");
  for (const r of rotulos) {
    const bloco = criar("div", "folha__assinatura");
    bloco.append(criar("span", "folha__linha"), criar("span", "", r));
    area.appendChild(bloco);
  }
  return area;
}

async function imagensCarregadas(raiz: HTMLElement): Promise<void> {
  await Promise.all(
    [...raiz.querySelectorAll("img")].map((img) =>
      img.complete ? Promise.resolve() : new Promise<void>((ok) => {
        img.onload = () => ok();
        img.onerror = () => ok();
      })),
  );
}

/**
 * Monta a folha, gera o PDF e remove a folha. `anexoPdf` (nota fiscal em PDF)
 * e acrescentada pelo processo principal depois das paginas da folha.
 * Retorna se o PDF da nota foi juntado.
 */
export async function imprimirDocumento(
  nome: string,
  montar: (folha: HTMLElement) => void,
  opcoes: { retrato?: boolean; anexoPdf?: Uint8Array } = {},
): Promise<boolean> {
  const folha = criar("div", "folha-impressao");
  folha.id = "folha-impressao";
  folha.setAttribute("aria-hidden", "true");
  montar(folha);
  document.body.appendChild(folha);
  document.body.classList.add("imprimindo-documento");
  try {
    await imagensCarregadas(folha);
    return await gerar(nome, { ...opcoes, formal: true });
  } finally {
    document.body.classList.remove("imprimindo-documento");
    folha.remove();
  }
}
