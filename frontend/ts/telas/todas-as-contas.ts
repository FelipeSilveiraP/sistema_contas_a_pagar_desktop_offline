import {
  buscarStatus,
  listarContas,
  listarPagamentos,
  atualizarConta,
  excluirConta,
  registrarPagamento,
  estornarPagamento,
  ContaDados,
  PagamentoDados,
  ErroValidacaoApi,
  ErroApi,
 baixarAnexoConta } from "../api";
import { confirmarEstorno, confirmarExclusao } from "../componentes";
import { notificar } from "../notificacoes";
import { montarNavbar } from "../navbar";
import { paraCentavos, parseDataBR, formatarDataBR, formatarMoedaBR, mascaraDinamica } from "../mascaras";

type Filtro = "TODOS" | "AVENCER" | "HOJE" | "ATRASADO" | "PAGO" | "NAPASTA";

const ROTULO_FORMA: Record<string, string> = {
  boleto: "Boleto",
  pix: "PIX",
  cartao: "Cartão de Crédito",
  transferencia: "Transferência",
  dinheiro: "Dinheiro",
  debito: "Débito automático",
};

let contas: ContaDados[] = [];
let pagamentos: PagamentoDados[] = [];
let filtro: Filtro = "TODOS";
let pesquisa = "";
let selecionadoId: number | null = null;

function el<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

function hoje(): string {
  return new Date().toISOString().split("T")[0];
}

function statusDerivado(conta: ContaDados): { rotulo: string; classe: string } {
  if (conta.status === "PAGO") {
    return { rotulo: "Pago", classe: "bg-[#006c46]/10 text-[#006c46]" };
  }
  const diff = Math.round((new Date(conta.vencimento).getTime() - new Date(hoje()).getTime()) / 86400000);
  if (diff < 0) return { rotulo: "Atrasado", classe: "bg-[#ffdad6] text-[#ba1a1a]" };
  if (diff === 0) return { rotulo: "Vence Hoje", classe: "bg-[#ffdad6] text-[#ba1a1a]" };
  return { rotulo: "A Vencer", classe: "bg-[#fde400]/30 text-[#6a5f00]" };
}

function filtradas(): ContaDados[] {
  const termo = pesquisa.toLowerCase();
  return contas.filter((c) => {
    if (termo && !`${c.nomeEmpresa} ${c.numeroDocumento ?? ""} ${c.categoria ?? ""}`.toLowerCase().includes(termo)) {
      return false;
    }
    const diff = Math.round((new Date(c.vencimento).getTime() - new Date(hoje()).getTime()) / 86400000);
    switch (filtro) {
      case "PAGO": return c.status === "PAGO";
      case "NAPASTA": return c.boletoNaPasta;
      case "AVENCER": return c.status === "PENDENTE" && diff > 0;
      case "HOJE": return c.status === "PENDENTE" && diff === 0;
      case "ATRASADO": return c.status === "PENDENTE" && diff < 0;
      default: return true;
    }
  });
}

function celulaTexto(texto: string, classe: string): HTMLTableCellElement {
  const td = document.createElement("td");
  td.className = classe;
  const div = document.createElement("div");
  div.className = "font-bold text-[#1c1b1b]";
  div.textContent = texto;
  td.appendChild(div);
  return td;
}

function botaoRapido(rotulo: string, icone: string, classe: string, acao: () => void): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = classe;
  btn.title = rotulo === "PAGO" ? "Marcar como Pago" : "Marcar como Não Pago / Pendente";
  const ic = document.createElement("span");
  ic.className = "material-symbols-outlined text-sm font-bold";
  ic.textContent = icone;
  const tx = document.createElement("span");
  tx.textContent = rotulo;
  btn.append(ic, tx);
  btn.addEventListener("click", (evento) => {
    evento.stopPropagation();
    acao();
  });
  return btn;
}

function renderTabela(): void {
  const corpo = el("tableBody");
  corpo.replaceChildren();
  for (const conta of filtradas()) {
    const tr = document.createElement("tr");
    tr.className = "bill-row cursor-pointer transition-colors hover:bg-[#fff9d6]";
    tr.dataset.id = String(conta.id);
    if (conta.status === "PAGO") tr.classList.add("bg-[#4dffb2]/20");
    if (selecionadoId === conta.id) tr.classList.add("bg-[#FFE600]", "border-l-8", "border-l-[#1c1b1b]");

    const data = celulaTexto(formatarDataBR(conta.vencimento), "py-3 px-3 font-mono font-bold text-[#1c1b1b] whitespace-nowrap date-cell");
    const empresaTd = document.createElement("td");
    empresaTd.className = "py-3 px-3";
    const nome = document.createElement("div");
    nome.className = "font-bold text-[#1c1b1b]";
    nome.textContent = conta.nomeEmpresa;
    const desc = document.createElement("div");
    desc.className = "text-xs text-neutral-500 font-mono";
    desc.textContent = conta.categoria ?? "";
    empresaTd.append(nome, desc);
    const valor = celulaTexto(formatarMoedaBR(Math.round(conta.valor * 100)), "py-3 px-3 text-right font-mono font-bold whitespace-nowrap");
    valor.firstElementChild!.className = "";
    const pastaTd = celulaTexto(conta.boletoNaPasta ? "SIM" : "NÃO", "py-3 px-3 text-center whitespace-nowrap");
    pastaTd.firstElementChild!.className = `inline-block rounded-full px-3 py-1 text-xs font-mono font-bold uppercase leading-none ${conta.boletoNaPasta ? "bg-[#006c46]/10 text-[#006c46]" : "bg-neutral-200 text-neutral-700"}`;
    const status = statusDerivado(conta);
    const statusTd = celulaTexto(status.rotulo, "py-3 px-3 text-center whitespace-nowrap");
    statusTd.firstElementChild!.className = `status-badge inline-block rounded-full px-3 py-1 text-xs font-mono font-bold uppercase leading-none ${status.classe}`;
    const doc = celulaTexto(conta.numeroDocumento ?? "—", "py-3 px-3 font-mono text-xs whitespace-nowrap");
    doc.firstElementChild!.className = "";
    const tipoTd = celulaTexto(conta.tipoPessoa, "py-3 px-3 text-center whitespace-nowrap");
    tipoTd.firstElementChild!.className = "inline-block bg-neutral-100 text-neutral-600 rounded-full px-2.5 py-1 text-xs font-mono font-bold leading-none";
    const formaTd = celulaTexto(ROTULO_FORMA[conta.formaPagamento] ?? conta.formaPagamento, "py-3 px-3 text-center whitespace-nowrap");
    formaTd.firstElementChild!.className = "inline-block bg-neutral-100 border border-[#1c1b1b] text-neutral-700 px-2 py-0.5 text-xs font-mono font-bold uppercase";
    const pagador = celulaTexto(conta.pagadorResponsavel, "py-3 px-3 font-mono text-xs text-neutral-700 whitespace-nowrap");
    pagador.firstElementChild!.className = "";

    const btnPago = botaoRapido("PAGO", "check",
      "btn-mark-paid inline-flex items-center justify-center gap-1 bg-[#4dffb2] hover:bg-[#22c55e] text-[#1c1b1b] border-2 border-[#1c1b1b] font-mono text-xs font-bold px-3 py-1.5 shadow-[2px_2px_0px_0px_#1c1b1b] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer leading-none",
      () => void pagar(conta));
    const btnNaoPago = botaoRapido("NÃO PAGO", "close",
      "btn-mark-unpaid inline-flex items-center justify-center gap-1 bg-white hover:bg-neutral-100 text-[#ba1a1a] border-2 border-[#1c1b1b] font-mono text-xs font-bold px-3 py-1.5 shadow-[2px_2px_0px_0px_#1c1b1b] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer leading-none",
      () => void estornar(conta));
    const tdPago = document.createElement("td");
    tdPago.className = "py-3.5 px-3 text-center border-l-2 border-[#1c1b1b] whitespace-nowrap";
    tdPago.appendChild(btnPago);
    const tdNao = document.createElement("td");
    tdNao.className = "py-3.5 px-3 text-center whitespace-nowrap";
    tdNao.appendChild(btnNaoPago);

    tr.append(data, empresaTd, valor, pastaTd, statusTd, doc, tipoTd, formaTd, pagador, tdPago, tdNao);
    tr.addEventListener("click", () => selecionar(conta.id));
    corpo.appendChild(tr);
  }
  el("selectionEmptyState").classList.toggle("hidden", filtradas().length === 0);
}

function selecionar(id: number): void {
  selecionadoId = id;
  const conta = contas.find((c) => c.id === id);
  if (!conta) return;
  el("selectionDetailBox").classList.remove("hidden");
  el("editorContainer").classList.remove("hidden");
  el("selectionEmptyState").classList.add("hidden");
  el("detailProvider").textContent = conta.nomeEmpresa;
  el("detailDoc").textContent = conta.numeroDocumento ?? "—";
  el("detailDate").textContent = formatarDataBR(conta.vencimento);
  el("detailAmount").textContent = formatarMoedaBR(Math.round(conta.valor * 100));
  el("detailCategory").textContent = conta.categoria ?? "—";
  el("detailAnexo").textContent = conta.anexoNome ?? "Sem anexo";
  el("btnBaixarAnexo").classList.toggle("hidden", !conta.anexoNome);
  const pagamento = pagamentos.find((p) => p.idConta === id);
  el("detailPayment").textContent = pagamento
    ? `${formatarDataBR(pagamento.dataPagamento)} — ${formatarMoedaBR(Math.round(pagamento.valorPago * 100))}`
    : "Sem pagamento registrado";
  el("detailStatusText").textContent = statusDerivado(conta).rotulo;
  el("editorRecordName").textContent = `${conta.nomeEmpresa} (${conta.numeroDocumento ?? "s/ doc"})`;
  const campo = el<HTMLSelectElement>("fieldSelect").value;
  el<HTMLInputElement>("newValueInput").value = valorAtual(conta, campo);
  renderTabela();
}

function valorAtual(conta: ContaDados, campo: string): string {
  switch (campo) {
    case "vencimento": return formatarDataBR(conta.vencimento);
    case "valor": return formatarMoedaBR(Math.round(conta.valor * 100));
    case "boletoNaPasta": return conta.boletoNaPasta ? "SIM" : "NÃO";
    case "tipoPessoa": return conta.tipoPessoa;
    case "formaPagamento": return conta.formaPagamento;
    case "numeroDocumento": return conta.numeroDocumento ?? "";
    case "categoria": return conta.categoria ?? "";
    case "pagadorResponsavel": return conta.pagadorResponsavel;
    default: return conta.nomeEmpresa;
  }
}

async function recarregar(): Promise<void> {
  const cfg = await window.finDesk!.config();
  [contas, pagamentos] = await Promise.all([listarContas(cfg), listarPagamentos(cfg)]);
  renderTabela();
  if (selecionadoId !== null) {
    if (contas.some((c) => c.id === selecionadoId)) selecionar(selecionadoId);
    else {
      selecionadoId = null;
      el("selectionDetailBox").classList.add("hidden");
      el("editorContainer").classList.add("hidden");
    }
  }
}

async function pagar(conta: ContaDados): Promise<void> {
  if (conta.status === "PAGO") return;
  try {
    const cfg = await window.finDesk!.config();
    await registrarPagamento(cfg, conta.id, {
      dataPagamento: hoje(),
      valorPago: conta.valor.toFixed(2),
    });
    await recarregar();
    notificar(`Conta de "${conta.nomeEmpresa}" marcada como paga.`);
  } catch (erro) {
    console.error("[ContasAPagar] falha na baixa:", erro);
    notificar("Não foi possível registrar o pagamento. Tente de novo.", "erro");
  }
}

async function estornar(conta: ContaDados): Promise<void> {
  if (conta.status !== "PAGO") return;
  if (!(await confirmarEstorno(conta.nomeEmpresa))) return;
  try {
    const cfg = await window.finDesk!.config();
    await estornarPagamento(cfg, conta.id);
    await recarregar();
    notificar(`Pagamento de "${conta.nomeEmpresa}" desfeito.`);
  } catch (erro) {
    console.error("[ContasAPagar] falha no estorno:", erro);
    notificar("Não foi possível desfazer o pagamento. Tente de novo.", "erro");
  }
}

async function aplicarAlteracao(): Promise<void> {
  const conta = contas.find((c) => c.id === selecionadoId);
  if (!conta) return;
  const campo = el<HTMLSelectElement>("fieldSelect").value;
  const bruto = el<HTMLInputElement>("newValueInput").value.trim();
  const erros: Record<string, string> = {};
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
  switch (campo) {
    case "vencimento": {
      const iso = parseDataBR(bruto);
      if (!iso) erros.edicao = "Data inválida. Use o formato DD/MM/AAAA.";
      else patch.vencimento = iso;
      break;
    }
    case "valor": {
      const centavos = paraCentavos(bruto);
      if (centavos === null) erros.edicao = "Valor inválido. Exemplo: 150,00.";
      else patch.valor = (centavos / 100).toFixed(2);
      break;
    }
    case "boletoNaPasta": {
      if (!["SIM", "NÃO", "NAO", "N"].includes(bruto.toUpperCase())) {
        erros.edicao = "Responda SIM ou NÃO.";
      } else {
        patch.boletoNaPasta = bruto.toUpperCase().startsWith("S");
      }
      break;
    }
    case "tipoPessoa": {
      const t = bruto.toUpperCase();
      if (t !== "PF" && t !== "PJ") erros.edicao = "Responda PF ou PJ.";
      else patch.tipoPessoa = t;
      break;
    }
    case "formaPagamento": {
      const f = bruto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const mapa: Record<string, string> = {
        boleto: "boleto", pix: "pix", cartao: "cartao", "cartao de credito": "cartao",
        transferencia: "transferencia", dinheiro: "dinheiro", debito: "debito", "debito automatico": "debito",
      };
      if (!mapa[f]) erros.edicao = "Use: boleto, pix, cartão, transferência, dinheiro ou débito.";
      else patch.formaPagamento = mapa[f];
      break;
    }
    case "numeroDocumento": patch.numeroDocumento = bruto || undefined; break;
    case "categoria": patch.categoria = bruto || undefined; break;
    case "pagadorResponsavel": {
      if (!bruto || bruto.length > 120) erros.edicao = "Informe o pagador (de 1 a 120 caracteres).";
      else patch.pagadorResponsavel = bruto;
      break;
    }
    default: {
      if (bruto.length < 2 || bruto.length > 120) erros.edicao = "Informe o nome (de 2 a 120 caracteres).";
      else patch.nomeEmpresa = bruto;
    }
  }
  mostrarErroEdicao(erros.edicao);
  if (erros.edicao) return;
  try {
    const cfg = await window.finDesk!.config();
    await atualizarConta(cfg, conta.id, patch);
    await recarregar();
    notificar("Alterações salvas.");
  } catch (erro) {
    if (erro instanceof ErroValidacaoApi) {
      mostrarErroEdicao(Object.values(erro.campos)[0] ?? "Dados inválidos. Confira o valor digitado.");
    } else if (erro instanceof ErroApi && erro.status === 409) {
      mostrarErroEdacao409();
    } else {
      mostrarErroEdicao("Não foi possível salvar a alteração. Tente de novo.");
      console.error("[ContasAPagar] falha na edicao:", erro);
    }
  }
}

function mostrarErroEdicao(mensagem?: string): void {
  const alvo = document.querySelector<HTMLElement>('[data-erro-campo="edicao"]');
  if (!alvo) return;
  alvo.textContent = mensagem ?? "";
  alvo.classList.toggle("hidden", !mensagem);
}

function mostrarErroEdacao409(): void {
  mostrarErroEdicao("Não é possível: este registro está ligado a outros dados.");
}

async function excluirSelecionado(): Promise<void> {
  const conta = contas.find((c) => c.id === selecionadoId);
  if (!conta) return;
  if (!(await confirmarExclusao(`a conta de "${conta.nomeEmpresa}"`))) return;
  try {
    const cfg = await window.finDesk!.config();
    await excluirConta(cfg, conta.id);
    selecionadoId = null;
    el("selectionDetailBox").classList.add("hidden");
    el("editorContainer").classList.add("hidden");
    await recarregar();
    notificar("Conta excluída.");
  } catch (erro) {
    if (erro instanceof ErroApi && erro.status === 409) {
      mostrarErroEdicao("Não é possível excluir: esta conta já tem pagamento registrado. Desfaça o pagamento antes.");
    } else {
      mostrarErroEdicao("Não foi possível excluir a conta. Tente de novo.");
      console.error("[ContasAPagar] falha na exclusao:", erro);
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
  montarNavbar("todas-as-contas");

  el("searchInput").addEventListener("input", () => {
    pesquisa = el<HTMLInputElement>("searchInput").value.trim();
    renderTabela();
  });
  document.querySelectorAll<HTMLButtonElement>(".filter-btn").forEach((botao) => {
    botao.addEventListener("click", () => {
      filtro = botao.dataset.filter as Filtro;
      document.querySelectorAll<HTMLButtonElement>(".filter-btn").forEach((b) => {
        b.classList.toggle("active-filter", b === botao);
        b.classList.toggle("bg-[#1c1b1b]", b === botao);
        b.classList.toggle("text-white", b === botao);
        b.classList.toggle("bg-white", b !== botao);
      });
      renderTabela();
    });
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
  el("btnCancelEdit").addEventListener("click", () => mostrarErroEdicao());
  el("btnApplyChange").addEventListener("click", () => void aplicarAlteracao());
  el("btnDeleteAction").addEventListener("click", () => void excluirSelecionado());
  el("btnPayAction").addEventListener("click", () => {
    const conta = contas.find((c) => c.id === selecionadoId);
    if (conta) void pagar(conta);
  });
  el("btnUnpayAction").addEventListener("click", () => {
    const conta = contas.find((c) => c.id === selecionadoId);
    if (conta) void estornar(conta);
  });
  // mascara do "novo valor" acompanha o campo escolhido (data, moeda ou texto livre)
  const tiposEditor: Record<string, "data" | "moeda"> = { vencimento: "data", valor: "moeda" };
  const editor = el<HTMLInputElement>("newValueInput");
  const tipoEditor = (): "data" | "moeda" | null => tiposEditor[el<HTMLSelectElement>("fieldSelect").value] ?? null;
  const ajustarTeclado = (): void => {
    editor.inputMode = tipoEditor() ? "numeric" : "text";
  };
  mascaraDinamica(editor, tipoEditor);
  ajustarTeclado();
  el<HTMLSelectElement>("fieldSelect").addEventListener("change", ajustarTeclado);
  // nota fiscal anexada: salva em Downloads (sem dialogo nativo) e oferece ABRIR
  el("btnBaixarAnexo").addEventListener("click", async () => {
    const conta = contas.find((c) => c.id === selecionadoId);
    if (!conta || !conta.anexoNome) return;
    try {
      const cfg = await window.finDesk!.config();
      const bytes = await baixarAnexoConta(cfg, conta.id);
      const salvo = await window.finDesk!.salvarNota(conta.anexoNome, bytes);
      if (!salvo.ok || !salvo.caminho) throw new Error("falha ao gravar");
      const caminho = salvo.caminho;
      document.body.dataset.notaSalva = caminho;
      notificar("Nota fiscal salva na pasta Downloads › Chaveiro Universal - Notas Fiscais.", "sucesso", {
        rotulo: "Abrir",
        aoClicar: () => void window.finDesk!.abrirNota(caminho),
      });
    } catch (erro) {
      notificar("Não foi possível salvar a nota fiscal. Tente de novo.", "erro");
      console.error("[ContasAPagar] falha ao baixar anexo:", erro);
    }
  });
  el<HTMLSelectElement>("fieldSelect").addEventListener("change", () => {
    const conta = contas.find((c) => c.id === selecionadoId);
    if (conta) el<HTMLInputElement>("newValueInput").value = valorAtual(conta, el<HTMLSelectElement>("fieldSelect").value);
    mostrarErroEdicao();
  });

  void verificarApi();
  void recarregar();
  console.info("[ContasAPagar] tela todas as contas iniciada");
}

export function iniciarTodasAsContas(): void {
  iniciar();
}
