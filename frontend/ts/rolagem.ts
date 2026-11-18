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

/** Sobe a tela para a lista do campo caber embaixo dele (nunca esconde o proprio campo).
 * Um marcador invisivel do tamanho da lista e posto logo abaixo do campo e o navegador o traz
 * para dentro da tela (rola quem precisar rolar). No fim da pagina o marcador tambem cria o
 * espaco que falta; ele some quando a pessoa sai do campo. */
function abrirEspaco(campo: HTMLElement): void {
  if (campo.closest(".dialogo, [role=dialog]")) return; // pop-ups ja ficam no meio da tela
  const r = campo.getBoundingClientRect();
  if (r.height === 0) return;
  const pedido = Math.min(espacoPedido(campo), window.innerHeight - 96 - r.height);
  if (pedido <= 0 || window.innerHeight - r.bottom >= pedido) return;
  document.getElementById("espaco-lista-aberta")?.remove();
  const marcador = document.createElement("div");
  marcador.id = "espaco-lista-aberta";
  marcador.setAttribute("aria-hidden", "true");
  Object.assign(marcador.style, {
    position: "absolute", left: "0", width: "1px", pointerEvents: "none",
    top: `${r.bottom + window.scrollY}px`, height: `${pedido}px`,
  });
  document.body.appendChild(marcador);
  marcador.scrollIntoView({ block: "end", behavior: "instant" as ScrollBehavior });
  campo.addEventListener("blur", () => marcador.remove(), { once: true });
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
