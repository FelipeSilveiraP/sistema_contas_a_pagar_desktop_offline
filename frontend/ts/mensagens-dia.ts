// "Mensagens do dia" (regra do VBA VerificarVencimentosAoAbrir): linhas das contas
// atrasadas e a vencer e o pop-up de tela cheia MENSAGENS URGENTES. Usado no Menu e no
// botao CONTAS A VENCER de Todas as Contas (pedido do usuario, 2026-11-25).
import { AlertaContaDados, AlertasDados } from "./api";
import { formatarDataBR, formatarMoedaBR } from "./mascaras";
import { irPara } from "./navegacao";
import { pedirAbertura } from "./abrir-registro";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** "Hoje: 25 de novembro de 2026" a partir de "2026-11-25". */
export function textoHoje(hoje: string): string {
  const [ano, mes, dia] = hoje.split("-").map(Number);
  return `Hoje: ${dia} de ${MESES[mes - 1]} de ${ano}`;
}

/** O que fazer ao clicar numa conta: padrao = abrir no Controle (Todas as Contas). */
let escolherConta: (id: number) => void = (id) => {
  pedirAbertura("conta", id);
  void irPara("todas-as-contas");
};

function celula(texto: string, classe: string, rotulo: string): HTMLTableCellElement {
  const td = document.createElement("td");
  td.className = classe;
  td.dataset.rotulo = rotulo;
  td.textContent = texto;
  return td;
}

function selo(texto: string, cores: string): HTMLSpanElement {
  const s = document.createElement("span");
  s.className = `selo ${cores}`;
  s.textContent = texto;
  return s;
}

function situacao(dias: number): { texto: string; cores: string; atrasada: boolean } {
  if (dias < 0) {
    const n = Math.abs(dias);
    return { texto: `Atrasada ${n} dia${n > 1 ? "s" : ""}`, cores: "bg-[#ffdad6] text-[#93000a]", atrasada: true };
  }
  if (dias === 0) return { texto: "Vence hoje", cores: "bg-[#FF5E89]/20 text-[#b6212a]", atrasada: false };
  return { texto: `Vence em ${dias} dia${dias > 1 ? "s" : ""}`, cores: "bg-[#FFE600]/30 text-[#6a5f00]", atrasada: false };
}

export function linhaAlerta(conta: AlertaContaDados): HTMLTableRowElement {
  const s = situacao(conta.dias);
  const tr = document.createElement("tr");
  tr.className = `${s.atrasada ? "bg-[#fff1ef]" : ""} hover:bg-[#fff9d6] transition-colors cursor-pointer`;
  tr.dataset.alerta = s.atrasada ? "atrasada" : "a-vencer";
  tr.dataset.idConta = String(conta.id);
  // clique (ou Enter) = abre esta conta no Controle, ja selecionada (pedido do usuario, 2026-11-25)
  tr.tabIndex = 0;
  tr.title = "Abrir esta conta no Controle";
  const abrir = (): void => escolherConta(conta.id);
  tr.addEventListener("click", abrir);
  tr.addEventListener("keydown", (evento) => {
    if (evento.key !== "Enter" && evento.key !== " ") return;
    evento.preventDefault();
    evento.stopPropagation();
    abrir();
  });
  tr.appendChild(celula(formatarDataBR(conta.vencimento), `p-2.5 sm:px-4 py-2 text-center font-mono ${s.atrasada ? "text-[#ba1a1a]" : "text-[#1c1b1b]"}`, "Vencimento"));
  tr.appendChild(celula(conta.nomeEmpresa, "p-2.5 sm:px-4 py-2", "Empresa"));
  tr.appendChild(celula(formatarMoedaBR(Math.round(conta.valor * 100)), "p-2.5 sm:px-4 py-2 text-right font-mono whitespace-nowrap", "Valor"));
  const pasta = celula("", "p-2.5 sm:px-4 py-2 text-center", "Na Pasta?");
  pasta.appendChild(conta.boletoNaPasta
    ? selo("Sim", "bg-[#00FF66]/20 text-[#006c46]")
    : selo("Não", "bg-[#e5e2e1] text-[#4b4731] border-[#cdc7aa]"));
  tr.appendChild(pasta);
  const status = celula("", "p-2.5 sm:px-4 py-2 text-center", "Status");
  status.appendChild(selo(s.texto, s.cores));
  tr.appendChild(status);
  return tr;
}

export function linhaUnica(texto: string, classe: string): HTMLTableRowElement {
  const tr = document.createElement("tr");
  const td = document.createElement("td");
  td.colSpan = 5;
  td.className = classe;
  td.textContent = texto;
  tr.appendChild(td);
  return tr;
}

function itemRecado(titulo: string, mensagem: string, completo: boolean): HTMLLIElement {
  const li = document.createElement("li");
  li.className = `recado-dia${completo ? " recado-dia--completo" : ""}`;
  const t = document.createElement("strong");
  t.textContent = titulo;
  const m = document.createElement("span");
  m.textContent = mensagem;
  li.append(t, m);
  li.title = `${titulo}: ${mensagem}`;
  return li;
}

export function renderRecados(lista: HTMLElement, dados: AlertasDados, limite: number): void {
  const completo = limite === Infinity;
  const itens: HTMLLIElement[] = dados.avisosHoje.slice(0, limite).map((a) => itemRecado(a.titulo, a.mensagem, completo));
  if (!dados.avisosHoje.length) {
    const vazio = document.createElement("li");
    vazio.className = "font-mono text-xs text-neutral-500 uppercase";
    vazio.textContent = "Nenhum recado para hoje.";
    itens.push(vazio);
  } else if (dados.avisosHoje.length > limite) {
    const resto = dados.avisosHoje.length - limite;
    const mais = document.createElement("li");
    mais.className = "font-mono text-xs text-neutral-600 uppercase";
    mais.textContent = `+ ${resto} recado${resto > 1 ? "s" : ""} — use EXPANDIR para ver todos`;
    itens.push(mais);
  }
  lista.replaceChildren(...itens);
}

/** Mais urgente primeiro: a mais atrasada, depois as que vencem antes. */
function porPrioridade(dados: AlertasDados): AlertaContaDados[] {
  return [...dados.atrasados, ...dados.aVencer].sort((a, b) => a.dias - b.dias);
}

export function linhasContas(dados: AlertasDados, limite: number): HTMLTableRowElement[] {
  const todas = porPrioridade(dados);
  const linhas = todas.slice(0, limite).map(linhaAlerta);
  if (!todas.length) {
    linhas.push(linhaUnica("Tudo em dia! Nenhuma conta atrasada ou vencendo nos próximos 10 dias.", "p-3 text-center text-[#006c46] uppercase"));
  }
  return linhas;
}


/** Tabela das contas do dia (mesmas colunas do painel do Menu). */
function tabelaAlertas(): HTMLTableElement {
  const tabela = document.createElement("table");
  tabela.className = "tabela-avisos w-full text-left border-collapse";
  const thead = document.createElement("thead");
  thead.className = "bg-[#fcf9f8] border-b-2 border-[#1c1b1b] font-headline text-xs sm:text-sm uppercase tracking-wider text-[#1c1b1b]";
  const tr = document.createElement("tr");
  for (const [texto, alinhar] of [["Vencimento", "text-center"], ["Empresa", ""], ["Valor", "text-right"], ["Na Pasta?", "text-center"], ["Status", "text-center"]]) {
    const th = document.createElement("th");
    th.className = `p-2.5 sm:px-4 py-2 font-bold ${alinhar}`;
    th.textContent = texto;
    tr.appendChild(th);
  }
  thead.appendChild(tr);
  const tbody = document.createElement("tbody");
  tbody.className = "divide-y-2 divide-[#1c1b1b] font-headline text-xs sm:text-sm font-bold";
  tabela.append(thead, tbody);
  return tabela;
}

// ===== pop-up "Mensagens do dia" em tela cheia (todas as contas e recados) =====
export let popupAberto = false;
let aoFecharPopup: (() => void) | null = null;

function fecharPopup(veu: HTMLElement, origem: HTMLElement | null): void {
  veu.remove();
  popupAberto = false;
  delete document.body.dataset.mensagensExpandidas;
  origem?.focus();
  aoFecharPopup?.();
  aoFecharPopup = null;
}

function botaoPainel(texto: string, id?: string): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "btn-painel-dia";
  b.textContent = texto;
  if (id) b.id = id;
  return b;
}

export interface OpcoesPopup {
  /** mostra o botao "Ver no Controle" (no Menu) */
  verNoControle?: boolean;
  /** clique numa conta (padrao: abre no Controle com ela selecionada) */
  aoEscolherConta?: (id: number) => void;
}

/** Abre o pop-up de tela cheia; a promessa termina quando ele e fechado. */
export function abrirMensagensDia(dados: AlertasDados, opcoes: OpcoesPopup = {}): Promise<void> {
  if (popupAberto) return Promise.resolve();
  const origem = document.activeElement as HTMLElement | null;
  const veu = document.createElement("div");
  veu.className = "dialogo-veu painel-expandido-veu";
  const caixa = document.createElement("div");
  caixa.className = "painel-expandido";
  caixa.setAttribute("role", "dialog");
  caixa.setAttribute("aria-modal", "true");
  caixa.setAttribute("aria-labelledby", "titulo-mensagens-expandidas");

  const cab = document.createElement("div");
  cab.className = "painel-expandido__cabecalho";
  const titulo = document.createElement("h2");
  titulo.id = "titulo-mensagens-expandidas";
  titulo.textContent = `Mensagens do dia — ${textoHoje(dados.hoje)}`;
  const acoes = document.createElement("div");
  acoes.className = "flex flex-wrap gap-2";
  const fechar = botaoPainel("Fechar ✕", "btn-fechar-mensagens");
  fechar.addEventListener("click", () => fecharPopup(veu, origem));
  if (opcoes.verNoControle) {
    const irControle = botaoPainel("Ver no Controle →");
    irControle.addEventListener("click", () => void irPara("todas-as-contas"));
    acoes.append(irControle);
  }
  acoes.append(fechar);
  cab.append(titulo, acoes);

  const corpo = document.createElement("div");
  corpo.className = "painel-expandido__corpo";
  const secaoContas = document.createElement("h3");
  secaoContas.className = "painel-expandido__secao";
  secaoContas.textContent = "Contas atrasadas e a vencer (próximos 10 dias)";
  const tabela = tabelaAlertas();
  const tbody = tabela.querySelector("tbody")!;
  tbody.id = "alertas-corpo-expandido";
  const padrao = escolherConta;
  if (opcoes.aoEscolherConta) {
    const escolher = opcoes.aoEscolherConta;
    escolherConta = (id) => {
      fecharPopup(veu, null);
      escolher(id);
    };
  }
  tbody.replaceChildren(...linhasContas(dados, Infinity));
  escolherConta = padrao;
  const moldura = document.createElement("div");
  moldura.className = "border-2 border-[#1c1b1b]";
  moldura.appendChild(tabela);
  const secaoRecados = document.createElement("h3");
  secaoRecados.className = "painel-expandido__secao";
  secaoRecados.textContent = "Recados de hoje";
  const lista = document.createElement("ul");
  lista.className = "recados-dia flex flex-col gap-2";
  lista.id = "recados-expandidos";
  renderRecados(lista, dados, Infinity);
  corpo.append(secaoContas, moldura, secaoRecados, lista);

  caixa.append(cab, corpo);
  veu.appendChild(caixa);
  veu.addEventListener("click", (evento) => {
    if (evento.target === veu) fecharPopup(veu, origem);
  });
  veu.addEventListener("keydown", (evento) => {
    if (evento.key === "Escape") {
      evento.preventDefault();
      evento.stopPropagation();
      fecharPopup(veu, origem);
    } else if (evento.key === "Tab") {
      // foco preso dentro do pop-up
      const focaveis = [...caixa.querySelectorAll<HTMLElement>("button, tr[tabindex]")];
      const i = focaveis.indexOf(document.activeElement as HTMLElement);
      const proximo = evento.shiftKey ? (i <= 0 ? focaveis.length - 1 : i - 1) : (i + 1) % focaveis.length;
      evento.preventDefault();
      focaveis[proximo]?.focus();
    }
  });
  document.body.appendChild(veu);
  popupAberto = true;
  document.body.dataset.mensagensExpandidas = "true";
  fechar.focus();
  return new Promise((ok) => {
    aoFecharPopup = ok;
  });
}
