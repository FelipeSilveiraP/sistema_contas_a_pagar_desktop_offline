// Tabelas mostram so as 5 primeiras linhas; o botao "EXPANDIR TABELA" (seta para baixo)
// mostra todas e vira "RECOLHER TABELA" (pedido do usuario, 2026-11-16, igual ao
// Sistema de Garantias). As linhas a mais so ficam escondidas (classe hidden): a pesquisa,
// os filtros, os totais e a impressao continuam valendo para TODAS. A linha selecionada
// nunca some. A escolha vale enquanto a tela estiver aberta.

export const LINHAS_RECOLHIDA = 5;

const expandida = new Map<string, boolean>();
/** Ultimo render de cada tabela (o corpo pode ser recriado, como em Cadastros). */
const reaplicar = new Map<string, () => void>();

/**
 * Aplica o limite de 5 linhas ao `corpo` e poe (ou atualiza) o botao logo depois de
 * `depoisDe`. Chame no fim de cada render da tabela. `chave` identifica a tabela na tela.
 */
export function recolherTabela(
  chave: string,
  corpo: HTMLTableSectionElement,
  depoisDe: HTMLElement,
  selecionadoId?: number | null,
): void {
  // linha de "nenhum registro" (uma celula so) nao conta
  const linhas = [...corpo.rows].filter((tr) => !(tr.cells.length === 1 && tr.cells[0].colSpan > 1));
  const aberta = expandida.get(chave) === true;
  const selecionado = selecionadoId == null ? null : String(selecionadoId);
  let visiveis = 0;
  linhas.forEach((tr, i) => {
    const mostrar = aberta || i < LINHAS_RECOLHIDA || (selecionado !== null && tr.dataset.id === selecionado);
    tr.classList.toggle("hidden", !mostrar);
    if (mostrar) visiveis++;
  });
  corpo.dataset.linhasVisiveis = String(visiveis);
  corpo.dataset.linhasTotal = String(linhas.length);

  const idCaixa = `expandir-${chave}`;
  let caixa = document.getElementById(idCaixa);
  if (!caixa) {
    caixa = document.createElement("div");
    caixa.id = idCaixa;
    caixa.className = "flex justify-center w-full mt-3";
    const botao = document.createElement("button");
    botao.type = "button";
    botao.className = "btn-acao btn-expandir-tabela bg-[#FFE600]";
    botao.dataset.expandirTabela = chave;
    const icone = document.createElement("span");
    icone.className = "material-symbols-outlined";
    icone.setAttribute("aria-hidden", "true");
    const rotulo = document.createElement("span");
    rotulo.className = "rotulo-expandir";
    botao.append(icone, rotulo);
    botao.addEventListener("click", () => {
      expandida.set(chave, expandida.get(chave) !== true);
      reaplicar.get(chave)?.();
    });
    caixa.appendChild(botao);
  }
  if (caixa.previousElementSibling !== depoisDe) depoisDe.insertAdjacentElement("afterend", caixa);
  reaplicar.set(chave, () => recolherTabela(chave, corpo, depoisDe, selecionadoId));
  const botao = caixa.querySelector<HTMLButtonElement>("button")!;

  caixa.classList.toggle("hidden", linhas.length <= LINHAS_RECOLHIDA);
  botao.setAttribute("aria-expanded", String(aberta));
  botao.querySelector(".material-symbols-outlined")!.textContent = aberta ? "keyboard_arrow_up" : "keyboard_arrow_down";
  const escondidas = linhas.length - visiveis;
  botao.querySelector(".rotulo-expandir")!.textContent = aberta ? "RECOLHER TABELA" : `EXPANDIR TABELA (MAIS ${escondidas})`;
  botao.title = aberta ? "Mostrar só as 5 primeiras linhas" : `Mostrar todas as ${linhas.length} linhas`;
}
