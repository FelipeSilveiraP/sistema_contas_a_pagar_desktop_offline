import {
  buscarStatus,
  excluirRecorrente,
  gerarContasRecorrente,
  listarContasFixas,
  listarRecorrentes,
  RecorrenteDados,
  atualizarConta,
  ContaDados,
  ErroValidacaoApi,
  listarPagadores,
  PagadorDados,
} from "../api";
import { criarEditorCampo, EditorCampo } from "../editor-registro";
import { montarNavbar } from "../navbar";
import { paraCentavos, parseDataBR, formatarDataBR, formatarMoedaBR } from "../mascaras";
import { correspondeBusca, hojeIso, ordenar } from "../filtros";
import { notificar } from "../notificacoes";
import { confirmar } from "../componentes";

const ROTULO_FORMA: Record<string, string> = {
  boleto: "Boleto", pix: "PIX", cartao: "Cartão", transferencia: "Transferência", dinheiro: "Dinheiro", debito: "Débito automático",
};

let contas: ContaDados[] = [];
let pesquisa = "";
let filtro = "TODOS";
let selecionadoId: number | null = null;

function el<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

function hoje(): string {
  return hojeIso();
}


function filtradas(): ContaDados[] {
  const lista = contas.filter((c) => {
    if (!correspondeBusca(pesquisa, [c.nomeEmpresa, c.numeroDocumento, c.pagadorResponsavel], c.valor)) {
      return false;
    }
    if (filtro === "PF" || filtro === "PJ") return c.tipoPessoa === filtro;
    const diff = Math.round((new Date(c.vencimento).getTime() - new Date(hoje()).getTime()) / 86400000);
    if (filtro === "AVENCER") return c.status === "PENDENTE" && diff > 0;
    if (filtro === "HOJE") return c.status === "PENDENTE" && diff === 0;
    if (filtro === "ATRASADO") return c.status === "PENDENTE" && diff < 0;
    return true;
  });
  return ordenar(lista, "DATA_ASC", { data: (c) => c.vencimento, valor: (c) => c.valor, nome: (c) => c.nomeEmpresa });
}

function celula(texto: string, classe: string): HTMLTableCellElement {
  const td = document.createElement("td");
  td.className = classe;
  td.textContent = texto;
  return td;
}

function renderTabela(): void {
  const corpo = el("tableBody");
  corpo.replaceChildren();
  let total = 0;
  for (const conta of filtradas()) {
    total += Math.round(conta.valor * 100);
    const tr = document.createElement("tr");
    tr.className = "bill-row cursor-pointer transition-colors hover:bg-[#e0f2fe]";
    tr.dataset.id = String(conta.id);
    if (conta.status === "PAGO") tr.classList.add("bg-[#4dffb2]/20");
    if (selecionadoId === conta.id) tr.classList.add("bg-[#38bdf8]", "border-l-8", "border-l-[#1c1b1b]");
    const tdTipo = celula(conta.tipoPessoa, "py-3.5 px-4 text-center whitespace-nowrap");
    tdTipo.textContent = "";
    const selo = document.createElement("span");
    selo.className = "selo bg-neutral-100 text-neutral-600";
    selo.textContent = conta.tipoPessoa;
    tdTipo.appendChild(selo);
    tr.append(
      celula(formatarDataBR(conta.vencimento), "py-3.5 px-4 font-mono font-bold text-[#1c1b1b] whitespace-nowrap"),
      celula(conta.nomeEmpresa, "py-3.5 px-4"),
      celula(formatarMoedaBR(Math.round(conta.valor * 100)), "py-3.5 px-4 text-right font-mono font-bold whitespace-nowrap"),
      tdTipo,
      celula(ROTULO_FORMA[conta.formaPagamento] ?? conta.formaPagamento, "py-3.5 px-4 text-center whitespace-nowrap"),
      celula(conta.pagadorResponsavel, "py-3.5 px-4 font-mono text-xs text-neutral-700 whitespace-nowrap"),
    );
    tr.addEventListener("click", () => selecionar(conta.id));
    corpo.appendChild(tr);
  }
  el("tableSummaryCount").textContent = String(filtradas().length);
  el("tableSummaryAmount").textContent = formatarMoedaBR(total);
  el("selectionEmptyState").classList.toggle("hidden", filtradas().length > 0);
}

function valorAtual(conta: ContaDados, campo: string): string {
  switch (campo) {
    case "vencimento": return formatarDataBR(conta.vencimento);
    case "pagadorResponsavel": return conta.pagadorResponsavel;
    case "formaPagamento": return conta.formaPagamento;
    default: return formatarMoedaBR(Math.round(conta.valor * 100));
  }
}

function selecionar(id: number): void {
  selecionadoId = id;
  const conta = contas.find((c) => c.id === id);
  if (!conta) return;
  el("editorContainer").classList.remove("hidden");
  el("editorRecordName").textContent = `${conta.nomeEmpresa} (${formatarDataBR(conta.vencimento)})`;
  editor.atualizar();
  renderTabela();
}

function mostrarErro(mensagem?: string): void {
  editor?.erro(mensagem);
}

let recorrentes: RecorrenteDados[] = [];
let pagadores: PagadorDados[] = [];
let editor: EditorCampo;

async function recarregar(): Promise<void> {
  const cfg = await window.finDesk!.config();
  [contas, recorrentes, pagadores] = await Promise.all([listarContasFixas(cfg), listarRecorrentes(cfg), listarPagadores(cfg)]);
  renderTabela();
  renderCadastradas();
}

// ===== Contas fixas cadastradas (a recorrencia em si): gerar proximos meses / excluir =====
function botaoAcao(texto: string, classe: string, acao: () => void): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.className = `border-2 border-[#1c1b1b] font-mono text-xs font-bold px-2.5 py-1.5 uppercase shadow-[2px_2px_0px_0px_#1c1b1b] ${classe}`;
  b.textContent = texto;
  b.addEventListener("click", acao);
  return b;
}

function renderCadastradas(): void {
  const corpo = document.getElementById("recorrentesCadastradas");
  if (!corpo) return;
  if (!recorrentes.length) {
    const tr = document.createElement("tr");
    tr.appendChild(celula("Nenhuma conta fixa cadastrada. Use CONTROLE › CONTAS RECORRENTES › CADASTRAR.", "py-3 px-3 text-center font-mono text-xs text-neutral-500 uppercase"));
    (tr.firstChild as HTMLTableCellElement).colSpan = 7;
    corpo.replaceChildren(tr);
    return;
  }
  corpo.replaceChildren(...recorrentes.map((r) => {
    const tr = document.createElement("tr");
    tr.dataset.recorrente = String(r.id);
    const acoes = celula("", "py-2 px-3 text-center whitespace-nowrap");
    const grupo = document.createElement("div");
    grupo.className = "inline-flex gap-2";
    grupo.append(
      botaoAcao("Gerar próximos meses", "bg-[#ede9fe] hover:bg-[#ddd6fe] text-[#1c1b1b]", () => void gerar(r)),
      botaoAcao("Excluir", "bg-white hover:bg-neutral-100 text-[#ba1a1a]", () => void excluirFixa(r)),
    );
    acoes.appendChild(grupo);
    tr.append(
      celula(r.nomeEmpresa, "py-2 px-3"),
      celula(formatarMoedaBR(Math.round(r.valor * 100)), "py-2 px-3 text-right font-mono whitespace-nowrap"),
      celula(String(r.dia), "py-2 px-3 text-center font-mono"),
      celula(r.periodicidade, "py-2 px-3 text-center font-mono text-xs"),
      celula(r.tipoPessoa, "py-2 px-3 text-center font-mono"),
      celula(r.pagadorResponsavel, "py-2 px-3 font-mono text-xs"),
      acoes,
    );
    return tr;
  }));
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
  const conta = contas.find((c) => c.id === selecionadoId);
  if (!conta) return;
  const campo = editor.campo();
  const bruto = editor.ler();
  const patch = {
    nomeEmpresa: conta.nomeEmpresa,
    // sem isto o PUT gravava id_empresa = NULL e apagava o vinculo com a empresa emissora
    idEmpresa: conta.idEmpresa ?? undefined,
    pagadorResponsavel: conta.pagadorResponsavel,
    tipoPessoa: conta.tipoPessoa,
    formaPagamento: conta.formaPagamento,
    categoria: conta.categoria ?? undefined,
    numeroDocumento: conta.numeroDocumento ?? undefined,
    valor: conta.valor.toFixed(2),
    vencimento: conta.vencimento,
    boletoNaPasta: conta.boletoNaPasta,
    forcar: true,
  };
  if (campo === "vencimento") {
    const iso = parseDataBR(bruto);
    if (!iso) return mostrarErro("Data inválida. Use o formato DD/MM/AAAA.");
    patch.vencimento = iso;
  } else if (campo === "valor") {
    const centavos = paraCentavos(bruto);
    if (centavos === null) return mostrarErro("Valor inválido. Exemplo: 150,00.");
    patch.valor = (centavos / 100).toFixed(2);
  } else if (campo === "pagadorResponsavel") {
    if (!bruto || bruto.length > 120) return mostrarErro("Informe o pagador (de 1 a 120 caracteres).");
    patch.pagadorResponsavel = bruto;
  } else {
    const f = bruto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const mapa: Record<string, string> = {
      boleto: "boleto", pix: "pix", cartao: "cartao", transferencia: "transferencia", dinheiro: "dinheiro",
      debito: "debito", "debito automatico": "debito",
    };
    if (!mapa[f]) return mostrarErro("Use: boleto, pix, cartão, transferência, dinheiro ou débito.");
    patch.formaPagamento = mapa[f];
  }
  mostrarErro();
  try {
    const cfg = await window.finDesk!.config();
    await atualizarConta(cfg, conta.id, patch);
    await recarregar();
    notificar("Alterações salvas.");
  } catch (erro) {
    if (erro instanceof ErroValidacaoApi) mostrarErro(Object.values(erro.campos)[0] ?? "Dados inválidos. Confira o valor digitado.");
    else {
      mostrarErro("Não foi possível salvar a alteração. Tente de novo.");
      console.error("[ContasAPagar] falha na edicao:", erro);
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
  el("btnClearSelection").addEventListener("click", () => {
    selecionadoId = null;
    el("editorContainer").classList.add("hidden");
    mostrarErro();
    renderTabela();
  });
  el("btnApplyChange").addEventListener("click", () => void aplicarAlteracao());
  editor = criarEditorCampo([
    { valor: "valor", rotulo: "Valor (R$)", mascara: "moeda" },
    { valor: "vencimento", rotulo: "Vencimento (Data)", mascara: "data" },
    { valor: "pagadorResponsavel", rotulo: "Pagador responsável", opcoes: () => pagadores.map((p) => ({ valor: p.nome, rotulo: p.nome })) },
    { valor: "formaPagamento", rotulo: "Documento de cobrança", opcoes: () => Object.entries(ROTULO_FORMA).map(([valor, rotulo]) => ({ valor, rotulo })) },
  ], (campo) => {
    const conta = contas.find((c) => c.id === selecionadoId);
    return conta ? valorAtual(conta, campo) : "";
  });

  void verificarApi();
  void recarregar();
  console.info("[ContasAPagar] tabela de contas recorrentes iniciada");
}

export function iniciarRecorrentesTabela(): void {
  iniciar();
}
