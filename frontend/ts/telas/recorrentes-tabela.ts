import {
  atualizarRecorrente,
  buscarStatus,
  ErroApi,
  ErroValidacaoApi,
  excluirRecorrente,
  gerarContasRecorrente,
  listarPagadores,
  listarRecorrentes,
  PagadorDados,
  RecorrenteDados,
} from "../api";
import { criarEditorCampo, EditorCampo } from "../editor-registro";
import { recolherTabela } from "../tabela-recolhivel";
import { aberturaPedida } from "../abrir-registro";
import { rolarParaEdicao } from "../rolagem";
import { montarNavbar } from "../navbar";
import { paraCentavos, formatarMoedaBR } from "../mascaras";
import { correspondeBusca } from "../filtros";
import { notificar } from "../notificacoes";
import { confirmar } from "../componentes";

// Uma tabela so: as contas fixas (a recorrencia). Editar uma linha muda a conta fixa
// e TODAS as contas dela ainda nao pagas (todos os meses). Para mudar um mes so,
// o caminho e Todas as Contas.

const ROTULO_FORMA: Record<string, string> = {
  boleto: "Boleto", pix: "PIX", cartao: "Cartão", transferencia: "Transferência", dinheiro: "Dinheiro", debito: "Débito automático",
};
const ROTULO_FREQUENCIA: Record<string, string> = {
  MENSAL: "Mensal", BIMESTRAL: "Bimestral", TRIMESTRAL: "Trimestral", ANUAL: "Anual",
};

let recorrentes: RecorrenteDados[] = [];
let pagadores: PagadorDados[] = [];
let pesquisa = "";
let filtro = "TODOS";
let selecionadoId: number | null = null;
let editor: EditorCampo;

function el<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

function celula(texto: string, classe: string): HTMLTableCellElement {
  const td = document.createElement("td");
  td.className = classe;
  td.textContent = texto;
  return td;
}

function filtradas(): RecorrenteDados[] {
  return recorrentes
    .filter((r) => correspondeBusca(pesquisa, [r.nomeEmpresa, r.pagadorResponsavel], r.valor))
    .filter((r) => filtro === "TODOS" || r.tipoPessoa === filtro)
    .sort((a, b) => a.dia - b.dia || a.nomeEmpresa.localeCompare(b.nomeEmpresa, "pt-BR"));
}

function botaoAcao(texto: string, classe: string, acao: () => void): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.className = `border-2 border-[#1c1b1b] font-mono text-xs font-bold px-2.5 py-1.5 uppercase shadow-[2px_2px_0px_0px_#1c1b1b] ${classe}`;
  b.textContent = texto;
  b.addEventListener("click", (evento) => {
    evento.stopPropagation(); // o clique no botao nao seleciona a linha
    acao();
  });
  return b;
}

function renderTabela(): void {
  const corpo = el<HTMLTableSectionElement>("tableBody");
  const lista = filtradas();
  let total = 0;
  corpo.replaceChildren(...lista.map((r) => {
    total += Math.round(r.valor * 100);
    const tr = document.createElement("tr");
    tr.className = "bill-row cursor-pointer transition-colors hover:bg-[#ede9fe]";
    tr.dataset.id = String(r.id);
    tr.dataset.recorrente = String(r.id);
    if (selecionadoId === r.id) tr.classList.add("bg-[#ddd6fe]", "border-l-8", "border-l-[#1c1b1b]");
    const tdTipo = celula("", "py-3 px-3 text-center whitespace-nowrap");
    const selo = document.createElement("span");
    selo.className = "selo bg-neutral-100 text-neutral-600";
    selo.textContent = r.tipoPessoa;
    tdTipo.appendChild(selo);
    const acoes = celula("", "py-2 px-3 text-center whitespace-nowrap");
    const grupo = document.createElement("div");
    grupo.className = "inline-flex gap-2";
    grupo.append(
      botaoAcao("Gerar próximos meses", "bg-[#ede9fe] hover:bg-[#ddd6fe] text-[#1c1b1b]", () => void gerar(r)),
      botaoAcao("Excluir", "bg-white hover:bg-neutral-100 text-[#ba1a1a]", () => void excluirFixa(r)),
    );
    acoes.appendChild(grupo);
    tr.append(
      celula(`Todo dia ${r.dia}`, "py-3 px-3 font-mono whitespace-nowrap"),
      celula(r.nomeEmpresa, "py-3 px-3"),
      celula(formatarMoedaBR(Math.round(r.valor * 100)), "py-3 px-3 text-right font-mono whitespace-nowrap"),
      tdTipo,
      celula(ROTULO_FORMA[r.formaPagamento ?? "boleto"] ?? r.formaPagamento ?? "", "py-3 px-3 text-center whitespace-nowrap"),
      celula(r.pagadorResponsavel, "py-3 px-3 font-mono text-xs whitespace-nowrap"),
      celula(ROTULO_FREQUENCIA[r.periodicidade] ?? r.periodicidade, "py-3 px-3 text-center font-mono text-xs uppercase"),
      acoes,
    );
    tr.addEventListener("click", () => selecionar(r.id));
    return tr;
  }));
  el("tableSummaryCount").textContent = String(lista.length);
  el("tableSummaryAmount").textContent = formatarMoedaBR(total);
  el("selectionEmptyState").classList.toggle("hidden", lista.length > 0);
  recolherTabela("fixas", corpo, corpo.closest("main")!, selecionadoId);
}

function selecionada(): RecorrenteDados | undefined {
  return recorrentes.find((r) => r.id === selecionadoId);
}

function selecionar(id: number): void {
  selecionadoId = id;
  const r = selecionada();
  if (!r) return;
  el("editorContainer").classList.remove("hidden");
  el("selectionEmptyHint").classList.add("hidden");
  el("editorRecordName").textContent = `${r.nomeEmpresa} (todo dia ${r.dia})`;
  editor.erro();
  editor.atualizar();
  renderTabela();
}

function fecharEditor(): void {
  selecionadoId = null;
  el("editorContainer").classList.add("hidden");
  el("selectionEmptyHint").classList.remove("hidden");
  editor.erro();
  renderTabela();
}

function valorAtual(r: RecorrenteDados, campo: string): string {
  switch (campo) {
    case "nomeEmpresa": return r.nomeEmpresa;
    case "dia": return String(r.dia);
    case "tipoPessoa": return r.tipoPessoa;
    case "formaPagamento": return r.formaPagamento ?? "boleto";
    case "pagadorResponsavel": return r.pagadorResponsavel;
    default: return formatarMoedaBR(Math.round(r.valor * 100));
  }
}

async function recarregar(): Promise<void> {
  const cfg = await window.finDesk!.config();
  [recorrentes, pagadores] = await Promise.all([listarRecorrentes(cfg), listarPagadores(cfg)]);
  if (selecionadoId !== null && !selecionada()) fecharEditor();
  renderTabela();
  // veio do Inserir Conta ("EDITAR A QUE JA EXISTE"): abre essa conta recorrente
  const pedida = aberturaPedida("recorrente");
  if (pedida !== null && recorrentes.some((r) => r.id === pedida)) {
    selecionar(pedida);
    rolarParaEdicao();
  }
}

async function gerar(r: RecorrenteDados): Promise<void> {
  try {
    const cfg = await window.finDesk!.config();
    const { geradas } = await gerarContasRecorrente(cfg, r.id);
    notificar(geradas > 0
      ? `${geradas} conta${geradas > 1 ? "s" : ""} de "${r.nomeEmpresa}" gerada${geradas > 1 ? "s" : ""} para os próximos meses.`
      : `As contas de "${r.nomeEmpresa}" dos próximos 12 meses já existem.`, geradas > 0 ? "sucesso" : "info");
    await recarregar();
  } catch {
    notificar("Não foi possível gerar as contas. Tente de novo.", "erro");
  }
}

async function excluirFixa(r: RecorrenteDados): Promise<void> {
  const ok = await confirmar({
    titulo: "EXCLUIR CONTA FIXA?",
    mensagem: `Excluir a conta fixa "${r.nomeEmpresa}"? As contas dela que ainda NÃO foram pagas também serão excluídas. As já pagas continuam no histórico.`,
    textoConfirmar: "EXCLUIR",
    tom: "perigo",
  });
  if (!ok) return;
  try {
    const cfg = await window.finDesk!.config();
    await excluirRecorrente(cfg, r.id);
    notificar(`Conta fixa "${r.nomeEmpresa}" excluída.`);
    await recarregar();
  } catch {
    notificar("Não foi possível excluir a conta fixa. Tente de novo.", "erro");
  }
}

async function aplicarAlteracao(): Promise<void> {
  const r = selecionada();
  if (!r) return;
  const campo = editor.campo();
  const bruto = editor.ler().trim();
  const dados: Omit<RecorrenteDados, "id"> = {
    nomeEmpresa: r.nomeEmpresa,
    idEmpresa: r.idEmpresa,
    pagadorResponsavel: r.pagadorResponsavel,
    categoria: r.categoria,
    numeroDocumento: r.numeroDocumento,
    valor: r.valor,
    dia: r.dia,
    periodicidade: r.periodicidade,
    formaPagamento: r.formaPagamento,
    ativo: r.ativo,
    tipoPessoa: r.tipoPessoa,
  };
  if (campo === "valor") {
    const centavos = paraCentavos(bruto);
    if (centavos === null) return editor.erro("Valor inválido. Exemplo: 150,00.");
    dados.valor = centavos / 100;
  } else if (campo === "dia") {
    const dia = Number(bruto);
    if (!Number.isInteger(dia) || dia < 1 || dia > 31) return editor.erro("Informe o dia do vencimento (de 1 a 31).");
    dados.dia = dia;
  } else if (campo === "nomeEmpresa") {
    if (bruto.length < 2 || bruto.length > 120) return editor.erro("Informe a empresa (de 2 a 120 caracteres).");
    dados.nomeEmpresa = bruto;
  } else if (campo === "pagadorResponsavel") {
    if (!bruto || bruto.length > 120) return editor.erro("Escolha o pagador responsável.");
    dados.pagadorResponsavel = bruto;
  } else if (campo === "tipoPessoa") {
    dados.tipoPessoa = bruto;
  } else {
    dados.formaPagamento = bruto;
  }
  editor.erro();
  try {
    const cfg = await window.finDesk!.config();
    const feita = await atualizarRecorrente(cfg, r.id, dados);
    await recarregar();
    selecionar(r.id);
    const n = feita.contasAlteradas;
    notificar(n > 0
      ? `Conta fixa alterada — ${n} conta${n > 1 ? "s" : ""} não paga${n > 1 ? "s" : ""} de todos os meses ${n > 1 ? "foram atualizadas" : "foi atualizada"}.`
      : "Conta fixa alterada.");
  } catch (erro) {
    if (erro instanceof ErroValidacaoApi) editor.erro(Object.values(erro.campos)[0] ?? "Dados inválidos. Confira o valor digitado.");
    else if (erro instanceof ErroApi && erro.status === 409) editor.erro("Já existe outra conta fixa igual (mesma empresa, valor, dia e frequência).");
    else {
      editor.erro("Não foi possível salvar a alteração. Tente de novo.");
      console.error("[ContasAPagar] falha na edicao da conta fixa:", erro);
    }
  }
}

async function verificarApi(): Promise<void> {
  try {
    const cfg = await window.finDesk!.config();
    await buscarStatus(cfg);
    document.body.dataset.apiStatus = "ok";
  } catch {
    document.body.dataset.apiStatus = "erro";
  }
}

function iniciar(): void {
  montarNavbar("recorrentes-tabela");
  el("searchInput").addEventListener("input", () => {
    pesquisa = el<HTMLInputElement>("searchInput").value.trim();
    renderTabela();
  });
  document.querySelectorAll<HTMLButtonElement>(".filter-btn").forEach((botao) => {
    botao.addEventListener("click", () => {
      filtro = botao.dataset.filter ?? "TODOS";
      document.querySelectorAll<HTMLButtonElement>(".filter-btn").forEach((b) => {
        b.classList.toggle("active-filter", b === botao);
        b.classList.toggle("bg-[#1c1b1b]", b === botao);
        b.classList.toggle("text-white", b === botao);
        b.classList.toggle("bg-white", b !== botao);
      });
      renderTabela();
    });
  });
  el("btnClearSelection").addEventListener("click", fecharEditor);
  el("btnApplyChange").addEventListener("click", () => void aplicarAlteracao());
  // as mesmas acoes da linha, tambem na area de edicao (como nas outras tabelas)
  el("btnGerarAction").addEventListener("click", () => {
    const r = selecionada();
    if (r) void gerar(r);
  });
  el("btnDeleteAction").addEventListener("click", () => {
    const r = selecionada();
    if (r) void excluirFixa(r);
  });
  editor = criarEditorCampo([
    { valor: "valor", rotulo: "Valor (R$)", mascara: "moeda" },
    { valor: "dia", rotulo: "Dia do vencimento", mascara: "dia" },
    { valor: "nomeEmpresa", rotulo: "Empresa" },
    { valor: "tipoPessoa", rotulo: "Conta (PF/PJ)", opcoes: () => [{ valor: "PJ", rotulo: "PJ — Pessoa jurídica" }, { valor: "PF", rotulo: "PF — Pessoa física" }] },
    { valor: "formaPagamento", rotulo: "Formato conta", opcoes: () => Object.entries(ROTULO_FORMA).map(([valor, rotulo]) => ({ valor, rotulo })) },
    { valor: "pagadorResponsavel", rotulo: "Pagador responsável", opcoes: () => {
      const r = selecionada();
      const nomes = pagadores.map((p) => p.nome);
      // o pagador gravado aparece mesmo que nao esteja mais no cadastro
      if (r && !nomes.includes(r.pagadorResponsavel)) nomes.unshift(r.pagadorResponsavel);
      return nomes.map((nome) => ({ valor: nome, rotulo: nome }));
    } },
  ], (campo) => {
    const r = selecionada();
    return r ? valorAtual(r, campo) : "";
  });

  void verificarApi();
  void recarregar();
  console.info("[ContasAPagar] tabela de contas fixas iniciada");
}

export function iniciarRecorrentesTabela(): void {
  iniciar();
}
