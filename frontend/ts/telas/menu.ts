import { AlertaContaDados, AlertasDados, buscarAlertas, buscarStatus } from "../api";
import { formatarDataBR, formatarMoedaBR } from "../mascaras";
import { Tela, irPara } from "../navegacao";
import { respostaProvisoria } from "../componentes";

const MODULOS: Record<string, string> = {
  "inserir-conta": "INSERIR CONTA",
  "controle-de-contas": "CONTROLE",
  cadastros: "CADASTROS",
  "mensagens-e-avisos": "MENSAGENS",
  "graficos-e-relatorios": "GRÁFICOS",
};

const DESTINOS: Record<string, Tela> = {
  "inserir-conta": "inserir-conta",
  "controle-de-contas": "controle",
  cadastros: "cadastros",
  "mensagens-e-avisos": "mensagens",
  "graficos-e-relatorios": "graficos",
};

function acionarModulo(chave: string): void {
  const destino = DESTINOS[chave];
  if (destino) {
    void irPara(destino);
    return;
  }
  respostaProvisoria(MODULOS[chave] ?? chave);
}

function registrarBotoes(): void {
  document.querySelectorAll<HTMLAnchorElement>("a[data-path]").forEach((ancora) => {
    ancora.addEventListener("click", (evento) => {
      evento.preventDefault();
      const chave = ancora.dataset.path ?? "";
      const nome = MODULOS[chave] ?? chave;
      console.info(`[ContasAPagar] módulo "${nome}" acionado`);
      acionarModulo(chave);
    });
  });
  console.info(`[ContasAPagar] ${Object.keys(MODULOS).length} botões do menu registrados`);
}

function registrarAtalhos(): void {
  const atalhos: Record<string, string> = {
    F1: "inserir-conta",
    "1": "inserir-conta",
    F2: "controle-de-contas",
    "2": "controle-de-contas",
    F3: "mensagens-e-avisos",
    "3": "mensagens-e-avisos",
    F4: "graficos-e-relatorios",
    "4": "graficos-e-relatorios",
  };
  document.addEventListener("keydown", (evento) => {
    if (popupAberto) return;
    const alvo = atalhos[evento.key];
    if (!alvo) return;
    evento.preventDefault();
    document.querySelector<HTMLAnchorElement>(`a[data-path="${alvo}"]`)?.click();
  });
}

// ===== "Mensagens do dia": alertas reais (regra do VBA VerificarVencimentosAoAbrir) =====
// atrasadas de 1 a 15 dias + a vencer de hoje ate 10 dias + recados vigentes hoje.
const MAX_LINHAS = 3;
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

function celula(texto: string, classe: string, rotulo: string): HTMLTableCellElement {
  const td = document.createElement("td");
  td.className = classe;
  td.dataset.rotulo = rotulo;
  td.textContent = texto;
  return td;
}

function selo(texto: string, cores: string): HTMLSpanElement {
  const s = document.createElement("span");
  s.className = `inline-block border-2 border-[#1c1b1b] text-[11px] sm:text-xs font-bold uppercase px-2.5 py-0.5 ${cores}`;
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

function linhaAlerta(conta: AlertaContaDados): HTMLTableRowElement {
  const s = situacao(conta.dias);
  const tr = document.createElement("tr");
  tr.className = s.atrasada ? "bg-[#fff1ef]" : "hover:bg-[#fff9d6] transition-colors";
  tr.dataset.alerta = s.atrasada ? "atrasada" : "a-vencer";
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

function linhaUnica(texto: string, classe: string): HTMLTableRowElement {
  const tr = document.createElement("tr");
  const td = document.createElement("td");
  td.colSpan = 5;
  td.className = classe;
  td.textContent = texto;
  tr.appendChild(td);
  return tr;
}

const MAX_RECADOS = 2;
let ultimosDados: AlertasDados | null = null;

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

function renderRecados(lista: HTMLElement, dados: AlertasDados, limite: number): void {
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

function linhasContas(dados: AlertasDados, limite: number): HTMLTableRowElement[] {
  const todas = [...dados.atrasados, ...dados.aVencer];
  const linhas = todas.slice(0, limite).map(linhaAlerta);
  if (!todas.length) {
    linhas.push(linhaUnica("Tudo em dia! Nenhuma conta atrasada ou vencendo nos próximos 10 dias.", "p-3 text-center text-[#006c46] uppercase"));
  } else if (todas.length > limite) {
    const resto = todas.length - limite;
    linhas.push(linhaUnica(`+ ${resto} conta${resto > 1 ? "s" : ""} — use EXPANDIR para ver todas`, "p-2 text-center font-mono text-xs text-neutral-600 uppercase"));
  }
  return linhas;
}

function resumoContas(dados: AlertasDados): string {
  const partes: string[] = [];
  if (dados.atrasados.length) partes.push(`${dados.atrasados.length} atrasada${dados.atrasados.length > 1 ? "s" : ""}`);
  if (dados.aVencer.length) partes.push(`${dados.aVencer.length} a vencer`);
  const n = dados.avisosHoje.length;
  const recados = n ? ` · ${n} recado${n > 1 ? "s" : ""} hoje` : "";
  return (partes.length ? `Contas: ${partes.join(" e ")}` : "Contas: tudo em dia") + recados + ".";
}

function renderAlertas(dados: AlertasDados): void {
  ultimosDados = dados;
  const [ano, mes, dia] = dados.hoje.split("-").map(Number);
  const hoje = document.getElementById("alertas-hoje");
  if (hoje) hoje.textContent = `Hoje: ${dia} de ${MESES[mes - 1]} de ${ano}`;

  document.getElementById("alertas-corpo")?.replaceChildren(...linhasContas(dados, MAX_LINHAS));
  const recados = document.getElementById("recados-dia");
  if (recados) renderRecados(recados, dados, MAX_RECADOS);
  const rodape = document.getElementById("alertas-rodape");
  if (rodape) rodape.textContent = resumoContas(dados);
  document.body.dataset.alertas = String(dados.atrasados.length + dados.aVencer.length);
}

// ===== pop-up "Mensagens do dia" em tela cheia (todas as contas e recados) =====
let popupAberto = false;

function fecharPopup(veu: HTMLElement, origem: HTMLElement | null): void {
  veu.remove();
  popupAberto = false;
  delete document.body.dataset.mensagensExpandidas;
  origem?.focus();
}

function botaoPainel(texto: string, id?: string): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "btn-painel-dia";
  b.textContent = texto;
  if (id) b.id = id;
  return b;
}

function abrirPopup(): void {
  if (popupAberto) return;
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
  const hoje = document.getElementById("alertas-hoje")?.textContent ?? "";
  titulo.textContent = `Mensagens do dia${hoje ? ` — ${hoje}` : ""}`;
  const acoes = document.createElement("div");
  acoes.className = "flex flex-wrap gap-2";
  const irControle = botaoPainel("Ver no Controle →");
  irControle.addEventListener("click", () => void irPara("todas-as-contas"));
  const fechar = botaoPainel("Fechar ✕", "btn-fechar-mensagens");
  fechar.addEventListener("click", () => fecharPopup(veu, origem));
  acoes.append(irControle, fechar);
  cab.append(titulo, acoes);

  const corpo = document.createElement("div");
  corpo.className = "painel-expandido__corpo";
  const secaoContas = document.createElement("h3");
  secaoContas.className = "painel-expandido__secao";
  secaoContas.textContent = "Contas atrasadas e a vencer (próximos 10 dias)";
  const tabela = document.querySelector("#painel-mensagens-dia table")!.cloneNode(true) as HTMLTableElement;
  const tbody = tabela.querySelector("tbody")!;
  tbody.id = "alertas-corpo-expandido";
  if (ultimosDados) tbody.replaceChildren(...linhasContas(ultimosDados, Infinity));
  const moldura = document.createElement("div");
  moldura.className = "border-2 border-[#1c1b1b]";
  moldura.appendChild(tabela);
  const secaoRecados = document.createElement("h3");
  secaoRecados.className = "painel-expandido__secao";
  secaoRecados.textContent = "Recados de hoje";
  const lista = document.createElement("ul");
  lista.className = "recados-dia flex flex-col gap-2";
  lista.id = "recados-expandidos";
  if (ultimosDados) renderRecados(lista, ultimosDados, Infinity);
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
      const focaveis = [...caixa.querySelectorAll<HTMLElement>("button")];
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
}

function erroAlertas(): void {
  const corpo = document.getElementById("alertas-corpo");
  corpo?.replaceChildren(linhaUnica("Não foi possível carregar as contas do dia. Abra CONTROLE para conferir.", "p-3 text-center text-[#ba1a1a] uppercase"));
}

async function iniciar(): Promise<void> {
  try {
    if (!window.finDesk) {
      throw new Error("configuração indisponível");
    }
    const cfg = await window.finDesk.config();
    const status = await buscarStatus(cfg);
    document.body.dataset.apiStatus = "ok";
    document.title += " - API OK";
    console.info("[ContasAPagar] API:", status);
    try {
      renderAlertas(await buscarAlertas(cfg));
    } catch (erro) {
      erroAlertas();
      console.warn("[ContasAPagar] alertas indisponiveis:", erro instanceof Error ? erro.message : erro);
    }
  } catch (erro) {
    document.body.dataset.apiStatus = "erro";
    document.title += " - API OFFLINE";
    erroAlertas();
    console.warn("[ContasAPagar] sonda de API nao concluida (navegacao ou indisponibilidade):", erro instanceof Error ? erro.message : erro);
  }
}

/** Botoes do painel "Mensagens do dia": expandir (pop-up) e ir para o Controle. */
function registrarPainelMensagens(): void {
  document.getElementById("btn-expandir-mensagens")?.addEventListener("click", abrirPopup);
  document.getElementById("btn-ir-controle")?.addEventListener("click", () => void irPara("todas-as-contas"));
}

export function iniciarMenu(): void {
  registrarBotoes();
  registrarPainelMensagens();
  registrarAtalhos();
  void iniciar();
}
