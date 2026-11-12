import {
  buscarStatus,
  listarBancos,
  listarPagadores,
  listarEmpresas,
  atualizarBanco,
  atualizarPagador,
  atualizarEmpresa,
  excluirBanco,
  excluirPagador,
  excluirEmpresa,
  ErroValidacaoApi,
  ErroApi,
  BancoDados,
  PagadorDados,
  EmpresaDados,
} from "../api";
import { montarNavbar } from "../navbar";
import { confirmarExclusao, confirmarSaida, dialogoEstaAberto, menuLateralAberto } from "../componentes";
import { notificar } from "../notificacoes";
import { cnpjValido, cpfValido, formatarCNPJ, formatarCPF, formatarTelefone, mascaraTelefone } from "../mascaras";
import { CampoEditavel, criarEditorCampo, EditorCampo } from "../editor-registro";

// Todos os Cadastros: tabela de Empresas / Pagadores / Bancos + a MESMA area de
// edicao das telas de Controle (cabecalho amarelo, ACOES e "Alterar um campo").

type Tipo = "empresas" | "pagadores" | "bancos";

const ROTULOS: Record<Tipo, string> = {
  empresas: "EMPRESA",
  pagadores: "PAGADOR",
  bancos: "BANCO",
};

const COLUNAS: Record<Tipo, string[]> = {
  empresas: ["Razão Social", "CNPJ", "Representante", "Telefone", "E-mail", "Endereço"],
  pagadores: ["Nome", "CPF", "Função"],
  bancos: ["Instituição", "Chave Pix"],
};

let tipo: Tipo = "empresas";
let empresas: EmpresaDados[] = [];
let pagadores: PagadorDados[] = [];
let bancos: BancoDados[] = [];
let selecionadoId: number | null = null;
let sujo = false;
let editor: EditorCampo;

function el<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

function atualizarSujo(valor: boolean): void {
  sujo = valor;
  document.body.dataset.formSujo = String(valor);
}

function itensFiltrados<T>(lista: T[], extrair: (item: T) => string): T[] {
  const termo = el<HTMLInputElement>("campo-pesquisa").value.trim().toLowerCase();
  if (!termo) return lista;
  return lista.filter((item) => extrair(item).toLowerCase().includes(termo));
}

function celula(texto: string): HTMLTableCellElement {
  const td = document.createElement("td");
  td.className = "px-3 py-2 border-b-2 border-[#1c1b1b] font-mono text-xs sm:text-sm text-[#1c1b1b]";
  td.textContent = texto;
  return td;
}

function linhaTabela(id: number, celulas: string[]): HTMLTableRowElement {
  const tr = document.createElement("tr");
  tr.dataset.id = String(id);
  tr.className = "cursor-pointer hover:bg-[#fff9d6] bg-white";
  if (selecionadoId === id) tr.classList.add("bg-[#FFE600]");
  for (const texto of celulas) tr.appendChild(celula(texto));
  return tr;
}

function renderTabela(): void {
  const area = document.getElementById("tabela-area")!;
  area.replaceChildren();
  let linhas: HTMLTableRowElement[] = [];
  if (tipo === "empresas") {
    linhas = itensFiltrados(empresas, (e) => `${e.razaoSocial} ${e.cnpj ?? ""} ${e.nomeRepresentante ?? ""} ${e.email ?? ""} ${e.telefones.map((t) => t.numero).join(" ")}`)
      .map((e) => linhaTabela(e.id, [e.razaoSocial, e.cnpj ? formatarCNPJ(e.cnpj) : "—", e.nomeRepresentante ?? "—",
        e.telefones.length ? e.telefones.map((tel) => formatarTelefone(tel.numero)).join(" / ") : "—", e.email ?? "—", e.logradouro ?? "—"]));
  } else if (tipo === "pagadores") {
    linhas = itensFiltrados(pagadores, (p) => `${p.nome} ${p.cpf} ${p.funcao ?? ""}`)
      .map((p) => linhaTabela(p.id, [p.nome, p.cpf ? formatarCPF(p.cpf) : "—", p.funcao ?? "—"]));
  } else {
    linhas = itensFiltrados(bancos, (b) => `${b.instituicao} ${b.chavePix ?? ""}`)
      .map((b) => linhaTabela(b.id, [b.instituicao, b.chavePix ?? "—"]));
  }

  const estado = document.createElement("p");
  estado.id = "tabela-estado";
  estado.setAttribute("role", "status");
  estado.className = "font-headline text-sm font-bold text-[#1c1b1b]";
  if (linhas.length === 0) {
    estado.textContent = `Nenhum ${ROTULOS[tipo].toLowerCase()} encontrado. Use NOVO CADASTRO para adicionar.`;
    area.appendChild(estado);
    document.body.dataset.tabelaEstado = "vazio";
    return;
  }

  const tabela = document.createElement("table");
  tabela.className = "w-full border-collapse border-2 border-[#1c1b1b]";
  const thead = document.createElement("thead");
  const trCabecalho = document.createElement("tr");
  trCabecalho.className = "bg-[#1c1b1b] text-white";
  for (const rotulo of COLUNAS[tipo]) {
    const th = document.createElement("th");
    th.className = "px-3 py-2 text-left font-headline text-xs sm:text-sm font-bold uppercase tracking-wider";
    th.textContent = rotulo;
    trCabecalho.appendChild(th);
  }
  thead.appendChild(trCabecalho);
  const tbody = document.createElement("tbody");
  for (const linha of linhas) tbody.appendChild(linha);
  tabela.append(thead, tbody);
  area.appendChild(tabela);
  document.body.dataset.tabelaEstado = "pronto";
}

// ---------- telefones da empresa (painel no lugar do "novo valor") ----------

function preencherTelefones(telefones: { numero: string; tipo: string | null }[]): void {
  el("lista-telefones-edt").replaceChildren();
  for (const telefone of telefones) adicionarLinhaTelefone(telefone.numero, telefone.tipo ?? "");
}

function adicionarLinhaTelefone(numero = "", tipoTel = ""): void {
  const linha = document.createElement("div");
  linha.className = "linha-telefone flex flex-wrap items-center gap-2";
  const num = document.createElement("input");
  num.className = "tel-numero flex-1 min-w-[9rem] border-2 border-[#1c1b1b] bg-white px-3 py-2 font-mono text-sm text-[#1c1b1b] focus:bg-[#fff9d6] focus:outline-none";
  num.type = "text";
  num.inputMode = "numeric";
  num.maxLength = 15;
  num.placeholder = "(11) 99999-0000";
  num.autocomplete = "off";
  num.value = formatarTelefone(numero);
  const tipoInput = document.createElement("input");
  tipoInput.className = "tel-tipo w-32 border-2 border-[#1c1b1b] bg-white px-3 py-2 font-mono text-sm text-[#1c1b1b] focus:bg-[#fff9d6] focus:outline-none";
  tipoInput.type = "text";
  tipoInput.maxLength = 20;
  tipoInput.placeholder = "Comercial";
  tipoInput.autocomplete = "off";
  tipoInput.value = tipoTel;
  const remover = document.createElement("button");
  remover.className = "tel-remover inline-flex items-center justify-center w-10 h-10 bg-white border-2 border-[#1c1b1b] hover:bg-[#ffdad6] cursor-pointer";
  remover.type = "button";
  remover.setAttribute("aria-label", "Remover telefone");
  const icone = document.createElement("span");
  icone.className = "material-symbols-outlined text-base leading-none font-bold";
  icone.textContent = "delete";
  remover.appendChild(icone);
  mascaraTelefone(num);
  remover.addEventListener("click", () => {
    linha.remove();
    atualizarSujo(true);
  });
  linha.append(num, tipoInput, remover);
  el("lista-telefones-edt").appendChild(linha);
}

function lerTelefonesEdt(): { numero: string; tipo: string }[] {
  const telefones: { numero: string; tipo: string }[] = [];
  document.querySelectorAll<HTMLElement>("#lista-telefones-edt .linha-telefone").forEach((linha) => {
    const numero = (linha.querySelector(".tel-numero") as HTMLInputElement).value.trim();
    const tipoTel = (linha.querySelector(".tel-tipo") as HTMLInputElement).value.trim();
    if (numero) telefones.push({ numero, tipo: tipoTel });
  });
  return telefones;
}

// ---------- area de edicao ----------

function camposDoTipo(): CampoEditavel[] {
  if (tipo === "empresas") {
    return [
      { valor: "razaoSocial", rotulo: "Razão social" },
      { valor: "cnpj", rotulo: "CNPJ", mascara: "cnpj" },
      { valor: "nomeRepresentante", rotulo: "Representante" },
      { valor: "email", rotulo: "E-mail" },
      { valor: "logradouro", rotulo: "Endereço" },
      { valor: "telefones", rotulo: "Telefones", painel: el("painelTelefones") },
    ];
  }
  if (tipo === "pagadores") {
    return [
      { valor: "nome", rotulo: "Nome" },
      { valor: "cpf", rotulo: "CPF", mascara: "cpf" },
      { valor: "funcao", rotulo: "Função" },
    ];
  }
  return [
    { valor: "instituicao", rotulo: "Instituição bancária" },
    { valor: "chavePix", rotulo: "Chave Pix" },
  ];
}

function empresaSel(): EmpresaDados | undefined {
  return empresas.find((e) => e.id === selecionadoId);
}
function pagadorSel(): PagadorDados | undefined {
  return pagadores.find((p) => p.id === selecionadoId);
}
function bancoSel(): BancoDados | undefined {
  return bancos.find((b) => b.id === selecionadoId);
}

function valorAtual(campo: string): string {
  if (tipo === "empresas") {
    const e = empresaSel();
    if (!e) return "";
    switch (campo) {
      case "cnpj": return e.cnpj ? formatarCNPJ(e.cnpj) : "";
      case "nomeRepresentante": return e.nomeRepresentante ?? "";
      case "email": return e.email ?? "";
      case "logradouro": return e.logradouro ?? "";
      case "telefones": return "";
      default: return e.razaoSocial;
    }
  }
  if (tipo === "pagadores") {
    const p = pagadorSel();
    if (!p) return "";
    if (campo === "cpf") return p.cpf ? formatarCPF(p.cpf) : "";
    if (campo === "funcao") return p.funcao ?? "";
    return p.nome;
  }
  const b = bancoSel();
  if (!b) return "";
  return campo === "chavePix" ? b.chavePix ?? "" : b.instituicao;
}

function resumo(): string {
  if (tipo === "empresas") {
    const e = empresaSel();
    return e ? [e.cnpj ? formatarCNPJ(e.cnpj) : "sem CNPJ", e.telefones.map((t) => formatarTelefone(t.numero)).join(" / ") || "sem telefone"].join(" · ") : "—";
  }
  if (tipo === "pagadores") {
    const p = pagadorSel();
    return p ? [p.cpf ? formatarCPF(p.cpf) : "sem CPF", p.funcao ?? "sem função"].join(" · ") : "—";
  }
  const b = bancoSel();
  return b ? `Pix: ${b.chavePix ?? "—"}` : "—";
}

function nomeSelecionado(): string {
  if (tipo === "empresas") return empresaSel()?.razaoSocial ?? "—";
  if (tipo === "pagadores") return pagadorSel()?.nome ?? "—";
  return bancoSel()?.instituicao ?? "—";
}

function abrirPainel(id: number): void {
  selecionadoId = id;
  el("editorContainer").classList.remove("hidden");
  el("editorRecordName").textContent = nomeSelecionado();
  el("detailTipo").textContent = ROTULOS[tipo];
  el("detailResumo").textContent = resumo();
  editor.recarregarCampos();
  if (tipo === "empresas") preencherTelefones(empresaSel()?.telefones ?? []);
  editor.atualizar();
  atualizarSujo(false);
  document.body.dataset.registroEdicao = String(id);
  renderTabela();
  el("editorContainer").scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function fecharPainel(): void {
  el("editorContainer").classList.add("hidden");
  selecionadoId = null;
  delete document.body.dataset.registroEdicao;
  editor.erro();
  atualizarSujo(false);
  renderTabela();
}

/** Valida o campo alterado; devolve a mensagem de erro ou null. */
function validarCampo(campo: string, bruto: string): string | null {
  switch (campo) {
    case "razaoSocial": return bruto.length < 2 || bruto.length > 120 ? "Informe a razão social (de 2 a 120 caracteres)." : null;
    case "cnpj": return bruto && !cnpjValido(bruto) ? "CNPJ inválido. Confira os 14 caracteres." : null;
    case "email": return bruto && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(bruto) ? "E-mail inválido. Exemplo: contato@empresa.com.br." : null;
    case "nomeRepresentante":
    case "logradouro": return bruto.length > 120 ? "Use até 120 caracteres." : null;
    case "telefones": {
      const ruim = lerTelefonesEdt().findIndex((t) => !/^[0-9A-Za-z().+\- ]{8,20}$/.test(t.numero));
      return ruim >= 0 ? `Telefone inválido na linha ${ruim + 1}. Exemplo: (11) 3333-4444.` : null;
    }
    case "nome": return bruto.length < 2 || bruto.length > 120 ? "Informe o nome (de 2 a 120 caracteres)." : null;
    case "cpf": return bruto && !cpfValido(bruto) ? "CPF inválido. Confira os 11 números." : null;
    case "funcao": return bruto.length > 100 ? "A função deve ter até 100 caracteres." : null;
    case "instituicao": return bruto.length < 2 || bruto.length > 120 ? "Informe o nome do banco (de 2 a 120 caracteres)." : null;
    case "chavePix": return bruto && (bruto.length > 77 || bruto.includes(" ")) ? "Chave Pix inválida (até 77 caracteres, sem espaços)." : null;
    default: return null;
  }
}

async function aplicarAlteracao(): Promise<void> {
  if (selecionadoId === null) return;
  const campo = editor.campo();
  const bruto = editor.ler();
  const problema = validarCampo(campo, bruto);
  if (problema) {
    editor.erro(problema);
    return;
  }
  const vazioOu = (v: string): string | undefined => v || undefined;
  try {
    const cfg = await window.finDesk!.config();
    if (tipo === "empresas") {
      const e = empresaSel();
      if (!e) return;
      const dados = {
        razaoSocial: e.razaoSocial,
        cnpj: e.cnpj ?? undefined,
        nomeRepresentante: e.nomeRepresentante ?? undefined,
        email: e.email ?? undefined,
        logradouro: e.logradouro ?? undefined,
        telefones: e.telefones.map((t) => ({ numero: t.numero, tipo: t.tipo ?? undefined })),
      };
      if (campo === "telefones") dados.telefones = lerTelefonesEdt().map((t) => ({ numero: t.numero, tipo: vazioOu(t.tipo) }));
      else if (campo === "razaoSocial") dados.razaoSocial = bruto;
      else if (campo === "cnpj") dados.cnpj = vazioOu(bruto);
      else if (campo === "nomeRepresentante") dados.nomeRepresentante = vazioOu(bruto);
      else if (campo === "email") dados.email = vazioOu(bruto);
      else if (campo === "logradouro") dados.logradouro = vazioOu(bruto);
      await atualizarEmpresa(cfg, e.id, dados);
      empresas = await listarEmpresas(cfg);
    } else if (tipo === "pagadores") {
      const p = pagadorSel();
      if (!p) return;
      const dados = { nome: p.nome, cpf: p.cpf ?? "", funcao: p.funcao ?? undefined };
      if (campo === "nome") dados.nome = bruto;
      else if (campo === "cpf") dados.cpf = bruto.replace(/\D/g, "");
      else dados.funcao = vazioOu(bruto);
      await atualizarPagador(cfg, p.id, dados);
      pagadores = await listarPagadores(cfg);
    } else {
      const b = bancoSel();
      if (!b) return;
      const dados = { instituicao: b.instituicao, chavePix: b.chavePix ?? undefined };
      if (campo === "instituicao") dados.instituicao = bruto;
      else dados.chavePix = vazioOu(bruto);
      await atualizarBanco(cfg, b.id, dados);
      bancos = await listarBancos(cfg);
    }
    const id = selecionadoId;
    abrirPainel(id);
    notificar("Alterações salvas.");
    document.body.dataset.registroSalvo = String(id);
    console.info("[ContasAPagar] registro atualizado (tipo:", tipo, "id:", id, "campo:", campo, ")");
  } catch (erro) {
    if (erro instanceof ErroValidacaoApi) {
      editor.erro(Object.values(erro.campos)[0] ?? "Dados inválidos. Confira o valor digitado.");
    } else {
      editor.erro("Não foi possível salvar. Verifique se o sistema está aberto e tente de novo.");
      console.error("[ContasAPagar] falha ao atualizar registro:", erro);
    }
  }
}

async function excluirSelecionado(): Promise<void> {
  if (selecionadoId === null) return;
  if (!(await confirmarExclusao(`este cadastro de ${ROTULOS[tipo].toLowerCase()}`))) return;
  try {
    const cfg = await window.finDesk!.config();
    const id = selecionadoId;
    if (tipo === "empresas") {
      await excluirEmpresa(cfg, id);
      empresas = await listarEmpresas(cfg);
    } else if (tipo === "pagadores") {
      await excluirPagador(cfg, id);
      pagadores = await listarPagadores(cfg);
    } else {
      await excluirBanco(cfg, id);
      bancos = await listarBancos(cfg);
    }
    fecharPainel();
    notificar("Cadastro excluído.");
    document.body.dataset.registroExcluido = String(id);
    console.info("[ContasAPagar] registro excluido (tipo:", tipo, "id:", id, ")");
  } catch (erro) {
    if (erro instanceof ErroApi && erro.status === 409) {
      editor.erro("Não é possível excluir: este cadastro está sendo usado em contas.");
    } else if (erro instanceof ErroApi && erro.status === 404) {
      editor.erro("Este cadastro não existe mais (talvez já tenha sido excluído).");
    } else {
      editor.erro("Não foi possível excluir. Tente de novo.");
      console.error("[ContasAPagar] falha ao excluir registro:", erro);
    }
  }
}

async function carregarListas(): Promise<void> {
  const estado = document.getElementById("tabela-estado");
  if (estado) estado.textContent = "Carregando cadastros...";
  document.body.dataset.tabelaEstado = "carregando";
  try {
    const cfg = await window.finDesk!.config();
    await buscarStatus(cfg);
    [empresas, pagadores, bancos] = await Promise.all([
      listarEmpresas(cfg),
      listarPagadores(cfg),
      listarBancos(cfg),
    ]);
    renderTabela();
    document.body.dataset.apiStatus = "ok";
  } catch {
    const area = document.getElementById("tabela-area")!;
    area.replaceChildren();
    const mensagem = document.createElement("p");
    mensagem.id = "tabela-estado";
    mensagem.className = "font-headline text-sm font-bold text-[#b6212a]";
    mensagem.textContent = "Não foi possível carregar os cadastros.";
    const tentar = document.createElement("button");
    tentar.id = "btn-tentar-novamente";
    tentar.type = "button";
    tentar.className =
      "inline-flex items-center gap-2 px-4 py-2 bg-white text-[#1c1b1b] border-2 border-[#1c1b1b] font-headline font-bold text-xs uppercase tracking-wider cursor-pointer";
    tentar.textContent = "Tentar novamente";
    tentar.addEventListener("click", () => void carregarListas());
    area.append(mensagem, tentar);
    document.body.dataset.tabelaEstado = "erro";
    document.body.dataset.apiStatus = "erro";
  }
}

function iniciar(): void {
  montarNavbar("todos-cadastros");
  editor = criarEditorCampo(camposDoTipo, valorAtual, () => atualizarSujo(false));

  document.querySelectorAll<HTMLButtonElement>(".btn-filtro").forEach((botao) => {
    botao.addEventListener("click", () => {
      tipo = botao.dataset.tipo as Tipo;
      document.querySelectorAll<HTMLButtonElement>(".btn-filtro").forEach((outro) => {
        const ativo = outro === botao;
        outro.setAttribute("aria-pressed", String(ativo));
        outro.classList.toggle("bg-[#ea580c]", ativo);
        outro.classList.toggle("text-white", ativo);
        outro.classList.toggle("bg-white", !ativo);
      });
      if (selecionadoId !== null) fecharPainel();
      renderTabela();
    });
  });
  document.getElementById("btn-filtro-empresas")!.classList.add("bg-[#ea580c]", "text-white");

  el("campo-pesquisa").addEventListener("input", () => renderTabela());
  el("tabela-area").addEventListener("click", (evento) => {
    const alvo = (evento.target as HTMLElement).closest<HTMLElement>("tr[data-id]");
    if (!alvo) return;
    abrirPainel(Number(alvo.dataset.id));
  });

  el("btn-add-telefone-edt").addEventListener("click", () => {
    adicionarLinhaTelefone();
    atualizarSujo(true);
  });
  el("newValueInput").addEventListener("input", () => atualizarSujo(true));
  el("painelTelefones").addEventListener("input", () => atualizarSujo(true));
  el("btnApplyChange").addEventListener("click", () => void aplicarAlteracao());
  el("btnCancelEdit").addEventListener("click", () => {
    if (editor.campo() === "telefones") preencherTelefones(empresaSel()?.telefones ?? []);
  });
  el("btn-edt-excluir").addEventListener("click", () => void excluirSelecionado());
  el("btnClearSelection").addEventListener("click", () => {
    void (async () => {
      if (sujo && !(await confirmarSaida())) return;
      fecharPainel();
    })();
  });

  // alteracao digitada e nao aplicada: confirma antes de sair da tela
  let navegacaoConfirmada = false;
  document.addEventListener(
    "click",
    (evento) => {
      const alvo = (evento.target as HTMLElement).closest<HTMLElement>("[data-nav]");
      if (!alvo || !sujo || navegacaoConfirmada || dialogoEstaAberto()) return;
      evento.preventDefault();
      evento.stopPropagation();
      navegacaoConfirmada = true;
      void confirmarSaida().then((ok) => {
        if (ok) alvo.click();
        navegacaoConfirmada = false;
      });
    },
    true
  );

  document.addEventListener(
    "keydown",
    (evento) => {
      if (evento.key !== "Escape" || !sujo || dialogoEstaAberto() || menuLateralAberto()) return;
      evento.preventDefault();
      evento.stopPropagation();
      void confirmarSaida().then((ok) => {
        if (ok) fecharPainel();
      });
    },
    true
  );

  void carregarListas();
  console.info("[ContasAPagar] tela todos os cadastros iniciada");
}

export function iniciarTodosCadastros(): void {
  iniciar();
}
