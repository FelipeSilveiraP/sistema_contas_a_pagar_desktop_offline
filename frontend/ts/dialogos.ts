// Confirmacoes neobrutalistas (substituem window.alert/confirm/prompt — PROIBIDOS:
// dialogos nativos causavam o bug de foco dos inputs no Electron/Windows).
//
// Usar SO quando o usuario precisa DECIDIR algo que nao da para desfazer facil:
// sair sem salvar, excluir, desfazer pagamento, cadastrar conta parecida.
// Resultado de acao ("salvo", "excluido") -> notificacoes.ts. Erro de campo -> inline.
//
// Acessibilidade (WAI-ARIA APG alertdialog): role=alertdialog, aria-modal,
// aria-labelledby (titulo) + aria-describedby (mensagem), foco inicial na acao
// SEGURA (cancelar), Tab preso, ESC cancela, clique fora nao fecha, fundo inert,
// foco devolvido ao fechar, fila serial (um dialogo por vez).
// Testes: data-dialogo (tom), data-dialogo-titulo, data-dialogo-mensagem, data-dialogo-acao.

export type TomConfirmacao = "normal" | "atencao" | "perigo";

export interface OpcoesConfirmacao {
  titulo: string;
  mensagem: string;
  /** verbo da acao, ex.: "EXCLUIR", "SAIR SEM SALVAR" */
  textoConfirmar: string;
  textoCancelar?: string;
  detalhes?: string;
  tom?: TomConfirmacao;
  /** terceiro botao (ex.: "SALVAR NO COMPUTADOR"), entre cancelar e confirmar */
  textoAlternativa?: string;
  icone?: string;
}

export type RespostaDialogo = "confirmar" | "alternativa" | "cancelar";

interface Pedido {
  opcoes: OpcoesConfirmacao;
  resolver: (resposta: RespostaDialogo) => void;
}

const ICONES: Record<TomConfirmacao, string> = { normal: "help", atencao: "warning", perigo: "delete_forever" };

const fila: Pedido[] = [];
let processando = false;
let dialogoAberto = false;

export function dialogoEstaAberto(): boolean {
  return dialogoAberto;
}

async function processarFila(): Promise<void> {
  if (processando) return;
  processando = true;
  while (fila.length > 0) {
    const pedido = fila.shift();
    if (!pedido) break;
    pedido.resolver(await montar(pedido.opcoes));
  }
  processando = false;
}

function botao(acao: RespostaDialogo, rotulo: string): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.dataset.dialogoAcao = acao;
  b.className = acao === "confirmar" ? "dialogo-botao dialogo-botao--acao" : "dialogo-botao dialogo-botao--neutro";
  b.textContent = rotulo;
  return b;
}

function definirFundoInerte(inerte: boolean): void {
  for (const filho of Array.from(document.body.children)) {
    if (filho.classList.contains("dialogo-veu") || filho.classList.contains("notificacoes")) continue;
    if (inerte) filho.setAttribute("inert", "");
    else filho.removeAttribute("inert");
  }
}

function montar(opcoes: OpcoesConfirmacao): Promise<RespostaDialogo> {
  return new Promise<RespostaDialogo>((resolver) => {
    const tom = opcoes.tom ?? "normal";
    const anterior = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const veu = document.createElement("div");
    veu.className = "dialogo-veu";

    const caixa = document.createElement("div");
    caixa.className = opcoes.textoAlternativa ? "dialogo dialogo--largo" : "dialogo";
    caixa.setAttribute("role", "alertdialog");
    caixa.setAttribute("aria-modal", "true");
    caixa.setAttribute("aria-labelledby", "dialogo-titulo");
    caixa.setAttribute("aria-describedby", "dialogo-mensagem");
    caixa.dataset.dialogo = tom;

    const cabecalho = document.createElement("div");
    cabecalho.className = "dialogo__cabecalho";
    const icone = document.createElement("span");
    icone.className = "material-symbols-outlined dialogo__icone";
    icone.setAttribute("aria-hidden", "true");
    icone.textContent = opcoes.icone ?? ICONES[tom];
    const titulo = document.createElement("h2");
    titulo.className = "dialogo__titulo";
    titulo.id = "dialogo-titulo";
    titulo.dataset.dialogoTitulo = "";
    titulo.textContent = opcoes.titulo;
    cabecalho.append(icone, titulo);

    const corpo = document.createElement("div");
    corpo.className = "dialogo__corpo";
    const mensagem = document.createElement("p");
    mensagem.className = "dialogo__mensagem";
    mensagem.id = "dialogo-mensagem";
    mensagem.dataset.dialogoMensagem = "";
    mensagem.textContent = opcoes.mensagem;
    corpo.appendChild(mensagem);
    if (opcoes.detalhes) {
      const detalhes = document.createElement("p");
      detalhes.className = "dialogo__detalhes";
      detalhes.dataset.dialogoDetalhes = "";
      detalhes.textContent = opcoes.detalhes;
      corpo.appendChild(detalhes);
    }

    const acoes = document.createElement("div");
    acoes.className = "dialogo__acoes";
    const cancelar = botao("cancelar", opcoes.textoCancelar ?? "CANCELAR");
    const confirmar = botao("confirmar", opcoes.textoConfirmar);
    const alternativa = opcoes.textoAlternativa ? botao("alternativa", opcoes.textoAlternativa) : null;
    if (alternativa) acoes.append(cancelar, alternativa, confirmar);
    else acoes.append(cancelar, confirmar);

    caixa.append(cabecalho, corpo, acoes);
    veu.appendChild(caixa);
    document.body.appendChild(veu);
    definirFundoInerte(true);
    dialogoAberto = true;

    let concluido = false;
    const fechar = (resposta: RespostaDialogo): void => {
      if (concluido) return;
      concluido = true;
      veu.remove();
      definirFundoInerte(false);
      dialogoAberto = false;
      document.removeEventListener("keydown", aoTeclar, true);
      if (anterior && anterior.isConnected) anterior.focus();
      resolver(resposta);
    };

    const aoTeclar = (evento: KeyboardEvent): void => {
      if (evento.key === "Escape") {
        evento.preventDefault();
        evento.stopPropagation();
        fechar("cancelar");
        return;
      }
      if (evento.key === "Tab") {
        const atual = document.activeElement;
        if (evento.shiftKey && atual === cancelar) {
          evento.preventDefault();
          confirmar.focus();
        } else if (!evento.shiftKey && atual === confirmar) {
          evento.preventDefault();
          cancelar.focus();
        }
      }
    };

    cancelar.addEventListener("click", () => fechar("cancelar"));
    confirmar.addEventListener("click", () => fechar("confirmar"));
    alternativa?.addEventListener("click", () => fechar("alternativa"));
    veu.addEventListener("mousedown", (evento) => {
      if (evento.target === veu) evento.preventDefault();
    });
    document.addEventListener("keydown", aoTeclar, true);
    cancelar.focus();
  });
}

/** Confirmacao generica — prefira as especificas abaixo. */
export function confirmar(opcoes: OpcoesConfirmacao): Promise<boolean> {
  return escolher(opcoes).then((resposta) => resposta === "confirmar");
}

/** Pergunta com ate 3 respostas (use `textoAlternativa` para o terceiro botao). */
export function escolher(opcoes: OpcoesConfirmacao): Promise<RespostaDialogo> {
  return new Promise<RespostaDialogo>((resolver) => {
    fila.push({ opcoes, resolver });
    void processarFila();
  });
}

/** Sair de um formulario com alteracoes nao salvas. */
export function confirmarSaida(): Promise<boolean> {
  return confirmar({
    titulo: "SAIR SEM SALVAR?",
    mensagem: "O que você digitou nesta tela ainda não foi salvo e será perdido.",
    textoCancelar: "CONTINUAR EDITANDO",
    textoConfirmar: "SAIR SEM SALVAR",
    tom: "atencao",
  });
}

/** Exclusao definitiva. `oQue` ex.: 'a conta de "Aluguel"', 'o banco "Itaú"'. */
export function confirmarExclusao(oQue: string): Promise<boolean> {
  return confirmar({
    titulo: "EXCLUIR?",
    mensagem: `Excluir ${oQue}? Depois de excluído, não dá para recuperar.`,
    textoConfirmar: "EXCLUIR",
    tom: "perigo",
  });
}

/** Desfazer a baixa de pagamento (estorno). */
export function confirmarEstorno(nomeEmpresa: string): Promise<boolean> {
  return confirmar({
    titulo: "DESFAZER PAGAMENTO?",
    mensagem: `O pagamento de "${nomeEmpresa}" será desfeito e a conta voltará a ficar pendente.`,
    textoConfirmar: "DESFAZER PAGAMENTO",
    tom: "normal",
  });
}

/** Conta muito parecida com outra do mesmo mes (regra de duplicidade do VBA). */
export function confirmarDuplicidade(detalhes: string): Promise<boolean> {
  return confirmar({
    titulo: "CONTA PARECIDA JÁ EXISTE",
    mensagem: "Já existe uma conta muito parecida com esta no mesmo mês. Confira antes de continuar:",
    detalhes,
    textoConfirmar: "CADASTRAR MESMO ASSIM",
    tom: "atencao",
  });
}
