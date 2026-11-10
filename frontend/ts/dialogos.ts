// Sistema global de dialogos neobrutalistas (substitui window.alert/confirm/prompt).
// Componente unico, reutilizavel em todas as telas, com API assincrona que
// devolve a escolha do usuario. Sem frameworks, DOM seguro (textContent),
// acessibilidade de dialogo (role/aria-modal/titulo/foco) e sem bloquear a
// pagina apos o fechamento (overlay e removido do DOM).
//
// Registro de uso nos testes: elementos carregam data-dialogo,
// data-dialogo-titulo, data-dialogo-mensagem e data-dialogo-acao.

export type TipoDialogo = "confirmacao" | "aviso" | "sucesso" | "erro" | "informacao" | "recorrencia";

export interface OpcoesDialogo {
  titulo?: string;
  mensagem: string;
  tipo?: TipoDialogo;
  textoConfirmar?: string;
  textoCancelar?: string;
  detalhes?: string;
}

interface PedidoDialogo {
  opcoes: Required<Pick<OpcoesDialogo, "mensagem" | "tipo">> & Omit<OpcoesDialogo, "mensagem" | "tipo">;
  resolver: (confirmado: boolean) => void;
}

const TITULOS: Record<TipoDialogo, string> = {
  confirmacao: "CONFIRMAR",
  aviso: "AVISO",
  sucesso: "SUCESSO",
  erro: "ERRO",
  informacao: "INFORMAÇÃO",
  recorrencia: "RECORRÊNCIA",
};

const ICONES: Record<TipoDialogo, string> = {
  confirmacao: "help",
  aviso: "warning",
  sucesso: "check_circle",
  erro: "error",
  informacao: "info",
  recorrencia: "autorenew",
};

let fila: PedidoDialogo[] = [];
let processando = false;
let dialogoAberto = false;

export function dialogoEstaAberto(): boolean {
  return dialogoAberto;
}

function enfileirar(opcoes: PedidoDialogo["opcoes"]): Promise<boolean> {
  return new Promise<boolean>((resolver) => {
    fila.push({ opcoes, resolver });
    void processarFila();
  });
}

async function processarFila(): Promise<void> {
  if (processando) return;
  processando = true;
  while (fila.length > 0) {
    const pedido = fila.shift();
    if (!pedido) break;
    pedido.resolver(await montarDialogo(pedido.opcoes));
  }
  processando = false;
}

function botaoHtml(acao: string, rotulo: string, destaque: boolean): HTMLButtonElement {
  const botao = document.createElement("button");
  botao.type = "button";
  botao.dataset.dialogoAcao = acao;
  botao.className = destaque
    ? "dialogo-botao dialogo-botao--destaque"
    : "dialogo-botao dialogo-botao--neutro";
  botao.textContent = rotulo;
  return botao;
}

function montarDialogo(opcoes: PedidoDialogo["opcoes"]): Promise<boolean> {
  return new Promise<boolean>((resolver) => {
    const tipo = opcoes.tipo;
    const anterior = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const veu = document.createElement("div");
    veu.className = "dialogo-veu";

    const caixa = document.createElement("div");
    caixa.className = "dialogo";
    caixa.setAttribute("role", "dialog");
    caixa.setAttribute("aria-modal", "true");
    caixa.setAttribute("aria-labelledby", "dialogo-titulo");
    caixa.dataset.dialogo = tipo;

    const cabecalho = document.createElement("div");
    cabecalho.className = "dialogo__cabecalho";

    const icone = document.createElement("span");
    icone.className = "material-symbols-outlined dialogo__icone";
    icone.setAttribute("aria-hidden", "true");
    icone.textContent = ICONES[tipo];

    const titulo = document.createElement("h2");
    titulo.className = "dialogo__titulo";
    titulo.id = "dialogo-titulo";
    titulo.dataset.dialogoTitulo = "";
    titulo.textContent = opcoes.titulo ?? TITULOS[tipo];

    cabecalho.append(icone, titulo);

    const corpo = document.createElement("div");
    corpo.className = "dialogo__corpo";

    const mensagem = document.createElement("p");
    mensagem.className = "dialogo__mensagem";
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

    const comEscolha = Boolean(opcoes.textoConfirmar);
    const botoes: HTMLButtonElement[] = [];
    if (comEscolha) {
      const cancelar = botaoHtml("cancelar", opcoes.textoCancelar ?? "CANCELAR", false);
      const confirmar = botaoHtml("confirmar", opcoes.textoConfirmar ?? "CONFIRMAR", true);
      if (tipo === "erro") confirmar.classList.add("dialogo-botao--perigo");
      if (tipo === "recorrencia") confirmar.classList.add("dialogo-botao--roxo");
      botoes.push(cancelar, confirmar);
    } else {
      botoes.push(botaoHtml("fechar", "FECHAR", true));
    }
    acoes.append(...botoes);

    caixa.append(cabecalho, corpo, acoes);
    veu.appendChild(caixa);
    document.body.appendChild(veu);
    dialogoAberto = true;

    let concluido = false;
    const fechar = (confirmado: boolean): void => {
      if (concluido) return;
      concluido = true;
      veu.remove();
      dialogoAberto = false;
      document.removeEventListener("keydown", aoTeclar, true);
      if (anterior && anterior.isConnected) anterior.focus();
      resolver(confirmado);
    };

    const aoTeclar = (evento: KeyboardEvent): void => {
      if (evento.key === "Escape") {
        evento.preventDefault();
        evento.stopPropagation();
        fechar(false);
        return;
      }
      if (evento.key === "Tab") {
        const focaveis = [...caixa.querySelectorAll<HTMLButtonElement>("button")];
        const primeiro = focaveis[0];
        const ultimo = focaveis[focaveis.length - 1];
        if (!primeiro || !ultimo) return;
        const atual = document.activeElement;
        if (evento.shiftKey && atual === primeiro) {
          evento.preventDefault();
          ultimo.focus();
        } else if (!evento.shiftKey && atual === ultimo) {
          evento.preventDefault();
          primeiro.focus();
        }
      }
    };

    for (const botao of botoes) {
      botao.addEventListener("click", () => fechar(botao.dataset.dialogoAcao === "confirmar" || botao.dataset.dialogoAcao === "fechar"));
    }

    veu.addEventListener("mousedown", (evento) => {
      if (evento.target === veu) evento.preventDefault();
    });

    document.addEventListener("keydown", aoTeclar, true);
    botoes[0].focus();
  });
}

export function confirmar(mensagem: string, opcoes: Omit<OpcoesDialogo, "mensagem"> = {}): Promise<boolean> {
  return enfileirar({
    mensagem,
    tipo: opcoes.tipo ?? "confirmacao",
    titulo: opcoes.titulo,
    textoConfirmar: opcoes.textoConfirmar ?? "CONFIRMAR",
    textoCancelar: opcoes.textoCancelar ?? "CANCELAR",
    detalhes: opcoes.detalhes,
  });
}

export function confirmarExclusao(mensagem: string): Promise<boolean> {
  return enfileirar({
    mensagem,
    tipo: "erro",
    titulo: "CONFIRMAR EXCLUSÃO",
    textoConfirmar: "EXCLUIR",
    textoCancelar: "CANCELAR",
  });
}

export function confirmarDuplicidade(mensagem: string, detalhes?: string): Promise<boolean> {
  return enfileirar({
    mensagem,
    tipo: "aviso",
    titulo: "POSSÍVEL DUPLICIDADE",
    textoConfirmar: "CADASTRAR MESMO ASSIM",
    textoCancelar: "CANCELAR",
    detalhes,
  });
}

export function aviso(mensagem: string, titulo?: string): Promise<boolean> {
  return enfileirar({ mensagem, tipo: "aviso", titulo, textoConfirmar: undefined });
}

export function sucesso(mensagem: string, titulo?: string): Promise<boolean> {
  return enfileirar({ mensagem, tipo: "sucesso", titulo, textoConfirmar: undefined });
}

export function erro(mensagem: string, titulo?: string): Promise<boolean> {
  return enfileirar({ mensagem, tipo: "erro", titulo, textoConfirmar: undefined });
}

export function informacao(mensagem: string, titulo?: string): Promise<boolean> {
  return enfileirar({ mensagem, tipo: "informacao", titulo, textoConfirmar: undefined });
}

export function recorrencia(mensagem: string, titulo?: string): Promise<boolean> {
  return enfileirar({ mensagem, tipo: "recorrencia", titulo, textoConfirmar: undefined });
}
