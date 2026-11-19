// Rolagem automatica (pedido do usuario, 2026-11-18). Mesmo arquivo nos dois sistemas.
// 1. Clicou num registro da tabela: a tela desce direto para "Alterar um campo" (onde se
//    edita; nao para a nota fiscal nem para o resumo).
// 2. Abriu uma caixa de selecao (ou a caixa de digitar e escolher) perto do pe da tela: a
//    tela sobe o suficiente para a lista aparecer inteira, sem precisar rolar na mao.

const ESPACO_LISTA = 320; // px que a lista aberta precisa embaixo do campo
const MARGEM = 16;

function espacoPedido(campo: HTMLElement): number {
  if (campo instanceof HTMLSelectElement) {
    // a lista do Windows mostra no maximo ~20 opcoes de ~28px
    return Math.min(ESPACO_LISTA, Math.max(campo.options.length, 1) * 28 + MARGEM);
  }
  return ESPACO_LISTA;
}

/** O que rola de verdade: nas telas o <body> (altura 100%) e quem rola, nao a janela. */
function rolavelDe(campo: HTMLElement): HTMLElement {
  for (let pai = campo.parentElement; pai; pai = pai.parentElement) {
    if (pai.classList.contains("tabela-rolagem") || pai.classList.contains("caixa-busca__lista")) continue;
    const y = getComputedStyle(pai).overflowY;
    if (y !== "auto" && y !== "scroll") continue;
    // o <body> que rola e sempre ele (mesmo quando o conteudo ainda cabe e falta o espaco)
    if (pai === document.body || pai.scrollHeight > pai.clientHeight + 1) return pai;
  }
  return (document.scrollingElement as HTMLElement) ?? document.documentElement;
}

/** Sobe a tela para a lista do campo caber embaixo dele (nunca esconde o proprio campo).
 * Rola so a area que ja rola (nunca cria rolagem nova). No fim da pagina poe um espaco em
 * branco DENTRO dessa area, que some quando a pessoa sai do campo. */
function abrirEspaco(campo: HTMLElement): void {
  if (campo.closest(".dialogo, [role=dialog]")) return; // pop-ups ja ficam no meio da tela
  const r = campo.getBoundingClientRect();
  if (r.height === 0) return;
  const rolavel = rolavelDe(campo);
  const area = rolavel === document.scrollingElement
    ? { top: 0, bottom: window.innerHeight }
    : rolavel.getBoundingClientRect();
  const fundo = Math.min(area.bottom, window.innerHeight);
  const pedido = espacoPedido(campo);
  const falta = pedido - (fundo - r.bottom);
  if (falta <= 0) return;
  // sobe o que falta, mas o campo continua visivel abaixo do topo da area (barra fixa incluida)
  const delta = Math.min(falta, Math.max(0, r.top - Math.max(area.top, 0) - 96));
  if (delta <= 0) return;
  const sobra = rolavel.scrollHeight - rolavel.clientHeight - rolavel.scrollTop;
  if (sobra < delta) {
    document.getElementById("espaco-lista-aberta")?.remove();
    const espaco = document.createElement("div");
    espaco.id = "espaco-lista-aberta";
    espaco.setAttribute("aria-hidden", "true");
    espaco.style.flex = "0 0 auto";
    espaco.style.height = `${Math.ceil(delta - sobra)}px`;
    (rolavel === document.scrollingElement ? document.body : rolavel).appendChild(espaco);
    campo.addEventListener("blur", () => espaco.remove(), { once: true });
  }
  rolavel.scrollTop += delta;
}

const SELETOR_CAIXA = "select, .caixa-busca__campo, input[list]";

function campoDaCaixa(alvo: EventTarget | null): HTMLElement | null {
  return alvo instanceof Element ? (alvo.closest(SELETOR_CAIXA) as HTMLElement | null) : null;
}

/** Leva a tela ate "Alterar um campo" (o editor que acabou de abrir). */
export function rolarParaEdicao(): void {
  const editor = document.getElementById("editorContainer");
  const campo = document.getElementById("fieldSelect");
  if (!editor || editor.classList.contains("hidden") || !campo) return;
  const alvo = (campo.closest("[data-enter-envia]") ?? campo.parentElement ?? campo) as HTMLElement;
  alvo.scrollIntoView({ behavior: "smooth", block: "center" });
  // a nota fiscal (ou outro bloco) pode carregar depois e empurrar o editor: confere de novo
  window.setTimeout(() => {
    const r = alvo.getBoundingClientRect();
    if (r.top < 0 || r.bottom > window.innerHeight) alvo.scrollIntoView({ behavior: "smooth", block: "center" });
  }, 600);
}

export function ligarRolagemAutomatica(): void {
  // 1. clique numa linha de tabela que abre a edicao. Na captura (antes da tela agir): a
  //    tela redesenha a tabela no clique e a linha clicada deixa de existir.
  document.addEventListener("click", (evento) => {
    const alvo = evento.target as Element | null;
    if (!alvo || alvo.closest("button, a, input, select, textarea, label")) return;
    if (!alvo.closest("tbody tr")) return;
    // depois de a tela abrir o editor
    requestAnimationFrame(() => requestAnimationFrame(rolarParaEdicao));
  }, true);
  // 2. caixas de selecao: antes de a lista abrir (mousedown) e ao chegar pelo Tab (focus)
  document.addEventListener("mousedown", (evento) => {
    const campo = campoDaCaixa(evento.target);
    if (campo) abrirEspaco(campo);
  }, true);
  document.addEventListener("focusin", (evento) => {
    const campo = campoDaCaixa(evento.target);
    if (campo) abrirEspaco(campo);
  });
}
