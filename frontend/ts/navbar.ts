import { Tela, irPara, voltar, menuPrincipal } from "./navegacao";
import { respostaProvisoria } from "./componentes";

type ChaveNav = "voltar" | "menu" | "cadastros" | "controle" | "mensagens" | "graficos";

interface ItemNav {
  chave: ChaveNav;
  rotulo: string;
  icone: string;
  cor: string;
  corTexto: string;
  destino?: Tela;
  provisorio?: string;
  noPainel: boolean;
}

const ITENS_NAV: ItemNav[] = [
  { chave: "voltar", rotulo: "VOLTAR", icone: "arrow_back", cor: "", corTexto: "", noPainel: true },
  { chave: "menu", rotulo: "MENU PRINCIPAL", icone: "home", cor: "", corTexto: "", noPainel: true },
  {
    chave: "cadastros",
    rotulo: "CADASTROS",
    icone: "badge",
    cor: "bg-[#FF8400]",
    corTexto: "text-[#FF8400]",
    destino: "cadastros",
    noPainel: true,
  },
  {
    chave: "controle",
    rotulo: "CONTROLE",
    icone: "checklist",
    cor: "bg-[#38BDF8]",
    corTexto: "text-[#38BDF8]",
    destino: "controle",
    noPainel: true,
  },
  {
    chave: "mensagens",
    rotulo: "MENSAGENS",
    icone: "forum",
    cor: "bg-[#FF5E89]",
    corTexto: "text-[#FF5E89]",
    destino: "mensagens",
    noPainel: true,
  },
  {
    chave: "graficos",
    rotulo: "GRÁFICOS",
    icone: "bar_chart",
    cor: "bg-[#00FF66]",
    corTexto: "text-[#00FF66]",
    provisorio: "GRÁFICOS",
    noPainel: true,
  },
];

const MODULO_DA_TELA: Partial<Record<Tela, ChaveNav>> = {
  controle: "controle",
  recorrentes: "controle",
  cadastros: "cadastros",
  "novo-cadastro": "cadastros",
  mensagens: "mensagens",
};

const CLASSE_BOTAO =
  "nav-botao inline-flex items-center gap-2 px-3 py-2 whitespace-nowrap border-4 border-[#1c1b1b] shadow-[4px_4px_0_0_#1c1b1b] font-headline font-bold text-xs uppercase tracking-wider text-[#1c1b1b] cursor-pointer transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[6px_6px_0_0_#1c1b1b] active:translate-x-1 active:translate-y-1 active:shadow-[1px_1px_0_0_#1c1b1b]";

const CLASSE_ITEM_PAINEL =
  "nav-item flex items-center gap-3 w-full px-4 py-3 text-left font-headline font-bold text-sm uppercase tracking-wider text-[#1c1b1b] cursor-pointer transition-colors border-b-2 border-[#1c1b1b] last:border-b-0";

function iconeHtml(nome: string, classe: string): string {
  return `<span class="material-symbols-outlined ${classe}">${nome}</span>`;
}

function botaoBarraHtml(item: ItemNav, ativo: boolean): string {
  const fundo = ativo ? item.cor : "bg-white";
  const corIcone = ativo ? "text-[#1c1b1b]" : item.corTexto;
  return `<button class="${CLASSE_BOTAO} ${fundo}" data-nav="${item.chave}" type="button">${iconeHtml(
    item.icone,
    `text-lg leading-none font-bold ${corIcone}`
  )}<span>${item.rotulo}</span></button>`;
}

function itemPainelHtml(item: ItemNav, ativo: boolean): string {
  const fundo = ativo ? item.cor : "bg-white";
  const corIcone = ativo ? "text-[#1c1b1b]" : item.corTexto;
  return `<button class="${CLASSE_ITEM_PAINEL} ${fundo} hover:bg-[#f0edeb]" data-nav="${item.chave}" type="button">${iconeHtml(
    item.icone,
    `text-xl leading-none font-bold ${corIcone}`
  )}<span>${item.rotulo}</span></button>`;
}

function menuEstaAberto(raiz: HTMLElement): boolean {
  return raiz.dataset.menuAberto === "true";
}

function definirMenu(raiz: HTMLElement, aberto: boolean): void {
  raiz.dataset.menuAberto = aberto ? "true" : "false";
  raiz.querySelector(".nav-hamburguer")?.setAttribute("aria-expanded", String(aberto));
}

function acionar(item: ItemNav): void {
  console.info(`[FinDesk] nav "${item.rotulo}" acionada`);
  if (item.destino) {
    void irPara(item.destino);
    return;
  }
  if (item.chave === "voltar") {
    void voltar();
    return;
  }
  if (item.chave === "menu") {
    void menuPrincipal();
    return;
  }
  if (item.provisorio) {
    respostaProvisoria(item.provisorio, "Módulo");
  }
}

export function montarNavbar(tela: Tela): void {
  const raiz = document.getElementById("nav-global");
  if (!raiz) return;
  const moduloAtivo = MODULO_DA_TELA[tela];
  const itens = new Map(ITENS_NAV.map((item) => [item.chave, item]));

  raiz.dataset.menuAberto = "false";
  raiz.innerHTML = `
<div class="nav-barra w-full gap-2 justify-between">
${ITENS_NAV.map((item) => botaoBarraHtml(item, item.chave === moduloAtivo)).join("")}
</div>
<button class="nav-hamburguer relative z-[60] flex-col items-center justify-center gap-1.5 w-14 h-14 bg-white border-4 border-[#1c1b1b] shadow-[4px_4px_0_0_#1c1b1b] cursor-pointer transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[6px_6px_0_0_#1c1b1b] active:translate-x-1 active:translate-y-1 active:shadow-[1px_1px_0_0_#1c1b1b]" aria-label="Abrir menu de navegação" aria-expanded="false" type="button">
<span class="nav-hamburguer__linha"></span>
<span class="nav-hamburguer__linha"></span>
<span class="nav-hamburguer__linha"></span>
</button>
<div class="nav-veu" data-nav="fechar" aria-hidden="true"></div>
<nav class="nav-painel bg-white border-4 border-[#1c1b1b] shadow-[6px_6px_0_0_#1c1b1b]" aria-label="Menu de módulos">
${ITENS_NAV.filter((item) => item.noPainel)
  .map((item) => itemPainelHtml(item, item.chave === moduloAtivo))
  .join("")}
</nav>`;

  raiz.addEventListener("click", (evento) => {
    const alvo = (evento.target as HTMLElement).closest<HTMLElement>("[data-nav]");
    if (!alvo || !raiz.contains(alvo)) return;
    const acao = alvo.dataset.nav;
    if (acao === "fechar") {
      definirMenu(raiz, false);
      return;
    }
    const item = itens.get(acao as ChaveNav);
    if (!item) return;
    definirMenu(raiz, false);
    acionar(item);
  });

  raiz.querySelector(".nav-hamburguer")?.addEventListener("click", () => {
    definirMenu(raiz, !menuEstaAberto(raiz));
    console.info(`[FinDesk] menu lateral ${menuEstaAberto(raiz) ? "aberto" : "fechado"}`);
  });

  document.addEventListener("keydown", (evento) => {
    if (evento.key !== "Escape") return;
    evento.preventDefault();
    if (menuEstaAberto(raiz)) {
      definirMenu(raiz, false);
      return;
    }
    void voltar();
  });

  console.info(`[FinDesk] navbar global montada (tela: ${tela}, módulo ativo: ${moduloAtivo ?? "nenhum"})`);
}
