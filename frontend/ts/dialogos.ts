// Confirmacoes neobrutalistas (substituem window.alert/confirm/prompt — PROIBIDOS:
// dialogos nativos causavam o bug de foco dos inputs no Electron/Windows).
//
// Usar SO quando o usuario precisa DECIDIR algo que nao da para desfazer facil:
// sair sem salvar, excluir, desfazer pagamento, cadastrar conta parecida.
// Resultado de acao ("salvo", "excluido") -> notificacoes.ts. Erro de campo -> inline.
//
// Acessibilidade (WAI-ARIA APG alertdialog): role=alertdialog, aria-modal,
// aria-labelledby (titulo) + aria-describedby (mensagem), foco inicial na acao
// SEGURA (cancelar) so na exclusao/estorno; nos demais o foco e o Enter vao para o botao de
// continuar (pedido do usuario, 2026-11-16), Tab preso, ESC cancela, clique fora nao fecha, fundo inert,
// foco devolvido ao fechar, fila serial (um dialogo por vez).
// Testes: data-dialogo (tom), data-dialogo-titulo, data-dialogo-mensagem, data-dialogo-acao.

import { formatarDataBR, mascaraData, parseDataBR } from "./mascaras";

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
  /** Enter CANCELA (em vez de confirmar): acoes que apagam ou desfazem dinheiro */
  enterCancela?: boolean;
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

    // Enter = botao de continuar (pedido do usuario, 2026-11-16). Excecoes: EXCLUIR (tom
    // "perigo") e DESFAZER PAGAMENTO, onde o Enter CANCELA: um Enter sem querer nunca apaga
    // um registro nem desfaz um pagamento. Com Tab ate CANCELAR, o Enter vale esse botao.
    const enterCancela = tom === "perigo" || opcoes.enterCancela === true;
    const aoTeclar = (evento: KeyboardEvent): void => {
      if (evento.key === "Escape") {
        evento.preventDefault();
        evento.stopPropagation();
        fechar("cancelar");
        return;
      }
      if (evento.key === "Enter" && !evento.isComposing && !evento.shiftKey && !evento.ctrlKey && !evento.altKey) {
        const atual = document.activeElement;
        if (atual === cancelar || (alternativa && atual === alternativa)) return;
        evento.preventDefault();
        evento.stopPropagation();
        fechar(enterCancela ? "cancelar" : "confirmar");
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
    // foco no botao que o Enter aciona: CONTINUAR; na exclusao/estorno, CANCELAR
    (enterCancela ? cancelar : confirmar).focus();
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
    enterCancela: true,
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

/** Pop-up de andamento (ex.: atualizacao): barra de carregamento, sem botoes, ESC nao fecha. */
export interface DialogoProgresso {
  /** `fracao` de 0 a 1 (null = sem total conhecido: barra em movimento) */
  atualizar(fracao: number | null, texto: string): void;
  fechar(): void;
}

export function mostrarProgresso(titulo: string, texto: string): DialogoProgresso {
  const veu = document.createElement("div");
  veu.className = "dialogo-veu";
  const caixa = document.createElement("div");
  caixa.className = "dialogo";
  caixa.setAttribute("role", "dialog");
  caixa.setAttribute("aria-modal", "true");
  caixa.setAttribute("aria-labelledby", "progresso-titulo");
  caixa.dataset.dialogo = "progresso";
  const cabecalho = document.createElement("div");
  cabecalho.className = "dialogo__cabecalho";
  const icone = document.createElement("span");
  icone.className = "material-symbols-outlined dialogo__icone";
  icone.setAttribute("aria-hidden", "true");
  icone.textContent = "downloading";
  const tituloEl = document.createElement("h2");
  tituloEl.className = "dialogo__titulo";
  tituloEl.id = "progresso-titulo";
  tituloEl.textContent = titulo;
  cabecalho.append(icone, tituloEl);
  const corpo = document.createElement("div");
  corpo.className = "dialogo__corpo";
  const barra = document.createElement("div");
  barra.className = "barra-progresso";
  barra.id = "barra-progresso";
  barra.setAttribute("role", "progressbar");
  barra.setAttribute("aria-valuemin", "0");
  barra.setAttribute("aria-valuemax", "100");
  barra.setAttribute("aria-labelledby", "progresso-titulo");
  const preenchido = document.createElement("div");
  preenchido.className = "barra-progresso__preenchido";
  barra.appendChild(preenchido);
  const mensagem = document.createElement("p");
  mensagem.className = "dialogo__mensagem";
  mensagem.id = "progresso-texto";
  mensagem.setAttribute("aria-live", "polite");
  corpo.append(barra, mensagem);
  caixa.append(cabecalho, corpo);
  veu.appendChild(caixa);
  document.body.appendChild(veu);
  definirFundoInerte(true);
  dialogoAberto = true;
  // nada fecha o andamento pelo teclado (ESC/Enter nao interrompem a atualizacao)
  const aoTeclar = (evento: KeyboardEvent): void => {
    if (evento.key === "Escape" || evento.key === "Enter") {
      evento.preventDefault();
      evento.stopPropagation();
    }
  };
  document.addEventListener("keydown", aoTeclar, true);
  const controle: DialogoProgresso = {
    atualizar(fracao, novoTexto) {
      mensagem.textContent = novoTexto;
      barra.classList.toggle("barra-progresso--indefinida", fracao === null);
      if (fracao === null) {
        barra.removeAttribute("aria-valuenow");
        preenchido.style.width = "";
        return;
      }
      const pct = Math.max(0, Math.min(100, Math.round(fracao * 100)));
      preenchido.style.width = `${pct}%`;
      barra.setAttribute("aria-valuenow", String(pct));
      barra.dataset.pct = String(pct);
    },
    fechar() {
      if (!veu.isConnected) return;
      veu.remove();
      definirFundoInerte(false);
      dialogoAberto = false;
      document.removeEventListener("keydown", aoTeclar, true);
    },
  };
  controle.atualizar(0, texto);
  return controle;
}

// ---------- MARCAR COMO PAGO: banco que pagou + data do pagamento (pedido do usuario, 2026-11-18) ----------

export interface EscolhaPagamento {
  idBanco: number;
  /** como foi pago (PIX, DINHEIRO...): escolhido na lista ou escrito */
  formaPagamento: string;
  /** aaaa-mm-dd */
  dataIso: string;
}

/** Opcoes da caixa FORMA DE PAGAMENTO (pode escrever outra). */
export const FORMAS_PAGAMENTO = ["PIX", "BOLETO", "DINHEIRO", "CARTÃO DE CRÉDITO", "CARTÃO DE DÉBITO", "TRANSFERÊNCIA", "DÉBITO AUTOMÁTICO"];

function hojeLocalIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Pop-up no centro da tela ao marcar uma conta como paga: escolher o BANCO que pagou e,
 * na frente, a DATA DO PAGAMENTO (vem com hoje; pode ter sido outro dia — digitada ou pelo
 * calendario). Banco obrigatorio; data valida e nao no futuro. null = cancelou.
 */
export function escolherPagamento(opcoes: {
  empresa: string;
  valor: string;
  bancos: { id: number; nome: string }[];
  /** forma ja sugerida (a do formato da conta, ex.: BOLETO) */
  formaSugerida?: string;
}): Promise<EscolhaPagamento | null> {
  return new Promise<EscolhaPagamento | null>((resolver) => {
    const anterior = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const criar = <K extends keyof HTMLElementTagNameMap>(tag: K, classe = "", texto?: string): HTMLElementTagNameMap[K] => {
      const e = document.createElement(tag);
      if (classe) e.className = classe;
      if (texto !== undefined) e.textContent = texto;
      return e;
    };

    const veu = criar("div", "dialogo-veu");
    const caixa = criar("div", "dialogo dialogo--grande dialogo--pagamento");
    caixa.setAttribute("role", "dialog");
    caixa.setAttribute("aria-modal", "true");
    caixa.setAttribute("aria-labelledby", "pagamento-titulo");
    caixa.dataset.dialogo = "pagamento";

    const cabecalho = criar("div", "dialogo__cabecalho");
    const icone = criar("span", "material-symbols-outlined dialogo__icone", "payments");
    icone.setAttribute("aria-hidden", "true");
    const titulo = criar("h2", "dialogo__titulo", "MARCAR COMO PAGO");
    titulo.id = "pagamento-titulo";
    cabecalho.append(icone, titulo);

    const corpo = criar("div", "dialogo__corpo");
    corpo.appendChild(criar("p", "dialogo__mensagem", `${opcoes.empresa} · ${opcoes.valor}`));

    const grade = criar("div", "grid grid-cols-1 sm:grid-cols-3 gap-4");
    // banco
    const campoBanco = criar("div", "campo-form");
    const rotuloBanco = criar("label", "rotulo-form", "BANCO QUE PAGOU");
    rotuloBanco.htmlFor = "pagamento-banco";
    const banco = criar("select", "entrada-form");
    banco.id = "pagamento-banco";
    const vazio = criar("option", "", opcoes.bancos.length ? "Selecione o banco..." : "Nenhum banco cadastrado");
    vazio.value = "";
    banco.appendChild(vazio);
    for (const b of opcoes.bancos) {
      const o = criar("option", "", b.nome);
      o.value = String(b.id);
      banco.appendChild(o);
    }
    campoBanco.append(rotuloBanco, banco);
    // forma de pagamento: escolhe na lista OU escreve (ex.: a conta era boleto e pagou no PIX)
    const campoForma = criar("div", "campo-form");
    const rotuloForma = criar("label", "rotulo-form", "FORMA DE PAGAMENTO");
    rotuloForma.htmlFor = "pagamento-forma";
    const forma = criar("input", "entrada-form");
    forma.id = "pagamento-forma";
    forma.type = "text";
    forma.autocomplete = "off";
    forma.maxLength = 40;
    forma.placeholder = "Escolha ou escreva...";
    forma.setAttribute("list", "pagamento-formas");
    forma.value = opcoes.formaSugerida ?? "";
    const formas = criar("datalist");
    formas.id = "pagamento-formas";
    for (const f of FORMAS_PAGAMENTO) formas.appendChild(Object.assign(document.createElement("option"), { value: f }));
    campoForma.append(rotuloForma, forma, formas);
    // data (na frente do banco)
    const campoData = criar("div", "campo-form");
    const rotuloData = criar("label", "rotulo-form", "DATA DO PAGAMENTO");
    rotuloData.htmlFor = "pagamento-data";
    const linhaData = criar("div", "relative");
    const data = criar("input", "entrada-form font-mono pr-12");
    data.id = "pagamento-data";
    data.type = "text";
    data.inputMode = "numeric";
    data.autocomplete = "off";
    data.placeholder = "DD/MM/AAAA";
    data.value = formatarDataBR(hojeLocalIso());
    mascaraData(data);
    const btnCalendario = criar("button", "absolute right-1.5 top-1/2 -translate-y-1/2 bg-[#f0edec] hover:bg-[#FFE600] border-2 border-[#1c1b1b] p-1 flex items-center justify-center cursor-pointer");
    btnCalendario.type = "button";
    btnCalendario.title = "Abrir calendário";
    btnCalendario.setAttribute("aria-label", "Abrir calendário");
    const iconeCal = criar("span", "material-symbols-outlined text-xl", "calendar_month");
    iconeCal.setAttribute("aria-hidden", "true");
    btnCalendario.appendChild(iconeCal);
    const seletorData = criar("input", "sr-only absolute opacity-0 pointer-events-none");
    seletorData.type = "date";
    seletorData.tabIndex = -1;
    seletorData.max = hojeLocalIso();
    linhaData.append(data, btnCalendario, seletorData);
    campoData.append(rotuloData, linhaData);
    grade.append(campoBanco, campoForma, campoData);
    corpo.appendChild(grade);
    const erro = criar("p", "campo-erro hidden");
    erro.id = "pagamento-erro";
    erro.setAttribute("role", "alert");
    corpo.appendChild(erro);
    if (!opcoes.bancos.length) {
      corpo.appendChild(criar("p", "dialogo__detalhes", "Cadastre o banco antes em CADASTROS → NOVO CADASTRO → BANCO."));
    }

    const acoes = criar("div", "dialogo__acoes");
    const cancelar = botao("cancelar", "CANCELAR");
    const confirmarBtn = botao("confirmar", "CONFIRMAR PAGAMENTO");
    confirmarBtn.disabled = !opcoes.bancos.length;
    acoes.append(cancelar, confirmarBtn);

    caixa.append(cabecalho, corpo, acoes);
    veu.appendChild(caixa);
    document.body.appendChild(veu);
    definirFundoInerte(true);
    dialogoAberto = true;

    let concluido = false;
    const fechar = (resposta: EscolhaPagamento | null): void => {
      if (concluido) return;
      concluido = true;
      veu.remove();
      definirFundoInerte(false);
      dialogoAberto = false;
      document.removeEventListener("keydown", aoTeclar, true);
      if (anterior && anterior.isConnected) anterior.focus();
      resolver(resposta);
    };
    const mostrarErro = (msg: string, campo: HTMLElement): void => {
      erro.textContent = msg;
      erro.classList.remove("hidden");
      campo.focus();
    };
    const tentarConfirmar = (): void => {
      if (!banco.value) return mostrarErro("Escolha o banco que pagou.", banco);
      const iso = parseDataBR(data.value);
      if (!iso) return mostrarErro("Data inválida. Use DD/MM/AAAA.", data);
      if (iso > hojeLocalIso()) return mostrarErro("A data do pagamento não pode ser no futuro.", data);
      const textoForma = forma.value.trim().replace(/\s+/g, " ").toUpperCase();
      if (textoForma.length < 2) return mostrarErro("Escolha ou escreva a forma de pagamento (ex.: PIX).", forma);
      fechar({ idBanco: Number(banco.value), dataIso: iso, formaPagamento: textoForma });
    };

    const focaveis: HTMLElement[] = [banco, forma, data, btnCalendario, cancelar, confirmarBtn];
    const aoTeclar = (evento: KeyboardEvent): void => {
      if (evento.key === "Escape") {
        evento.preventDefault();
        evento.stopPropagation();
        fechar(null);
        return;
      }
      if (evento.key === "Enter" && !evento.isComposing && !evento.shiftKey && !evento.ctrlKey && !evento.altKey) {
        const atual = document.activeElement;
        if (atual === cancelar || atual === btnCalendario) return;
        evento.preventDefault();
        evento.stopPropagation();
        tentarConfirmar();
        return;
      }
      if (evento.key === "Tab") {
        const ativos = focaveis.filter((f) => !(f as HTMLButtonElement).disabled);
        const i = ativos.indexOf(document.activeElement as HTMLElement);
        if (evento.shiftKey && i === 0) {
          evento.preventDefault();
          ativos[ativos.length - 1].focus();
        } else if (!evento.shiftKey && i === ativos.length - 1) {
          evento.preventDefault();
          ativos[0].focus();
        }
      }
    };

    btnCalendario.addEventListener("click", () => {
      const iso = parseDataBR(data.value);
      if (iso) seletorData.value = iso;
      if (typeof seletorData.showPicker === "function") seletorData.showPicker();
      else seletorData.click();
    });
    seletorData.addEventListener("change", () => {
      if (seletorData.value) data.value = formatarDataBR(seletorData.value);
      data.focus();
    });
    banco.addEventListener("change", () => erro.classList.add("hidden"));
    data.addEventListener("input", () => erro.classList.add("hidden"));
    forma.addEventListener("input", () => erro.classList.add("hidden"));
    cancelar.addEventListener("click", () => fechar(null));
    confirmarBtn.addEventListener("click", tentarConfirmar);
    veu.addEventListener("mousedown", (evento) => {
      if (evento.target === veu) evento.preventDefault();
    });
    document.addEventListener("keydown", aoTeclar, true);
    (opcoes.bancos.length ? banco : cancelar).focus();
  });
}

