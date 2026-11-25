import { AlertasDados, buscarAlertas, buscarBackupDrive, buscarStatus } from "../api";
import { notificar } from "../notificacoes";
import { confirmar, mostrarProgresso } from "../dialogos";
import { perfilAtual } from "../perfil";
import { criarBotaoConta } from "../conta-menu";
import { Tela, irPara } from "../navegacao";
import { respostaProvisoria } from "../componentes";
import { mostrarNovidades } from "../novidades";
import { abrirMensagensDia, linhasContas, linhaUnica, popupAberto, renderRecados, textoHoje } from "../mensagens-dia";

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

const MAX_RECADOS = 1;
let ultimosDados: AlertasDados | null = null;

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
    faixa.addEventListener("click", () => void abrirPopupMenu());
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
  const hoje = document.getElementById("alertas-hoje");
  if (hoje) hoje.textContent = textoHoje(dados.hoje);

  document.getElementById("alertas-corpo")?.replaceChildren(...linhasContas(dados, MAX_LINHAS));
  const recados = document.getElementById("recados-dia");
  if (recados) renderRecados(recados, dados, MAX_RECADOS);
  // sem recado hoje, a faixa some (sobra espaco para os botoes)
  document.getElementById("faixa-recados")?.classList.toggle("hidden", !dados.avisosHoje.length);
  const rodape = document.getElementById("alertas-rodape");
  if (rodape) rodape.textContent = resumoContas(dados);
  document.body.dataset.alertas = String(dados.atrasados.length + dados.aVencer.length);
}

/** Pop-up do Menu (com "Ver no Controle"); usa os dados ja carregados no painel. */
function abrirPopupMenu(): Promise<void> {
  return ultimosDados ? abrirMensagensDia(ultimosDados, { verNoControle: true }) : Promise.resolve();
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
  if (transborda(dados)) await abrirPopupMenu();
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
      // O QUE MUDOU (depois de atualizar) vem antes das mensagens; um pop-up por vez
      void mostrarNovidades().then(() => abrirMensagensAoEntrar(dados)).then(() => oferecerAtualizacao());
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
  document.getElementById("btn-expandir-mensagens")?.addEventListener("click", () => void abrirPopupMenu());
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
