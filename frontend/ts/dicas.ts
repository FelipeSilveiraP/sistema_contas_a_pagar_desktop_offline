// Dica do Windows ao parar o mouse em cima (pedido do usuario, 2026-11-18): todo botao
// e todo link clicavel ganha um `title` dizendo o que ele faz. Vem, nesta ordem, de:
// 1. `title` escrito a mao no HTML/TS (nunca e trocado);
// 2. DESCRICOES (as telas principais, com uma explicacao do que ha la);
// 3. aria-label, ou o texto do botao (+ a descricao do cartao, se houver);
// 4. o icone, em botoes so com icone (ex.: "close" -> "Fechar").
// Botoes que mudam de texto (ex.: EXPANDIR/RECOLHER) tem a dica refeita sozinha.

const SELETOR = "button, a[href], a[data-path], a[data-modulo], [role=button], summary";

/** Texto do botao (em maiusculas, sem acento de diferenca) -> explicacao. */
export type Descricoes = Record<string, string>;

const ICONES: Record<string, string> = {
  close: "Fechar", delete: "Excluir", edit: "Editar", add: "Adicionar", search: "Pesquisar",
  arrow_back: "Voltar", menu: "Abrir o menu", print: "Imprimir", visibility: "Mostrar",
  visibility_off: "Esconder", calendar_month: "Abrir o calendário", event: "Abrir o calendário",
  expand_more: "Abrir a lista", keyboard_arrow_down: "Abrir a lista", logout: "Sair",
};

function chave(texto: string): string {
  return texto.replace(/\s+/g, " ").trim().toUpperCase();
}

function textoVisivel(el: HTMLElement): string {
  const copia = el.cloneNode(true) as HTMLElement;
  copia.querySelectorAll(".material-symbols-outlined, [aria-hidden='true'], [class*='descricao'], [class*='tecla']").forEach((n) => n.remove());
  return (copia.textContent ?? "").replace(/\s+/g, " ").trim();
}

function dicaDe(el: HTMLElement, descricoes: Descricoes): string {
  const texto = el.getAttribute("aria-label")?.trim() || textoVisivel(el);
  const explicada = descricoes[chave(texto)];
  if (explicada) return explicada;
  const descricao = el.querySelector<HTMLElement>("[class*='descricao']")?.textContent?.replace(/\s+/g, " ").trim();
  if (texto && descricao) return `${texto}: ${descricao}`;
  if (texto) return texto;
  const icone = el.querySelector(".material-symbols-outlined")?.textContent?.trim() ?? "";
  return ICONES[icone] ?? "";
}

function aplicar(descricoes: Descricoes): void {
  document.querySelectorAll<HTMLElement>(SELETOR).forEach((el) => {
    // title escrito a mao fica como esta
    if (el.title && el.dataset.dicaAuto !== "1") return;
    const dica = dicaDe(el, descricoes);
    if (!dica || el.title === dica) return;
    el.title = dica;
    el.dataset.dicaAuto = "1";
  });
}

/** Liga as dicas na tela atual e nos botoes que aparecerem depois (tabelas, pop-ups). */
export function ligarDicas(descricoes: Descricoes = {}): void {
  const mapa: Descricoes = {};
  for (const [texto, dica] of Object.entries(descricoes)) mapa[chave(texto)] = dica;
  let agendado = false;
  const agendar = (): void => {
    if (agendado) return;
    agendado = true;
    requestAnimationFrame(() => {
      agendado = false;
      aplicar(mapa);
    });
  };
  agendar();
  new MutationObserver(agendar).observe(document.body, { childList: true, subtree: true, characterData: true });
}
