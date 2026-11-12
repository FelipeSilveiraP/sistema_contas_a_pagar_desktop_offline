// Notificacoes (toasts) — resultado de uma acao: "Conta salva.", "Pagamento desfeito."
// Regras (WAI-ARIA / NN/g, ver docs/decisoes.md):
// - sucesso/info: role=status (polite), somem em 5s, pausam com mouse/foco em cima;
// - erro: role=alert (assertive), NAO some sozinho (o usuario fecha);
// - no maximo 3 na tela; regioes vivas criadas UMA vez por pagina (antes de qualquer texto);
// - nunca pedem decisao (isso e dialogos.ts) e nunca substituem erro de campo (inline).
// DOM seguro: so textContent.

export type TipoNotificacao = "sucesso" | "erro" | "info";

const DURACAO_MS = 5000;
const MAXIMO = 2;
const CHAVE_PENDENTE = "findesk:notificacao-pendente";

const ICONES: Record<TipoNotificacao, string> = { sucesso: "check_circle", erro: "error", info: "info" };

let regiaoEducada: HTMLElement | null = null;
let regiaoUrgente: HTMLElement | null = null;

function regiao(tipo: TipoNotificacao): HTMLElement {
  if (!regiaoEducada || !regiaoUrgente || !regiaoEducada.isConnected) iniciarNotificacoes();
  return tipo === "erro" ? regiaoUrgente! : regiaoEducada!;
}

/** Cria as regioes vivas vazias e exibe a notificacao deixada pela tela anterior. */
export function iniciarNotificacoes(): void {
  if (regiaoEducada?.isConnected) return;
  const pilha = document.createElement("div");
  pilha.className = "notificacoes";
  regiaoEducada = document.createElement("div");
  regiaoEducada.setAttribute("role", "status");
  regiaoEducada.setAttribute("aria-live", "polite");
  regiaoEducada.className = "notificacoes__regiao";
  regiaoUrgente = document.createElement("div");
  regiaoUrgente.setAttribute("role", "alert");
  regiaoUrgente.setAttribute("aria-live", "assertive");
  regiaoUrgente.className = "notificacoes__regiao";
  pilha.append(regiaoUrgente, regiaoEducada);
  document.body.appendChild(pilha);

  try {
    const pendente = sessionStorage.getItem(CHAVE_PENDENTE);
    if (pendente) {
      sessionStorage.removeItem(CHAVE_PENDENTE);
      const { mensagem, tipo } = JSON.parse(pendente) as { mensagem: string; tipo: TipoNotificacao };
      // espera um ciclo para o leitor de tela registrar a regiao vazia antes do texto
      window.setTimeout(() => notificar(mensagem, tipo), 50);
    }
  } catch {
    // sessionStorage indisponivel: sem notificacao pendente
  }
}

/** Mostra uma notificacao. Opcionalmente com um botao de acao (ex.: DESFAZER). */
export function notificar(
  mensagem: string,
  tipo: TipoNotificacao = "sucesso",
  acao?: { rotulo: string; aoClicar: () => void },
  opcoes: { fixa?: boolean } = {},
): void {
  const alvo = regiao(tipo);
  const todas = document.querySelectorAll(".notificacao");
  if (todas.length >= MAXIMO) todas[0].remove();

  const item = document.createElement("div");
  item.className = "notificacao";
  item.dataset.notificacao = tipo;

  const icone = document.createElement("span");
  icone.className = "material-symbols-outlined notificacao__icone";
  icone.setAttribute("aria-hidden", "true");
  icone.textContent = ICONES[tipo];

  const texto = document.createElement("p");
  texto.className = "notificacao__texto";
  texto.textContent = mensagem;

  item.append(icone, texto);

  let timer: number | undefined;
  const fechar = (): void => {
    if (timer !== undefined) window.clearTimeout(timer);
    item.remove();
  };
  const agendar = (): void => {
    if (tipo === "erro" || opcoes.fixa) return;
    if (timer !== undefined) window.clearTimeout(timer);
    timer = window.setTimeout(fechar, DURACAO_MS);
  };

  if (acao) {
    const botaoAcao = document.createElement("button");
    botaoAcao.type = "button";
    botaoAcao.className = "notificacao__acao";
    botaoAcao.textContent = acao.rotulo;
    botaoAcao.addEventListener("click", () => {
      fechar();
      acao.aoClicar();
    });
    item.appendChild(botaoAcao);
  }

  const botaoFechar = document.createElement("button");
  botaoFechar.type = "button";
  botaoFechar.className = "notificacao__fechar";
  botaoFechar.setAttribute("aria-label", "Fechar aviso");
  botaoFechar.textContent = "×";
  botaoFechar.addEventListener("click", fechar);
  item.appendChild(botaoFechar);

  // pausa enquanto o usuario usa o teclado nos botoes do aviso. O corpo do aviso
  // deixa o clique PASSAR para a tela (pointer-events: none no CSS): um aviso
  // nunca pode bloquear o botao que esta embaixo dele (ex.: PAGO, APLICAR).
  item.addEventListener("focusin", () => timer !== undefined && window.clearTimeout(timer));
  item.addEventListener("focusout", agendar);

  alvo.appendChild(item);
  agendar();
}

/** Guarda a notificacao para a PROXIMA tela (quando a acao termina navegando). */
export function notificarAoAbrir(mensagem: string, tipo: TipoNotificacao = "sucesso"): void {
  try {
    sessionStorage.setItem(CHAVE_PENDENTE, JSON.stringify({ mensagem, tipo }));
  } catch {
    notificar(mensagem, tipo);
  }
}
