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
import { confirmarEstorno } from "../componentes";
import { notificar } from "../notificacoes";
import { montarNavbar } from "../navbar";
import { paraCentavos, parseDataBR, formatarDataBR, formatarMoedaBR, mascaraDinamica } from "../mascaras";
import { correspondeBusca, EstadoFiltroAvancado, montarControlesAvancados, noPeriodo, ordenar } from "../filtros";

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

let avancado: EstadoFiltroAvancado = { periodo: "TUDO", ordem: "DATA_DESC" };

function filtrados(): PagamentoDados[] {
  const lista = pagamentos.filter((p) =>
    correspondeBusca(pesquisa, [p.nomeEmpresa, p.instituicaoBanco, contaDo(p.idConta)?.numeroDocumento], p.valorPago)
    && noPeriodo(p.dataPagamento, avancado.periodo));
  return ordenar(lista, avancado.ordem, { data: (p) => p.dataPagamento, valor: (p) => p.valorPago, nome: (p) => p.nomeEmpresa });
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
    if (!iso) return mostrarErro("Data inválida. Use o formato DD/MM/AAAA.");
    dataPagamento = iso;
  } else if (campo === "valorPago") {
    const centavos = paraCentavos(bruto);
    if (centavos === null) return mostrarErro("Valor inválido. Exemplo: 150,00.");
    valorPago = (centavos / 100).toFixed(2);
  } else {
    const alvo = bancos.find((b) => b.instituicao.toLowerCase() === bruto.toLowerCase());
    if (bruto && !alvo) return mostrarErro("Banco não encontrado no cadastro. Deixe vazio para remover o banco.");
    idBanco = alvo?.id;
  }
  mostrarErro();
  try {
    const cfg = await window.finDesk!.config();
    await atualizarPagamento(cfg, pagamento.id, { dataPagamento, valorPago, idBanco });
    await recarregar();
    notificar("Alterações do pagamento salvas.");
  } catch (erro) {
    if (erro instanceof ErroValidacaoApi) mostrarErro(Object.values(erro.campos)[0] ?? "Dados inválidos. Confira o valor digitado.");
    else {
      mostrarErro("Não foi possível salvar a alteração do pagamento. Tente de novo.");
      console.error("[ContasAPagar] falha na edicao do pagamento:", erro);
    }
  }
}

async function estornarSelecionado(): Promise<void> {
  const pagamento = pagamentos.find((p) => p.id === selecionadoId);
  if (!pagamento) return;
  if (!(await confirmarEstorno(pagamento.nomeEmpresa))) return;
  try {
    const cfg = await window.finDesk!.config();
    await estornarPagamento(cfg, pagamento.idConta);
    selecionadoId = null;
    el("selectionDetailBox").classList.add("hidden");
    el("editorContainer").classList.add("hidden");
    await recarregar();
    notificar("Pagamento desfeito. A conta voltou a ficar pendente.");
  } catch (erro) {
    mostrarErro("Não foi possível desfazer o pagamento. Tente de novo.");
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
  avancado = montarControlesAvancados(el("searchInput").closest("div.w-full")!, avancado, (e) => {
    avancado = e;
    renderTabela();
  }, "Pagamento");
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
  // mascara do "novo valor" acompanha o campo escolhido (data, moeda ou texto livre)
  const tiposEditor: Record<string, "data" | "moeda"> = { dataPagamento: "data", valorPago: "moeda" };
  const editor = el<HTMLInputElement>("newValueInput");
  const tipoEditor = (): "data" | "moeda" | null => tiposEditor[el<HTMLSelectElement>("fieldSelect").value] ?? null;
  const ajustarTeclado = (): void => {
    editor.inputMode = tipoEditor() ? "numeric" : "text";
  };
  mascaraDinamica(editor, tipoEditor);
  ajustarTeclado();
  el<HTMLSelectElement>("fieldSelect").addEventListener("change", ajustarTeclado);
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
