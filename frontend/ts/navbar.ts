import { Tela, irPara, voltar, menuPrincipal } from "./navegacao";
import { respostaProvisoria } from "./componentes";

type ChaveNav = "voltar" | "menu" | "cadastros" | "controle" | "mensagens" | "graficos";

interface ItemNav {
  chave: ChaveNav;
  rotulo: string;
  icone: string;
  cor: string;
  corTexto: string;
  svg: string;
  quadrado?: string;
  destino?: Tela;
  provisorio?: string;
  noPainel: boolean;
}

const ITENS_NAV: ItemNav[] = [
  {
    chave: "voltar",
    rotulo: "VOLTAR",
    icone: "arrow_back",
    cor: "",
    corTexto: "",
    svg: '<path d="M20 12H4M11 5l-7 7 7 7"/>',
    noPainel: true,
  },
  {
    chave: "menu",
    rotulo: "MENU PRINCIPAL",
    icone: "home",
    cor: "",
    corTexto: "",
    svg: '<path d="m3 11 9-8 9 8"/><path d="M5 10v11h14V10"/><path d="M10 21v-7h4v7"/>',
    quadrado: "icone-amarelo",
    noPainel: true,
  },
  {
    chave: "cadastros",
    rotulo: "CADASTROS",
    icone: "badge",
    cor: "bg-[#FF8400]",
    corTexto: "text-[#FF8400]",
    svg: '<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2"/><path d="M17 6a3 3 0 0 1 0 6"/><path d="M18 15a5 5 0 0 1 3 5"/>',
    quadrado: "icone-laranja",
    destino: "cadastros",
    noPainel: true,
  },
  {
    chave: "controle",
    rotulo: "CONTROLE",
    icone: "checklist",
    cor: "bg-[#38BDF8]",
    corTexto: "text-[#38BDF8]",
    svg: '<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2" fill="white"/><circle cx="15" cy="12" r="2" fill="white"/><circle cx="9" cy="18" r="2" fill="white"/>',
    quadrado: "icone-branco",
    destino: "controle",
    noPainel: true,
  },
  {
    chave: "mensagens",
    rotulo: "MENSAGENS",
    icone: "forum",
    cor: "bg-[#FF5E89]",
    corTexto: "text-[#FF5E89]",
    svg: '<rect x="3" y="5" width="18" height="14" rx="0"/><path d="m3 7 9 7 9-7"/>',
    quadrado: "icone-rosa",
    destino: "mensagens",
    noPainel: true,
  },
  {
    chave: "graficos",
    rotulo: "GRÁFICOS",
    icone: "bar_chart",
    cor: "bg-[#00FF66]",
    corTexto: "text-[#00FF66]",
    svg: '<path d="M5 20v-6h3v6M11 20V9h3v11M17 20V4h3v16"/>',
    quadrado: "icone-verde",
    destino: "graficos", provisorio: "GRÁFICOS",
    noPainel: true,
  },
];

const MODULO_DA_TELA: Partial<Record<Tela, ChaveNav>> = {
  controle: "controle",
  recorrentes: "controle",
  "todas-as-contas": "controle",
  pagos: "controle",
  "recorrentes-tabela": "controle",
  "form-recorrente": "controle",
  cadastros: "cadastros",
  "novo-cadastro": "cadastros",
  "form-banco": "cadastros",
  "form-pagador": "cadastros",
  "form-empresa": "cadastros",
  "todos-cadastros": "cadastros",
  mensagens: "mensagens",
  "todas-as-mensagens": "mensagens",
  "criar-mensagem": "mensagens",
  graficos: "graficos",
};

const CLASSE_ITEM_PAINEL =
  "nav-item-painel flex items-center gap-3 w-full px-4 py-3 text-left font-headline font-bold text-sm uppercase tracking-wider text-[#1c1b1b] cursor-pointer transition-colors border-b-2 border-[#1c1b1b] last:border-b-0";

function iconeHtml(nome: string, classe: string): string {
  return `<span class="material-symbols-outlined ${classe}">${nome}</span>`;
}

function botaoBarraHtml(item: ItemNav, ativo: boolean): string {
  const atual = ativo ? ' aria-current="page"' : "";
  if (item.chave === "voltar") {
    return `<button class="nav-item nav-voltar" type="button" data-nav="${item.chave}" aria-label="Voltar"${atual}><svg viewBox="0 0 24 24" aria-hidden="true">${item.svg}</svg></button>`;
  }
  return `<button class="nav-item" type="button" data-nav="${item.chave}"${atual}><span class="nav-icone ${item.quadrado}"><svg viewBox="0 0 24 24" aria-hidden="true">${item.svg}</svg></span><span>${item.rotulo}</span></button>`;
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
  console.info(`[ContasAPagar] nav "${item.rotulo}" acionada`);
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
<nav class="barra-navegacao nav-barra" aria-label="Navegação principal">
${ITENS_NAV.map((item) => botaoBarraHtml(item, item.chave === moduloAtivo)).join("\n")}
</nav>
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
    console.info(`[ContasAPagar] menu lateral ${menuEstaAberto(raiz) ? "aberto" : "fechado"}`);
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

  console.info(`[ContasAPagar] navbar global montada (tela: ${tela}, módulo ativo: ${moduloAtivo ?? "nenhum"})`);
}
