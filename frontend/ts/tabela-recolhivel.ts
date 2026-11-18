// Tabelas com ALTURA FIXA de 5 linhas e rolagem DENTRO da propria tabela (pedido do usuario,
// 2026-11-18: no lugar do botao EXPANDIR TABELA, que deixava a tela enorme). O cabecalho fica
// parado no topo enquanto as linhas rolam. Todas as linhas continuam na pagina: a pesquisa,
// os filtros, os totais e a impressao valem para TODAS. A linha selecionada e trazida para
// dentro da area visivel. Vale para <tbody> (linhas) e listas <ul> (itens).
// (Mesmo arquivo nos dois sistemas: Contas a Pagar e Garantias.)

export const LINHAS_RECOLHIDA = 5;

/** Ultimo render de cada tabela, para recalcular a altura quando a janela muda de tamanho. */
const reaplicar = new Map<string, () => void>();
let ouvindoJanela = false;

function linhasDe(corpo: HTMLElement): HTMLElement[] {
  // a linha de "nenhum registro" (uma celula so, ou item com data-vazio) nao conta
  return ([...corpo.children] as HTMLElement[]).filter((linha) => {
    if (linha instanceof HTMLTableRowElement) return !(linha.cells.length === 1 && linha.cells[0].colSpan > 1);
    return linha.dataset.vazio !== "true";
  });
}

/** A caixa que rola: a <div> em volta da tabela, ou a propria lista. Se a tabela divide a
 * caixa com outras coisas ou a caixa tem margem interna, ganha uma caixa so dela. */
function caixaDe(corpo: HTMLElement): HTMLElement {
  const tabela = corpo.closest("table");
  if (!tabela) return corpo;
  const pai = tabela.parentElement as HTMLElement;
  if (pai.classList.contains("tabela-rolagem")) return pai;
  const estilo = getComputedStyle(pai);
  const temMargem = ["paddingTop", "paddingBottom"].some((p) => parseFloat(estilo[p as "paddingTop"]) > 0);
  if (pai.children.length === 1 && !temMargem) return pai;
  const caixa = document.createElement("div");
  tabela.before(caixa);
  caixa.appendChild(tabela);
  return caixa;
}

function medir(chave: string, corpo: HTMLElement, selecionadoId?: number | null): void {
  // a tela ja redesenhou a tabela (esta aqui saiu da pagina): o novo render mede a nova
  if (!corpo.isConnected) return;
  const caixa = caixaDe(corpo);
  const linhas = linhasDe(corpo);
  // nada mais fica escondido (o jeito antigo escondia as linhas a mais)
  linhas.forEach((l) => l.classList.remove("linha-recolhida"));
  caixa.classList.add("tabela-rolagem");
  caixa.dataset.tabelaRolagem = chave;
  corpo.dataset.linhasTotal = String(linhas.length);
  if (linhas.length <= LINHAS_RECOLHIDA) {
    caixa.style.maxHeight = "";
    corpo.dataset.linhasVisiveis = String(linhas.length);
    return;
  }
  const cabecalho = corpo.closest("table")?.tHead?.getBoundingClientRect().height ?? 0;
  // do topo de dentro da caixa (margem interna incluida) ate o pe da 5a linha, medido na tela
  const estilo = getComputedStyle(caixa);
  const inicio = caixa.getBoundingClientRect().top + (parseFloat(estilo.borderTopWidth) || 0);
  const altura = linhas[LINHAS_RECOLHIDA - 1].getBoundingClientRect().bottom + caixa.scrollTop - inicio;
  // tabela ainda sem tamanho (tela escondida): tenta de novo no proximo quadro
  if (linhas[0].getBoundingClientRect().height === 0) {
    requestAnimationFrame(() => medir(chave, corpo, selecionadoId));
    return;
  }
  // a rolagem horizontal (se houver) nao come a 5a linha
  const barra = caixa.offsetHeight - caixa.clientHeight - (parseFloat(estilo.borderTopWidth) || 0)
    - (parseFloat(estilo.borderBottomWidth) || 0);
  caixa.style.maxHeight = `${Math.ceil(altura + Math.max(0, barra) + 1)}px`;
  corpo.dataset.linhasVisiveis = String(LINHAS_RECOLHIDA);

  // a linha selecionada fica visivel dentro da caixa (sem mexer na rolagem da pagina)
  if (selecionadoId != null) {
    const linha = linhas.find((l) => l.dataset.id === String(selecionadoId));
    if (linha) {
      const topoCaixa = caixa.getBoundingClientRect().top + cabecalho;
      const r = linha.getBoundingClientRect();
      if (r.top < topoCaixa) caixa.scrollTop -= topoCaixa - r.top;
      else if (r.bottom > caixa.getBoundingClientRect().bottom) caixa.scrollTop += r.bottom - caixa.getBoundingClientRect().bottom;
    }
  }
}

/**
 * Deixa a tabela (ou lista) com a altura de 5 linhas e rolagem por dentro. Chame no fim de
 * cada render. `chave` identifica a tabela na tela; `depoisDe` fica por compatibilidade.
 */
export function recolherTabela(
  chave: string,
  corpo: HTMLElement,
  _depoisDe?: HTMLElement,
  selecionadoId?: number | null,
): void {
  // o botao EXPANDIR TABELA de versoes antigas sai da tela
  document.getElementById(`expandir-${chave}`)?.remove();
  reaplicar.set(chave, () => medir(chave, corpo, null));
  if (!ouvindoJanela) {
    ouvindoJanela = true;
    window.addEventListener("resize", () => reaplicar.forEach((refazer) => refazer()));
  }
  requestAnimationFrame(() => medir(chave, corpo, selecionadoId));
}
