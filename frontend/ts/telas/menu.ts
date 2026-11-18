import { AlertaContaDados, AlertasDados, buscarAlertas, buscarBackupDrive, buscarStatus } from "../api";
import { notificar } from "../notificacoes";
import { confirmar, mostrarProgresso } from "../dialogos";
import { perfilAtual } from "../perfil";
import { criarBotaoConta } from "../conta-menu";
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
// os 5 botoes sao o mais importante do Menu: o painel mostra so as 2 contas mais
// urgentes (atrasadas primeiro, depois as que vencem antes); o resto fica no EXPANDIR
const MAX_LINHAS = 2;
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

const MAX_RECADOS = 1;
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

/** Mais urgente primeiro: a mais atrasada, depois as que vencem antes. */
function porPrioridade(dados: AlertasDados): AlertaContaDados[] {
  return [...dados.atrasados, ...dados.aVencer].sort((a, b) => a.dias - b.dias);
}

function linhasContas(dados: AlertasDados, limite: number): HTMLTableRowElement[] {
  const todas = porPrioridade(dados);
  const linhas = todas.slice(0, limite).map(linhaAlerta);
  if (!todas.length) {
    linhas.push(linhaUnica("Tudo em dia! Nenhuma conta atrasada ou vencendo nos próximos 10 dias.", "p-3 text-center text-[#006c46] uppercase"));
  }
  return linhas;
}

function resumoContas(dados: AlertasDados): string {
  const partes: string[] = [];
  if (dados.atrasados.length) partes.push(`${dados.atrasados.length} atrasada${dados.atrasados.length > 1 ? "s" : ""}`);
  if (dados.aVencer.length) partes.push(`${dados.aVencer.length} a vencer`);
  const n = dados.avisosHoje.length;
  const recados = n ? ` · ${n} recado${n > 1 ? "s" : ""} hoje` : "";
  const resto = dados.atrasados.length + dados.aVencer.length - MAX_LINHAS;
  const mais = resto > 0 ? ` · mais ${resto} em EXPANDIR` : "";
  return (partes.length ? `Contas: ${partes.join(" e ")}` : "Contas: tudo em dia") + recados + mais + ".";
}

/** Mais coisa do que cabe no painel: ele fica recolhido numa faixa "MENSAGENS URGENTES". */
function transborda(dados: AlertasDados): boolean {
  return dados.atrasados.length + dados.aVencer.length > MAX_LINHAS || dados.avisosHoje.length > MAX_RECADOS;
}

/** Faixa fina no lugar do painel: os botoes do Menu ficam com o espaco todo. */
function renderRecolhido(dados: AlertasDados): void {
  const painel = document.getElementById("painel-mensagens-dia");
  if (!painel) return;
  const recolher = transborda(dados);
  painel.classList.toggle("painel-recolhido", recolher);
  document.body.dataset.mensagensRecolhidas = String(recolher);
  let faixa = document.getElementById("mensagens-recolhidas") as HTMLButtonElement | null;
  if (!recolher) {
    faixa?.remove();
    return;
  }
  if (!faixa) {
    faixa = document.createElement("button");
    faixa.type = "button";
    faixa.id = "mensagens-recolhidas";
    faixa.className = "mensagens-recolhidas";
    faixa.setAttribute("aria-haspopup", "dialog");
    faixa.addEventListener("click", () => void abrirPopup());
    painel.prepend(faixa);
  }
  const icone = document.createElement("span");
  icone.className = "material-symbols-outlined";
  icone.setAttribute("aria-hidden", "true");
  icone.textContent = dados.atrasados.length ? "warning" : "calendar_clock";
  const titulo = document.createElement("strong");
  titulo.textContent = "Mensagens urgentes";
  const resumo = document.createElement("span");
  resumo.className = "mensagens-recolhidas__resumo";
  resumo.textContent = resumoContas(dados).replace(/ · mais \d+ em EXPANDIR/, "");
  const abrir = document.createElement("span");
  abrir.className = "mensagens-recolhidas__abrir";
  abrir.textContent = "Abrir ↗";
  faixa.classList.toggle("mensagens-recolhidas--atrasada", dados.atrasados.length > 0);
  faixa.replaceChildren(icone, titulo, resumo, abrir);
}

function renderAlertas(dados: AlertasDados): void {
  ultimosDados = dados;
  renderRecolhido(dados);
  const [ano, mes, dia] = dados.hoje.split("-").map(Number);
  const hoje = document.getElementById("alertas-hoje");
  if (hoje) hoje.textContent = `Hoje: ${dia} de ${MESES[mes - 1]} de ${ano}`;

  document.getElementById("alertas-corpo")?.replaceChildren(...linhasContas(dados, MAX_LINHAS));
  const recados = document.getElementById("recados-dia");
  if (recados) renderRecados(recados, dados, MAX_RECADOS);
  // sem recado hoje, a faixa some (sobra espaco para os botoes)
  document.getElementById("faixa-recados")?.classList.toggle("hidden", !dados.avisosHoje.length);
  const rodape = document.getElementById("alertas-rodape");
  if (rodape) rodape.textContent = resumoContas(dados);
  document.body.dataset.alertas = String(dados.atrasados.length + dados.aVencer.length);
}

// ===== pop-up "Mensagens do dia" em tela cheia (todas as contas e recados) =====
let popupAberto = false;
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

/** Abre o pop-up de tela cheia; a promessa termina quando ele e fechado. */
function abrirPopup(): Promise<void> {
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
  return new Promise((ok) => {
    aoFecharPopup = ok;
  });
}

// ao entrar com o PIN, se as mensagens nao cabem no painel, elas abrem sozinhas
// (uma vez por entrada: o token muda a cada login)
const CHAVE_MENSAGENS_VISTAS = "contas.mensagensVistas";

async function abrirMensagensAoEntrar(dados: AlertasDados): Promise<void> {
  const token = perfilAtual()?.token ?? "";
  try {
    if (sessionStorage.getItem(CHAVE_MENSAGENS_VISTAS) === token) return;
    sessionStorage.setItem(CHAVE_MENSAGENS_VISTAS, token);
  } catch {
    return;
  }
  if (transborda(dados)) await abrirPopup();
}

function erroAlertas(): void {
  const corpo = document.getElementById("alertas-corpo");
  corpo?.replaceChildren(linhaUnica("Não foi possível carregar as contas do dia. Abra CONTROLE para conferir.", "p-3 text-center text-[#ba1a1a] uppercase"));
}

// ===== backup da abertura no Google Drive: avisa so se falhar (uma vez por sessao) =====
async function conferirBackupDrive(cfg: FinDeskConfig): Promise<void> {
  try {
    if (sessionStorage.getItem("findesk:backup-drive-avisado")) return;
  } catch {
    // sem sessionStorage: segue e avisa
  }
  for (let tentativa = 0; tentativa < 20; tentativa++) {
    const s = await buscarBackupDrive(cfg).catch(() => null);
    if (!s) return;
    document.body.dataset.backupDrive = s.estado;
    if (s.estado === "erro") {
      notificar(`Backup no Google Drive: ${s.mensagem}`, "erro");
      try {
        sessionStorage.setItem("findesk:backup-drive-avisado", "1");
      } catch {
        // ignora
      }
      return;
    }
    if (s.estado !== "aguardando" && s.estado !== "executando") return;
    await new Promise((ok) => setTimeout(ok, 1500));
  }
}

// ===== atualizacao pelo Google Drive: aviso fixo com o botao ATUALIZAR =====
function megas(bytes: number): string {
  return (bytes / (1024 * 1024)).toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

/** Versao nova no GitHub: pop-up no meio da tela; ao ATUALIZAR, barra de carregamento ate fechar. */
async function oferecerAtualizacao(): Promise<void> {
  const nova = await window.finDesk?.atualizacaoDisponivel?.().catch(() => null);
  if (!nova) return;
  document.body.dataset.atualizacao = nova.versao;
  const quer = await confirmar({
    titulo: `Nova versão ${nova.versao}`,
    mensagem: `Você usa a ${nova.atual}. Atualizar agora? O sistema fecha e abre de novo sozinho; os dados ficam (antes de mudar o banco ele faz um backup).`,
    detalhes: nova.novidades || undefined,
    textoConfirmar: "ATUALIZAR",
    textoCancelar: "AGORA NÃO",
    icone: "system_update",
  });
  if (!quer) return;
  const progresso = mostrarProgresso(`Atualizando para a versão ${nova.versao}`, "Começando o download...");
  document.body.dataset.atualizando = "true";
  window.finDesk!.onProgressoAtualizacao?.(({ recebidos, total }) => {
    if (total > 0 && recebidos >= total) {
      progresso.atualizar(1, "Download concluído. Conferindo e instalando: o sistema vai fechar e abrir de novo sozinho.");
    } else if (total > 0) {
      progresso.atualizar(recebidos / total, `Baixando... ${Math.floor((recebidos / total) * 100)}% (${megas(recebidos)} de ${megas(total)} MB)`);
    } else {
      progresso.atualizar(null, `Baixando... ${megas(recebidos)} MB`);
    }
  });
  const ok = await window.finDesk!.instalarAtualizacao();
  if (ok) {
    progresso.atualizar(1, "Instalando: o sistema vai fechar e abrir de novo sozinho. Não desligue o computador.");
    return;
  }
  progresso.fechar();
  delete document.body.dataset.atualizando;
  notificar("A atualização não foi feita agora. O sistema continua funcionando normalmente; tente de novo pelo aviso que aparece ao abrir o Menu.", "erro");
}

async function iniciar(): Promise<void> {
  try {
    if (!window.finDesk) {
      throw new Error("configuração indisponível");
    }
    const cfg = await window.finDesk.config();
    // versao instalada no rodape do Menu (para conferir se a atualizacao entrou)
    if (cfg.versao) document.getElementById("versao-sistema")!.textContent = `Contas a Pagar · Chaveiro Universal · versão ${cfg.versao}`;
    const status = await buscarStatus(cfg);
    document.body.dataset.apiStatus = "ok";
    document.title += " - API OK";
    console.info("[ContasAPagar] API:", status);
    try {
      const dados = await buscarAlertas(cfg);
      renderAlertas(dados);
      void conferirBackupDrive(cfg);
      // o aviso de versao nova espera as mensagens serem fechadas (um pop-up por vez)
      void abrirMensagensAoEntrar(dados).then(() => oferecerAtualizacao());
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
  document.getElementById("btn-expandir-mensagens")?.addEventListener("click", () => void abrirPopup());
  document.getElementById("btn-ir-controle")?.addEventListener("click", () => void irPara("todas-as-contas"));
}

/** Sem perfil escolhido, volta para "Quem esta usando?" (como na Netflix). */
function mostrarPerfil(): boolean {
  const perfil = perfilAtual();
  if (!perfil) {
    void window.finDesk?.navegar("perfis");
    return false;
  }
  // um botao so para a conta: MINHA CONTA ou SAIR E TROCAR DE CONTA
  document.getElementById("menu-conta")!.replaceChildren(criarBotaoConta(perfil, "menu-perfil"));
  document.body.dataset.perfil = perfil.nome;
  return true;
}

export function iniciarMenu(): void {
  if (!mostrarPerfil()) return;
  registrarBotoes();
  registrarPainelMensagens();
  registrarAtalhos();
  void iniciar();
}
