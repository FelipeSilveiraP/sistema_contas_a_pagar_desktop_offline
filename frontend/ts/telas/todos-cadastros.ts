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
import { confirmar } from "../componentes";
import { cnpjValido } from "./form-empresa";
import { cpfValido } from "./form-pagador";

type Tipo = "empresas" | "pagadores" | "bancos";

const ROTULOS: Record<Tipo, string> = {
  empresas: "EMPRESA",
  pagadores: "PAGADOR",
  bancos: "BANCO",
};

const COLUNAS: Record<Tipo, string[]> = {
  empresas: ["Razão Social", "CNPJ", "Representante", "E-mail"],
  pagadores: ["Nome", "CPF", "Função"],
  bancos: ["Instituição", "Chave Pix"],
};

let tipo: Tipo = "empresas";
let empresas: EmpresaDados[] = [];
let pagadores: PagadorDados[] = [];
let bancos: BancoDados[] = [];
let selecionadoId: number | null = null;
let sujo = false;

function idCampo(id: string): HTMLInputElement {
  return document.getElementById(id) as HTMLInputElement;
}

function atualizarSujo(valor: boolean): void {
  sujo = valor;
  document.body.dataset.formSujo = String(valor);
}

function feedback(mensagem: string, sucesso: boolean): void {
  const alvo = document.getElementById("feedback-edt");
  if (!alvo) return;
  alvo.textContent = mensagem;
  alvo.classList.remove("hidden");
  alvo.classList.toggle("text-[#006c46]", sucesso);
  alvo.classList.toggle("text-[#b6212a]", !sucesso);
}

function mostrarErros(erros: Record<string, string>): void {
  document.querySelectorAll<HTMLElement>(".campo-erro").forEach((el) => {
    const nome = el.dataset.erroCampo ?? "";
    const mensagem = erros[nome];
    el.textContent = mensagem ?? "";
    el.classList.toggle("hidden", !mensagem);
  });
}

function normalizar(entrada: string, digitos: boolean): string {
  const limpo = entrada.trim();
  return digitos ? limpo.replace(/\D/g, "") : limpo;
}

function itensFiltrados<T>(lista: T[], extrair: (item: T) => string): T[] {
  const termo = idCampo("campo-pesquisa").value.trim().toLowerCase();
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
  tr.className = "cursor-pointer hover:bg-[#fde7cf] bg-white";
  if (selecionadoId === id) tr.classList.add("bg-[#fde7cf]");
  for (const texto of celulas) tr.appendChild(celula(texto));
  return tr;
}

function renderTabela(): void {
  const area = document.getElementById("tabela-area")!;
  area.replaceChildren();
  let linhas: HTMLTableRowElement[] = [];
  if (tipo === "empresas") {
    linhas = itensFiltrados(empresas, (e) => `${e.razaoSocial} ${e.cnpj ?? ""} ${e.nomeRepresentante ?? ""} ${e.email ?? ""} ${e.telefones.map((t) => t.numero).join(" ")}`)
      .map((e) => linhaTabela(e.id, [e.razaoSocial, e.cnpj ?? "—", e.nomeRepresentante ?? "—", e.email ?? "—"]));
  } else if (tipo === "pagadores") {
    linhas = itensFiltrados(pagadores, (p) => `${p.nome} ${p.cpf} ${p.funcao ?? ""}`)
      .map((p) => linhaTabela(p.id, [p.nome, p.cpf, p.funcao ?? "—"]));
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

function preencherTelefones(telefones: { numero: string; tipo: string | null }[]): void {
  const lista = document.getElementById("lista-telefones-edt")!;
  lista.replaceChildren();
  for (const telefone of telefones) adicionarLinhaTelefone(telefone.numero, telefone.tipo ?? "");
}

function adicionarLinhaTelefone(numero = "", tipo = ""): void {
  const lista = document.getElementById("lista-telefones-edt")!;
  const linha = document.createElement("div");
  linha.className = "linha-telefone flex flex-wrap items-center gap-2";
  linha.innerHTML = `
<input class="form-campo tel-numero flex-1 min-w-[10rem] border-4 border-[#1c1b1b] bg-white px-3 py-2 font-mono text-sm text-[#1c1b1b] shadow-[3px_3px_0_0_#1c1b1b] focus:outline-none" type="text" maxlength="20" placeholder="(11) 99999-0000" autocomplete="off">
<input class="form-campo tel-tipo w-36 border-4 border-[#1c1b1b] bg-white px-3 py-2 font-mono text-sm text-[#1c1b1b] shadow-[3px_3px_0_0_#1c1b1b] focus:outline-none" type="text" maxlength="20" placeholder="Comercial" autocomplete="off">
<button class="inline-flex items-center justify-center w-10 h-10 bg-white border-4 border-[#1c1b1b] shadow-[3px_3px_0_0_#1c1b1b] hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all cursor-pointer tel-remover" type="button" aria-label="Remover telefone">
<span class="material-symbols-outlined text-base leading-none font-bold">delete</span>
</button>`;
  (linha.querySelector(".tel-numero") as HTMLInputElement).value = numero;
  (linha.querySelector(".tel-tipo") as HTMLInputElement).value = tipo;
  linha.querySelector(".tel-remover")!.addEventListener("click", () => {
    linha.remove();
    atualizarSujo(true);
  });
  lista.appendChild(linha);
}

function lerTelefonesEdt(): { numero: string; tipo: string }[] {
  const telefones: { numero: string; tipo: string }[] = [];
  document.querySelectorAll<HTMLElement>("#lista-telefones-edt .linha-telefone").forEach((linha) => {
    const numero = (linha.querySelector(".tel-numero") as HTMLInputElement).value.trim();
    const tipo = (linha.querySelector(".tel-tipo") as HTMLInputElement).value.trim();
    if (numero) telefones.push({ numero, tipo });
  });
  return telefones;
}

function abrirPainel(id: number): void {
  const painel = document.getElementById("painel-edicao")!;
  selecionadoId = id;
  mostrarErros({});
  feedback("", true);
  for (const grupo of document.querySelectorAll<HTMLElement>(".painel-grupo")) {
    grupo.hidden = grupo.id !== `grupo-${tipo}`;
  }
  if (tipo === "empresas") {
    const registro = empresas.find((e) => e.id === id);
    if (!registro) return;
    document.getElementById("painel-titulo")!.textContent = "EDITAR REGISTRO — EMPRESA";
    idCampo("campo-edt-razao").value = registro.razaoSocial;
    idCampo("campo-edt-cnpj").value = registro.cnpj ?? "";
    idCampo("campo-edt-representante").value = registro.nomeRepresentante ?? "";
    idCampo("campo-edt-email").value = registro.email ?? "";
    idCampo("campo-edt-logradouro").value = registro.logradouro ?? "";
    preencherTelefones(registro.telefones);
  } else if (tipo === "pagadores") {
    const registro = pagadores.find((p) => p.id === id);
    if (!registro) return;
    document.getElementById("painel-titulo")!.textContent = "EDITAR REGISTRO — PAGADOR";
    idCampo("campo-edt-nome").value = registro.nome;
    idCampo("campo-edt-cpf").value = registro.cpf;
    idCampo("campo-edt-funcao").value = registro.funcao ?? "";
  } else {
    const registro = bancos.find((b) => b.id === id);
    if (!registro) return;
    document.getElementById("painel-titulo")!.textContent = "EDITAR REGISTRO — BANCO";
    idCampo("campo-edt-instituicao").value = registro.instituicao;
    idCampo("campo-edt-chave-pix").value = registro.chavePix ?? "";
  }
  painel.hidden = false;
  atualizarSujo(false);
  document.body.dataset.registroEdicao = String(id);
  painel.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function fecharPainel(): void {
  document.getElementById("painel-edicao")!.hidden = true;
  selecionadoId = null;
  delete document.body.dataset.registroEdicao;
  atualizarSujo(false);
  renderTabela();
}

function validarPainel(): Record<string, string> {
  const erros: Record<string, string> = {};
  if (tipo === "empresas") {
    const razao = idCampo("campo-edt-razao").value.trim();
    const cnpj = idCampo("campo-edt-cnpj").value.trim();
    const email = idCampo("campo-edt-email").value.trim();
    if (razao.length < 2 || razao.length > 120) erros.razaoSocial = "informe a razao social (2 a 120 caracteres)";
    if (cnpj && !cnpjValido(cnpj)) erros.cnpj = "CNPJ invalido (14 digitos com digitos verificadores)";
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) erros.email = "email invalido";
    if (idCampo("campo-edt-representante").value.trim().length > 120) erros.nomeRepresentante = "nome do representante deve ter ate 120 caracteres";
    if (idCampo("campo-edt-logradouro").value.trim().length > 120) erros.logradouro = "logradouro deve ter ate 120 caracteres";
    lerTelefonesEdt().forEach((telefone, i) => {
      if (!/^[0-9A-Za-z().+\- ]{8,20}$/.test(telefone.numero)) {
        erros.telefones = `telefone invalido (8 a 20 caracteres) na linha ${i + 1}`;
      }
    });
  } else if (tipo === "pagadores") {
    const nome = idCampo("campo-edt-nome").value.trim();
    const cpf = idCampo("campo-edt-cpf").value.trim();
    if (nome.length < 2 || nome.length > 120) erros.nome = "informe o nome (2 a 120 caracteres)";
    if (!cpfValido(cpf)) erros.cpf = "CPF invalido (11 digitos com digitos verificadores)";
    if (idCampo("campo-edt-funcao").value.trim().length > 60) erros.funcao = "funcao deve ter ate 60 caracteres";
  } else {
    const instituicao = idCampo("campo-edt-instituicao").value.trim();
    const chavePix = idCampo("campo-edt-chave-pix").value.trim();
    if (instituicao.length < 2 || instituicao.length > 120) erros.instituicao = "informe a instituicao bancaria (2 a 120 caracteres)";
    if (chavePix && (chavePix.length > 77 || chavePix.includes(" "))) {
      erros.chavePix = "chave Pix invalida (ate 77 caracteres, sem espacos)";
    }
  }
  return erros;
}

async function salvarPainel(): Promise<void> {
  if (selecionadoId === null) return;
  const erros = validarPainel();
  mostrarErros(erros);
  if (Object.keys(erros).length > 0) {
    feedback("Corrija os campos destacados.", false);
    return;
  }
  try {
    const cfg = await window.finDesk!.config();
    if (tipo === "empresas") {
      await atualizarEmpresa(cfg, selecionadoId, {
        razaoSocial: idCampo("campo-edt-razao").value.trim(),
        cnpj: normalizar(idCampo("campo-edt-cnpj").value, false) || undefined,
        nomeRepresentante: idCampo("campo-edt-representante").value.trim() || undefined,
        email: idCampo("campo-edt-email").value.trim() || undefined,
        logradouro: idCampo("campo-edt-logradouro").value.trim() || undefined,
        telefones: lerTelefonesEdt().map((t) => ({ numero: t.numero, tipo: t.tipo || undefined })),
      });
      empresas = await listarEmpresas(cfg);
    } else if (tipo === "pagadores") {
      await atualizarPagador(cfg, selecionadoId, {
        nome: idCampo("campo-edt-nome").value.trim(),
        cpf: normalizar(idCampo("campo-edt-cpf").value, true),
        funcao: idCampo("campo-edt-funcao").value.trim() || undefined,
      });
      pagadores = await listarPagadores(cfg);
    } else {
      await atualizarBanco(cfg, selecionadoId, {
        instituicao: idCampo("campo-edt-instituicao").value.trim(),
        chavePix: idCampo("campo-edt-chave-pix").value.trim() || undefined,
      });
      bancos = await listarBancos(cfg);
    }
    atualizarSujo(false);
    renderTabela();
    feedback("Registro atualizado com sucesso.", true);
    document.body.dataset.registroSalvo = String(selecionadoId);
    console.info("[ContasAPagar] registro atualizado (tipo:", tipo, "id:", selecionadoId, ")");
  } catch (erro) {
    if (erro instanceof ErroValidacaoApi) {
      mostrarErros(erro.campos);
      feedback("Corrija os campos destacados.", false);
    } else {
      feedback("Nao foi possivel salvar o registro. Tente novamente.", false);
      console.error("[ContasAPagar] falha ao atualizar registro:", erro);
    }
  }
}

async function excluirSelecionado(): Promise<void> {
  if (selecionadoId === null) return;
  if (!confirmar(`Excluir definitivamente este ${ROTULOS[tipo].toLowerCase()}? Esta acao nao pode ser desfeita.`)) {
    return;
  }
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
    feedback("Registro excluido com sucesso.", true);
    document.body.dataset.registroExcluido = String(id);
    console.info("[ContasAPagar] registro excluido (tipo:", tipo, "id:", id, ")");
  } catch (erro) {
    if (erro instanceof ErroApi && erro.status === 409) {
      feedback("Nao foi possivel excluir: o registro esta vinculado a outros dados do sistema.", false);
    } else if (erro instanceof ErroApi && erro.status === 404) {
      feedback("Registro nao encontrado (pode ja ter sido excluido).", false);
    } else {
      feedback("Nao foi possivel excluir o registro. Tente novamente.", false);
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
    mensagem.textContent = "Nao foi possivel carregar os cadastros.";
    const tentar = document.createElement("button");
    tentar.id = "btn-tentar-novamente";
    tentar.type = "button";
    tentar.className =
      "inline-flex items-center gap-2 px-4 py-2 bg-white text-[#1c1b1b] border-4 border-[#1c1b1b] font-headline font-bold text-xs uppercase tracking-wider shadow-[3px_3px_0_0_#1c1b1b] hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all cursor-pointer";
    tentar.textContent = "Tentar novamente";
    tentar.addEventListener("click", () => void carregarListas());
    area.append(mensagem, tentar);
    document.body.dataset.tabelaEstado = "erro";
    document.body.dataset.apiStatus = "erro";
  }
}

function iniciar(): void {
  montarNavbar("todos-cadastros");

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
      if (selecionadoId !== null && !sujo) fecharPainel();
      renderTabela();
    });
  });
  document.getElementById("btn-filtro-empresas")!.classList.add("bg-[#ea580c]", "text-white");

  idCampo("campo-pesquisa").addEventListener("input", () => renderTabela());
  document.getElementById("tabela-area")!.addEventListener("click", (evento) => {
    const alvo = (evento.target as HTMLElement).closest<HTMLElement>("tr[data-id]");
    if (!alvo) return;
    abrirPainel(Number(alvo.dataset.id));
  });

  document.getElementById("btn-add-telefone-edt")!.addEventListener("click", () => {
    adicionarLinhaTelefone();
    atualizarSujo(true);
  });
  document.getElementById("painel-campos")!.addEventListener("input", () => atualizarSujo(true));

  document.getElementById("btn-edt-salvar")!.addEventListener("click", () => void salvarPainel());
  document.getElementById("btn-edt-excluir")!.addEventListener("click", () => void excluirSelecionado());
  document.getElementById("btn-edt-cancelar")!.addEventListener("click", () => {
    if (sujo && !confirmar("Ha alteracoes nao salvas. Deseja sair mesmo assim?")) return;
    fecharPainel();
  });

  document.addEventListener(
    "click",
    (evento) => {
      const alvo = (evento.target as HTMLElement).closest<HTMLElement>("[data-nav]");
      if (!alvo || !sujo) return;
      if (!confirmar("Ha alteracoes nao salvas. Deseja sair mesmo assim?")) {
        evento.preventDefault();
        evento.stopPropagation();
      }
    },
    true
  );

  document.addEventListener(
    "keydown",
    (evento) => {
      if (evento.key !== "Escape" || !sujo) return;
      if (!confirmar("Ha alteracoes nao salvas. Deseja sair mesmo assim?")) {
        evento.preventDefault();
        evento.stopPropagation();
      }
    },
    true
  );

  void carregarListas();
  console.info("[ContasAPagar] tela todos os cadastros iniciada");
}

export function iniciarTodosCadastros(): void {
  iniciar();
}
