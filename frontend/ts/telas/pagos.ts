import {
  buscarStatus,
  listarPagamentos,
  listarContas,
  listarBancos,
  atualizarPagamento,
  estornarPagamento,
  PagamentoDados,
  ContaDados,
  BancoDados,
  ErroValidacaoApi,
} from "../api";
import { confirmar } from "../componentes";
import { montarNavbar } from "../navbar";
import { mascaraData, mascaraMoeda, paraCentavos, parseDataBR, formatarDataBR, formatarMoedaBR } from "../mascaras";

let pagamentos: PagamentoDados[] = [];
let contas: ContaDados[] = [];
let bancos: BancoDados[] = [];
let pesquisa = "";
let selecionadoId: number | null = null;

function el<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

function contaDo(idConta: number): ContaDados | undefined {
  return contas.find((c) => c.id === idConta);
}

function filtrados(): PagamentoDados[] {
  const termo = pesquisa.toLowerCase();
  return pagamentos.filter((p) => {
    if (!termo) return true;
    return `${p.nomeEmpresa} ${p.instituicaoBanco ?? ""} ${contaDo(p.idConta)?.numeroDocumento ?? ""}`
      .toLowerCase().includes(termo);
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
  for (const pagamento of filtrados()) {
    total += Math.round(pagamento.valorPago * 100);
    const tr = document.createElement("tr");
    tr.className = "bill-row cursor-pointer transition-colors hover:bg-[#d9fbe8]";
    tr.dataset.id = String(pagamento.id);
    if (selecionadoId === pagamento.id) tr.classList.add("bg-[#4dffb2]", "border-l-8", "border-l-[#1c1b1b]");
    tr.append(
      celula(formatarDataBR(pagamento.dataPagamento), "py-3.5 px-4 font-mono font-bold text-[#006c46] whitespace-nowrap date-cell"),
      celula(pagamento.nomeEmpresa, "py-3.5 px-4"),
      celula(formatarDataBR(contaDo(pagamento.idConta)?.vencimento ?? ""), "py-3.5 px-4 font-mono whitespace-nowrap"),
      celula(formatarMoedaBR(Math.round(pagamento.valorPago * 100)), "py-3.5 px-4 text-right font-mono font-bold whitespace-nowrap"),
      celula(pagamento.instituicaoBanco ?? "—", "py-3.5 px-4 font-mono text-xs text-neutral-700 whitespace-nowrap"),
    );
    tr.addEventListener("click", () => selecionar(pagamento.id));
    corpo.appendChild(tr);
  }
  el("tableSummaryAmount").textContent = formatarMoedaBR(total);
  el("selectionEmptyState").classList.toggle("hidden", filtrados().length > 0);
}

function valorAtual(pagamento: PagamentoDados, campo: string): string {
  switch (campo) {
    case "dataPagamento": return formatarDataBR(pagamento.dataPagamento);
    case "banco": return pagamento.instituicaoBanco ?? "";
    default: return formatarMoedaBR(Math.round(pagamento.valorPago * 100));
  }
}

function selecionar(id: number): void {
  selecionadoId = id;
  const pagamento = pagamentos.find((p) => p.id === id);
  if (!pagamento) return;
  const conta = contaDo(pagamento.idConta);
  el("selectionDetailBox").classList.remove("hidden");
  el("editorContainer").classList.remove("hidden");
  el("selectionEmptyState").classList.add("hidden");
  el("detailProvider").textContent = pagamento.nomeEmpresa;
  el("detailDoc").textContent = conta?.numeroDocumento ?? "—";
  el("detailDate").textContent = formatarDataBR(conta?.vencimento ?? "");
  el("detailAmount").textContent = formatarMoedaBR(Math.round(pagamento.valorPago * 100));
  el("detailCategory").textContent = conta?.categoria ?? "—";
  el("detailBank").textContent = pagamento.instituicaoBanco ?? "—";
  el("editorRecordName").textContent = `${pagamento.nomeEmpresa} (${formatarDataBR(pagamento.dataPagamento)})`;
  el<HTMLInputElement>("newValueInput").value = valorAtual(pagamento, el<HTMLSelectElement>("fieldSelect").value);
  renderTabela();
}

function toast(mensagem: string): void {
  let t = document.getElementById("toast-pagos");
  if (!t) {
    t = document.createElement("div");
    t.id = "toast-pagos";
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
  [pagamentos, contas, bancos] = await Promise.all([listarPagamentos(cfg), listarContas(cfg), listarBancos(cfg)]);
  renderTabela();
  if (selecionadoId !== null && pagamentos.some((p) => p.id === selecionadoId)) selecionar(selecionadoId);
}

async function aplicarAlteracao(): Promise<void> {
  const pagamento = pagamentos.find((p) => p.id === selecionadoId);
  if (!pagamento) return;
  const campo = el<HTMLSelectElement>("fieldSelect").value;
  const bruto = el<HTMLInputElement>("newValueInput").value.trim();
  let dataPagamento = pagamento.dataPagamento;
  let valorPago = pagamento.valorPago.toFixed(2);
  let idBanco = pagamento.idBanco ?? undefined;
  if (campo === "dataPagamento") {
    const iso = parseDataBR(bruto);
    if (!iso) return mostrarErro("data invalida (use DD/MM/AAAA)");
    dataPagamento = iso;
  } else if (campo === "valorPago") {
    const centavos = paraCentavos(bruto);
    if (centavos === null) return mostrarErro("valor invalido (use R$ 0,00)");
    valorPago = (centavos / 100).toFixed(2);
  } else {
    const alvo = bancos.find((b) => b.instituicao.toLowerCase() === bruto.toLowerCase());
    if (bruto && !alvo) return mostrarErro("banco nao encontrado no cadastro (deixe vazio para remover)");
    idBanco = alvo?.id;
  }
  mostrarErro();
  try {
    const cfg = await window.finDesk!.config();
    await atualizarPagamento(cfg, pagamento.id, { dataPagamento, valorPago, idBanco });
    await recarregar();
    toast("Pagamento atualizado.");
  } catch (erro) {
    if (erro instanceof ErroValidacaoApi) mostrarErro(Object.values(erro.campos)[0] ?? "dados invalidos");
    else {
      mostrarErro("nao foi possivel atualizar o pagamento");
      console.error("[ContasAPagar] falha na edicao do pagamento:", erro);
    }
  }
}

async function estornarSelecionado(): Promise<void> {
  const pagamento = pagamentos.find((p) => p.id === selecionadoId);
  if (!pagamento) return;
  if (!confirmar(`Estornar o pagamento de "${pagamento.nomeEmpresa}"? A conta voltará para PENDENTE.`)) return;
  try {
    const cfg = await window.finDesk!.config();
    await estornarPagamento(cfg, pagamento.idConta);
    selecionadoId = null;
    el("selectionDetailBox").classList.add("hidden");
    el("editorContainer").classList.add("hidden");
    await recarregar();
    toast("Pagamento estornado.");
  } catch (erro) {
    mostrarErro("nao foi possivel estornar o pagamento");
    console.error("[ContasAPagar] falha no estorno:", erro);
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
  montarNavbar("pagos");
  el("searchInput").addEventListener("input", () => {
    pesquisa = el<HTMLInputElement>("searchInput").value.trim();
    renderTabela();
  });
  el("btnCloseSelection").addEventListener("click", () => {
    selecionadoId = null;
    el("selectionDetailBox").classList.add("hidden");
    el("editorContainer").classList.add("hidden");
    renderTabela();
  });
  el("btnClearSelection").addEventListener("click", () => {
    selecionadoId = null;
    el("selectionDetailBox").classList.add("hidden");
    el("editorContainer").classList.add("hidden");
    renderTabela();
  });
  el("btnCancelEdit").addEventListener("click", () => mostrarErro());
  el("btnApplyChange").addEventListener("click", () => void aplicarAlteracao());
  el("btnUnpayAction").addEventListener("click", () => void estornarSelecionado());
  el<HTMLSelectElement>("fieldSelect").addEventListener("change", () => {
    const pagamento = pagamentos.find((p) => p.id === selecionadoId);
    if (pagamento) el<HTMLInputElement>("newValueInput").value = valorAtual(pagamento, el<HTMLSelectElement>("fieldSelect").value);
    mostrarErro();
  });

  void verificarApi();
  void recarregar();
  console.info("[ContasAPagar] tela contas pagas iniciada");
}

export function iniciarPagos(): void {
  iniciar();
}
