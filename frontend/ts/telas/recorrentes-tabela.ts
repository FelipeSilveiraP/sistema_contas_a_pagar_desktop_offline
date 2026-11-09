import {
  buscarStatus,
  listarContasFixas,
  atualizarConta,
  ContaDados,
  ErroValidacaoApi,
} from "../api";
import { montarNavbar } from "../navbar";
import { mascaraData, mascaraMoeda, paraCentavos, parseDataBR, formatarDataBR, formatarMoedaBR } from "../mascaras";

const ROTULO_FORMA: Record<string, string> = {
  boleto: "Boleto", pix: "PIX", cartao: "Cartão", transferencia: "Transferência", dinheiro: "Dinheiro",
};

let contas: ContaDados[] = [];
let pesquisa = "";
let filtro = "TODOS";
let selecionadoId: number | null = null;

function el<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

function hoje(): string {
  return new Date().toISOString().split("T")[0];
}

function filtradas(): ContaDados[] {
  const termo = pesquisa.toLowerCase();
  return contas.filter((c) => {
    if (termo && !`${c.nomeEmpresa} ${c.numeroDocumento ?? ""} ${c.pagadorResponsavel}`.toLowerCase().includes(termo)) {
      return false;
    }
    const diff = Math.round((new Date(c.vencimento).getTime() - new Date(hoje()).getTime()) / 86400000);
    if (filtro === "AVENCER") return c.status === "PENDENTE" && diff > 0;
    if (filtro === "HOJE") return c.status === "PENDENTE" && diff === 0;
    if (filtro === "ATRASADO") return c.status === "PENDENTE" && diff < 0;
    return true;
  });
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
    selo.className = "inline-block bg-neutral-100 text-neutral-600 rounded-full px-2.5 py-1 text-xs font-mono font-bold leading-none";
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
  el<HTMLInputElement>("newValueInput").value = valorAtual(conta, el<HTMLSelectElement>("fieldSelect").value);
  renderTabela();
}

function toast(mensagem: string): void {
  let t = document.getElementById("toast-recorrentes");
  if (!t) {
    t = document.createElement("div");
    t.id = "toast-recorrentes";
    t.className = "fixed bottom-6 right-6 z-50 bg-[#3ffdae] border-4 border-[#1c1b1b] p-4 shadow-[5px_5px_0px_0px_#1c1b1b] max-w-sm";
    t.setAttribute("role", "status");
    document.body.appendChild(t);
  }
  t.textContent = mensagem;
  t.classList.remove("hidden");
  window.setTimeout(() => t!.classList.add("hidden"), 2200);
}

function mostrarErro(mensagem?: string): void {
  const alvo = document.querySelector<HTMLElement>('[data-erro-campo="edicao"]');
  if (!alvo) return;
  alvo.textContent = mensagem ?? "";
  alvo.classList.toggle("hidden", !mensagem);
}

async function recarregar(): Promise<void> {
  const cfg = await window.finDesk!.config();
  contas = await listarContasFixas(cfg);
  renderTabela();
}

async function aplicarAlteracao(): Promise<void> {
  const conta = contas.find((c) => c.id === selecionadoId);
  if (!conta) return;
  const campo = el<HTMLSelectElement>("fieldSelect").value;
  const bruto = el<HTMLInputElement>("newValueInput").value.trim();
  const patch = {
    nomeEmpresa: conta.nomeEmpresa,
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
    if (!iso) return mostrarErro("data invalida (use DD/MM/AAAA)");
    patch.vencimento = iso;
  } else if (campo === "valor") {
    const centavos = paraCentavos(bruto);
    if (centavos === null) return mostrarErro("valor invalido (use R$ 0,00)");
    patch.valor = (centavos / 100).toFixed(2);
  } else if (campo === "pagadorResponsavel") {
    if (!bruto || bruto.length > 120) return mostrarErro("informe o pagador (1 a 120 caracteres)");
    patch.pagadorResponsavel = bruto;
  } else {
    const f = bruto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const mapa: Record<string, string> = {
      boleto: "boleto", pix: "pix", cartao: "cartao", transferencia: "transferencia", dinheiro: "dinheiro",
    };
    if (!mapa[f]) return mostrarErro("use: boleto, pix, cartao, transferencia ou dinheiro");
    patch.formaPagamento = mapa[f];
  }
  mostrarErro();
  try {
    const cfg = await window.finDesk!.config();
    await atualizarConta(cfg, conta.id, patch);
    await recarregar();
    toast("Registro atualizado.");
  } catch (erro) {
    if (erro instanceof ErroValidacaoApi) mostrarErro(Object.values(erro.campos)[0] ?? "dados invalidos");
    else {
      mostrarErro("nao foi possivel atualizar o registro");
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
    renderTabela();
  });
  el("btnCancelEdit").addEventListener("click", () => mostrarErro());
  el("btnApplyChange").addEventListener("click", () => void aplicarAlteracao());
  el<HTMLSelectElement>("fieldSelect").addEventListener("change", () => {
    const conta = contas.find((c) => c.id === selecionadoId);
    if (conta) el<HTMLInputElement>("newValueInput").value = valorAtual(conta, el<HTMLSelectElement>("fieldSelect").value);
    mostrarErro();
  });

  void verificarApi();
  void recarregar();
  console.info("[ContasAPagar] tabela de contas recorrentes iniciada");
}

export function iniciarRecorrentesTabela(): void {
  iniciar();
}
