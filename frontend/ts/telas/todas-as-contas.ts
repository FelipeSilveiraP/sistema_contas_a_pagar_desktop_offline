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
  baixarAnexoConta,
  removerAnexoConta,
  listarPagadores,
  PagadorDados,
} from "../api";
import { criarEditorCampo, EditorCampo } from "../editor-registro";
import { confirmar, confirmarEstorno, confirmarExclusao } from "../componentes";
import { escolher } from "../dialogos";
import { MIME_IMAGEM, extensaoNota, montarPreviaNota } from "../nota-previa";
import { notificar } from "../notificacoes";
import { imprimirDocumento, cabecalhoFolha, tabelaCampos, assinaturas, criar } from "../impressao";
import { ligarExpansaoColunas } from "../tabela-colunas";
import { montarNavbar } from "../navbar";
import { paraCentavos, parseDataBR, formatarDataBR, formatarMoedaBR } from "../mascaras";
import { correspondeBusca, hojeIso, ordenar } from "../filtros";

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
let pagadores: PagadorDados[] = [];
let editor: EditorCampo;
let filtro: Filtro = "TODOS";
let pesquisa = "";
let selecionadoId: number | null = null;
/** nota fiscal mostrada na area de edicao (chave = id + nome do arquivo) */
let notaAtual: { chave: string; bytes: Uint8Array; liberar: () => void } | null = null;

const LIMITE_NOTA = 10 * 1024 * 1024;
const EXTENSOES_NOTA = [".pdf", ".jpg", ".jpeg", ".png", ".webp", ".docx"];

function el<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

function hoje(): string {
  return hojeIso();
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
  const lista = contas.filter((c) => {
    if (!correspondeBusca(pesquisa, [c.nomeEmpresa, c.numeroDocumento, c.categoria, c.pagadorResponsavel], c.valor)) {
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
  return ordenar(lista, "DATA_ASC", { data: (c) => c.vencimento, valor: (c) => c.valor, nome: (c) => c.nomeEmpresa });
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
    pastaTd.firstElementChild!.className = `selo ${conta.boletoNaPasta ? "bg-[#006c46]/10 text-[#006c46]" : "bg-neutral-200 text-neutral-700"}`;
    const status = statusDerivado(conta);
    const statusTd = celulaTexto(status.rotulo, "py-3 px-3 text-center whitespace-nowrap");
    statusTd.firstElementChild!.className = `status-badge selo ${status.classe}`;
    const doc = celulaTexto(conta.numeroDocumento ?? "—", "col-extra py-3 px-3 font-mono text-xs whitespace-nowrap");
    doc.firstElementChild!.className = "";
    const tipoTd = celulaTexto(conta.tipoPessoa, "col-extra py-3 px-3 text-center whitespace-nowrap");
    tipoTd.firstElementChild!.className = "selo bg-neutral-100 text-neutral-600";
    const formaTd = celulaTexto(ROTULO_FORMA[conta.formaPagamento] ?? conta.formaPagamento, "col-extra py-3 px-3 text-center whitespace-nowrap");
    formaTd.firstElementChild!.className = "selo bg-neutral-100 text-neutral-700";
    const pagador = celulaTexto(conta.pagadorResponsavel, "col-extra py-3 px-3 font-mono text-xs text-neutral-700 whitespace-nowrap");
    const vazio = document.createElement("td");
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

    tr.append(data, empresaTd, valor, pastaTd, statusTd, doc, tipoTd, formaTd, pagador, vazio, tdPago, tdNao);
    tr.addEventListener("click", () => selecionar(conta.id));
    corpo.appendChild(tr);
  }
  if (!corpo.childElementCount) {
    const tr = document.createElement("tr");
    const td = celulaTexto(contas.length ? "Nenhuma conta encontrada com esses filtros." : "Nenhuma conta cadastrada. Use INSERIR CONTA no Menu.",
      "py-6 px-3 text-center font-mono text-xs uppercase");
    td.colSpan = 12;
    td.firstElementChild!.className = "text-neutral-500 font-bold";
    tr.appendChild(td);
    corpo.appendChild(tr);
  }
  el("selectionEmptyState").classList.toggle("hidden", selecionadoId !== null);
}

function fecharEdicao(): void {
  selecionadoId = null;
  limparNota();
  el("editorContainer").classList.add("hidden");
  mostrarErroEdicao();
  renderTabela();
}

function selecionar(id: number): void {
  selecionadoId = id;
  const conta = contas.find((c) => c.id === id);
  if (!conta) return;
  el("editorContainer").classList.remove("hidden");
  el("btnBaixarAnexo").classList.toggle("hidden", !notaDisponivel(conta));
  el<HTMLButtonElement>("btnPayAction").disabled = conta.status === "PAGO";
  el<HTMLButtonElement>("btnUnpayAction").disabled = conta.status !== "PAGO";
  el("editorRecordName").textContent = `${conta.nomeEmpresa} (${conta.numeroDocumento ?? "s/ doc"})`;
  editor.atualizar();
  void mostrarNota(conta);
  renderTabela();
}

// ---------- nota fiscal: visualizar, imprimir/salvar, trocar e excluir ----------

function limparNota(): void {
  notaAtual?.liberar();
  notaAtual = null;
  el("notaVisualizacao").classList.add("hidden");
  mostrarErroNota();
}

function mostrarErroNota(mensagem?: string): void {
  const p = el("notaErro");
  p.textContent = mensagem ?? "";
  p.classList.toggle("hidden", !mensagem);
}

/** Quadro da conta SEM nota: o motivo (nunca anexada, "veio sem nota" ou apagada na limpeza) e o botao de anexar. */
function mostrarSemNota(conta: ContaDados): void {
  const [motivo, icone, titulo, texto] = conta.anexoNome && conta.anexoRemovidoEm
    ? ["apagada", "auto_delete", "Nota apagada na limpeza",
      `O arquivo "${conta.anexoNome}" foi apagado em ${formatarDataBR(conta.anexoRemovidoEm)} na limpeza trimestral das contas pagas. Se ainda tiver a nota, anexe de novo.`]
    : conta.semNotaFiscal
      ? ["sem-nota", "receipt_long", "Conta sem nota fiscal",
        "Esta conta foi cadastrada como \"veio sem nota\". Se a nota chegar depois, anexe aqui."]
      : ["nao-anexada", "note_add", "Nenhuma nota fiscal anexada",
        "Esta conta ainda não tem nota fiscal. Anexe o PDF, a foto ou o arquivo do Word da nota."];
  el("notaVazia").dataset.motivo = motivo;
  el("notaVaziaIcone").textContent = icone;
  el("notaVaziaTitulo").textContent = titulo;
  el("notaVaziaTexto").textContent = texto;
}

/** Mostra a nota da conta logo abaixo da edicao (foto, PDF ou cartao do Word). */
async function mostrarNota(conta: ContaDados): Promise<void> {
  const disponivel = notaDisponivel(conta);
  el("btnTrocarNota").classList.toggle("hidden", !disponivel);
  el("btnExcluirNota").classList.toggle("hidden", !disponivel);
  el("notaVazia").classList.toggle("hidden", disponivel);
  if (!disponivel) {
    limparNota();
    mostrarSemNota(conta);
    return;
  }
  const chave = `${conta.id}:${conta.anexoNome}`;
  if (notaAtual?.chave === chave) return;
  limparNota();
  let bytes: Uint8Array;
  try {
    bytes = await baixarAnexoConta(await window.finDesk!.config(), conta.id);
  } catch (erro) {
    console.error("[ContasAPagar] falha ao ler a nota fiscal:", erro);
    mostrarErroNota("Não foi possível carregar a nota fiscal. Feche e abra a conta de novo.");
    return;
  }
  // o usuario pode ter clicado em outra conta enquanto a nota carregava
  if (selecionadoId !== conta.id || notaAtual) return;
  // o clique vai para o quadro (CSS), nao para o leitor de PDF
  const liberar = montarPreviaNota(el("notaConteudo"), conta.anexoNome ?? "nota-fiscal", bytes,
    "Arquivo do Word: não dá para mostrar aqui. Clique para abrir no Word ou salvar.");
  notaAtual = { chave, bytes, liberar };
  el("notaVisualizacao").classList.remove("hidden");
}

/** Clique na nota: o usuario escolhe imprimir ou salvar no computador. */
async function acaoNota(): Promise<void> {
  const conta = contas.find((c) => c.id === selecionadoId);
  if (!conta || !notaAtual || !conta.anexoNome) return;
  const bytes = notaAtual.bytes;
  const resposta = await escolher({
    titulo: "NOTA FISCAL",
    mensagem: `O que deseja fazer com a nota "${conta.anexoNome}"?`,
    textoConfirmar: "IMPRIMIR",
    textoAlternativa: "SALVAR NO COMPUTADOR",
    icone: "receipt_long",
  });
  if (resposta === "confirmar") await imprimirNota(conta, bytes);
  else if (resposta === "alternativa") await salvarNotaNoComputador(conta, bytes);
}

/** Grava a nota em Downloads e devolve o caminho (lanca erro se falhar). */
async function gravarNota(conta: ContaDados, bytes: Uint8Array): Promise<string> {
  const salvo = await window.finDesk!.salvarNota(conta.anexoNome ?? "nota-fiscal.pdf", bytes);
  if (!salvo.ok || !salvo.caminho) throw new Error("falha ao gravar");
  document.body.dataset.notaSalva = salvo.caminho;
  return salvo.caminho;
}

async function salvarNotaNoComputador(conta: ContaDados, bytes?: Uint8Array): Promise<void> {
  try {
    const dados = bytes ?? await baixarAnexoConta(await window.finDesk!.config(), conta.id);
    const caminho = await gravarNota(conta, dados);
    notificar("Nota fiscal salva em Downloads.", "sucesso", {
      rotulo: "Abrir",
      aoClicar: () => void window.finDesk!.abrirNota(caminho),
    });
  } catch (erro) {
    notificar("Não foi possível salvar a nota fiscal. Tente de novo.", "erro");
    console.error("[ContasAPagar] falha ao salvar a nota:", erro);
  }
}

/** Foto: folha A4 so com a imagem. PDF/Word: abre o proprio arquivo no programa padrao (Ctrl+P). */
async function imprimirNota(conta: ContaDados, bytes: Uint8Array): Promise<void> {
  const ext = extensaoNota(conta.anexoNome);
  if (MIME_IMAGEM[ext]) {
    const imagem = `data:${MIME_IMAGEM[ext]};base64,${bytesParaBase64(bytes)}`;
    await imprimirDocumento(`Nota ${conta.nomeEmpresa}`, (folha) => {
      const pagina = criar("section", "folha__pagina");
      pagina.appendChild(cabecalhoFolha(`Nota fiscal — ${conta.nomeEmpresa}`));
      const img = criar("img", "folha__imagem");
      img.alt = "Nota fiscal anexada";
      img.src = imagem;
      pagina.appendChild(img);
      folha.appendChild(pagina);
    }, { retrato: true });
    return;
  }
  try {
    const caminho = await gravarNota(conta, bytes);
    if (!(await window.finDesk!.abrirNota(caminho))) throw new Error("falha ao abrir");
    notificar(ext === "pdf"
      ? "Nota fiscal aberta no leitor de PDF: use Ctrl+P para imprimir."
      : "Nota fiscal aberta no Word: use Ctrl+P para imprimir.", "sucesso");
  } catch (erro) {
    notificar("Não foi possível abrir a nota fiscal para imprimir. Tente de novo.", "erro");
    console.error("[ContasAPagar] falha ao abrir a nota para imprimir:", erro);
  }
}

async function trocarNota(arquivo: File | undefined): Promise<void> {
  mostrarErroNota();
  const conta = contas.find((c) => c.id === selecionadoId);
  if (!arquivo || !conta) return;
  if (!EXTENSOES_NOTA.some((ext) => arquivo.name.toLowerCase().endsWith(ext))) {
    mostrarErroNota("Formato não aceito. Envie PDF, foto (JPG, PNG ou WEBP) ou Word (.docx).");
    return;
  }
  if (arquivo.size === 0 || arquivo.size > LIMITE_NOTA) {
    mostrarErroNota("O arquivo deve ter no máximo 10 MB.");
    return;
  }
  if (notaDisponivel(conta) && !(await confirmar({
    titulo: "TROCAR A NOTA FISCAL?",
    mensagem: `A nota "${conta.anexoNome}" será substituída por "${arquivo.name}".`,
    textoConfirmar: "TROCAR NOTA",
    tom: "atencao",
  }))) return;
  try {
    const bytes = new Uint8Array(await arquivo.arrayBuffer());
    await atualizarConta(await window.finDesk!.config(), conta.id, {
      ...dadosDaConta(conta),
      anexoNome: arquivo.name,
      anexoPdfBase64: bytesParaBase64(bytes),
      semNotaFiscal: false,
    });
    await recarregar();
    notificar("Nota fiscal anexada.");
  } catch (erro) {
    if (erro instanceof ErroValidacaoApi) {
      mostrarErroNota(erro.campos.anexo ?? Object.values(erro.campos)[0] ?? "Arquivo recusado.");
    } else {
      mostrarErroNota("Não foi possível anexar a nota fiscal. Tente de novo.");
      console.error("[ContasAPagar] falha ao trocar a nota:", erro);
    }
  }
}

async function excluirNota(): Promise<void> {
  const conta = contas.find((c) => c.id === selecionadoId);
  if (!conta || !notaDisponivel(conta)) return;
  if (!(await confirmarExclusao(`a nota fiscal "${conta.anexoNome}" desta conta`))) return;
  try {
    await removerAnexoConta(await window.finDesk!.config(), conta.id);
    await recarregar();
    notificar("Nota fiscal excluída. Use ANEXAR NOTA para colocar outra.");
  } catch (erro) {
    mostrarErroNota("Não foi possível excluir a nota fiscal. Tente de novo.");
    console.error("[ContasAPagar] falha ao excluir a nota:", erro);
  }
}

/** O arquivo da nota ainda esta no banco (a limpeza trimestral apaga os antigos). */
function notaDisponivel(conta: ContaDados): boolean {
  return Boolean(conta.anexoNome) && !conta.anexoRemovidoEm;
}

function textoNota(conta: ContaDados): string {
  if (conta.anexoNome && conta.anexoRemovidoEm) {
    return `${conta.anexoNome} (arquivo apagado na limpeza de ${formatarDataBR(conta.anexoRemovidoEm)})`;
  }
  if (conta.anexoNome) return conta.anexoNome;
  return conta.semNotaFiscal ? "Conta sem nota fiscal" : "Não anexada";
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
  [contas, pagamentos, pagadores] = await Promise.all([listarContas(cfg), listarPagamentos(cfg), listarPagadores(cfg)]);
  renderTabela();
  if (selecionadoId !== null) {
    if (contas.some((c) => c.id === selecionadoId)) selecionar(selecionadoId);
    else fecharEdicao();
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

/** Dados atuais da conta no formato do PUT (sem anexo: o arquivo existente e preservado). */
function dadosDaConta(conta: ContaDados) {
  return {
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
    semNotaFiscal: conta.semNotaFiscal,
    forcar: true,
  };
}

async function aplicarAlteracao(): Promise<void> {
  const conta = contas.find((c) => c.id === selecionadoId);
  if (!conta) return;
  const campo = editor.campo();
  const bruto = editor.ler();
  const erros: Record<string, string> = {};
  const patch = dadosDaConta(conta);
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
  editor?.erro(mensagem);
}

function montarEditor(): EditorCampo {
  const sel = (pares: [string, string][]) => () => pares.map(([valor, rotulo]) => ({ valor, rotulo }));
  return criarEditorCampo([
    { valor: "nomeEmpresa", rotulo: "Empresa / Fornecedor" },
    { valor: "vencimento", rotulo: "Vencimento (Data)", mascara: "data" },
    { valor: "valor", rotulo: "Valor (R$)", mascara: "moeda" },
    { valor: "boletoNaPasta", rotulo: "Está na pasta?", opcoes: sel([["SIM", "Sim, está na pasta"], ["NÃO", "Não"]]) },
    { valor: "numeroDocumento", rotulo: "Documento / NF-e" },
    { valor: "tipoPessoa", rotulo: "Tipo de conta (PF / PJ)", opcoes: sel([["PJ", "PJ — Pessoa jurídica"], ["PF", "PF — Pessoa física"]]) },
    { valor: "formaPagamento", rotulo: "Documento de cobrança", opcoes: () => Object.entries(ROTULO_FORMA).map(([valor, rotulo]) => ({ valor, rotulo })) },
    { valor: "pagadorResponsavel", rotulo: "Pagador responsável", opcoes: () => pagadores.map((p) => ({ valor: p.nome, rotulo: p.nome })) },
    { valor: "categoria", rotulo: "Categoria" },
  ], (campo) => {
    const conta = contas.find((c) => c.id === selecionadoId);
    return conta ? valorAtual(conta, campo) : "";
  });
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
    fecharEdicao();
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

// ---------- impressao formal ----------

const ROTULO_FILTRO: Record<Filtro, string> = {
  TODOS: "Todas as contas", AVENCER: "A vencer", HOJE: "Vencem hoje",
  ATRASADO: "Atrasadas", PAGO: "Pagas", NAPASTA: "Boleto na pasta",
};

async function imprimirLista(): Promise<void> {
  const lista = filtradas();
  await imprimirDocumento("Lista de contas", (folha) => {
    const pagina = criar("section", "folha__pagina");
    const filtroTxt = `Filtro: ${ROTULO_FILTRO[filtro]}${pesquisa ? ` · Pesquisa: "${pesquisa}"` : ""} · ${lista.length} conta(s)`;
    pagina.append(cabecalhoFolha("Relação de contas a pagar"), criar("p", "folha__nota", filtroTxt));
    const tabela = criar("table", "folha__lista");
    const cab = criar("tr");
    const colunas: [string, boolean][] = [["Vencimento", false], ["Empresa / fornecedor", false], ["Documento", false],
      ["Valor", true], ["Situação", false], ["Na pasta", false], ["Cobrança", false], ["Pagador", false]];
    for (const [t, num] of colunas) cab.appendChild(criar("th", num ? "folha__num" : "", t));
    const thead = criar("thead");
    thead.appendChild(cab);
    const corpo = criar("tbody");
    let total = 0;
    for (const c of lista) {
      total += Math.round(c.valor * 100);
      const tr = criar("tr");
      tr.append(
        criar("td", "", formatarDataBR(c.vencimento)),
        criar("td", "", c.nomeEmpresa),
        criar("td", "", c.numeroDocumento ?? "—"),
        criar("td", "folha__num", formatarMoedaBR(Math.round(c.valor * 100))),
        criar("td", "", statusDerivado(c).rotulo),
        criar("td", "", c.boletoNaPasta ? "Sim" : "Não"),
        criar("td", "", ROTULO_FORMA[c.formaPagamento] ?? c.formaPagamento),
        criar("td", "", c.pagadorResponsavel),
      );
      corpo.appendChild(tr);
    }
    const rodape = criar("tfoot");
    const trTotal = criar("tr");
    const rotuloTotal = criar("td", "", "Total");
    rotuloTotal.colSpan = 3;
    const vazio = criar("td");
    vazio.colSpan = 4;
    trTotal.append(rotuloTotal, criar("td", "folha__num", formatarMoedaBR(total)), vazio);
    rodape.appendChild(trTotal);
    tabela.append(thead, corpo, rodape);
    pagina.appendChild(tabela);
    folha.appendChild(pagina);
  });
}

function bytesParaBase64(bytes: Uint8Array): string {
  let binario = "";
  for (let k = 0; k < bytes.length; k += 0x8000) binario += String.fromCharCode(...bytes.subarray(k, k + 0x8000));
  return btoa(binario);
}


async function imprimirConta(conta: ContaDados): Promise<void> {
  // nota fiscal: PDF vira as paginas seguintes (juntada pelo processo principal);
  // foto entra como imagem na pagina 2; Word nao pode ser desenhado aqui
  let anexo: Uint8Array | null = null;
  const ext = (conta.anexoNome ?? "").split(".").pop()?.toLowerCase() ?? "";
  if (notaDisponivel(conta)) {
    try {
      anexo = await baixarAnexoConta(await window.finDesk!.config(), conta.id);
    } catch (erro) {
      console.error("[ContasAPagar] falha ao ler a nota para imprimir:", erro);
    }
  }
  const pagamento = pagamentos.find((p) => p.idConta === conta.id);
  const linhas: [string, string][] = [
    ["Empresa / fornecedor", conta.nomeEmpresa],
    ["Empresa emissora (cadastro)", conta.razaoSocial ?? "—"],
    ["Número do documento", conta.numeroDocumento ?? "—"],
    ["Vencimento", formatarDataBR(conta.vencimento)],
    ["Valor", formatarMoedaBR(Math.round(conta.valor * 100))],
    ["Categoria", conta.categoria ?? "—"],
    ["Tipo de conta", conta.tipoPessoa === "PF" ? "Pessoa física (PF)" : "Pessoa jurídica (PJ)"],
    ["Documento de cobrança", ROTULO_FORMA[conta.formaPagamento] ?? conta.formaPagamento],
    ["Pagador responsável", conta.pagadorResponsavel],
    ["Boleto na pasta", conta.boletoNaPasta ? "Sim" : "Não"],
    ["Situação", statusDerivado(conta).rotulo],
    ["Pagamento", pagamento
      ? `${formatarDataBR(pagamento.dataPagamento)} — ${formatarMoedaBR(Math.round(pagamento.valorPago * 100))}`
      : "Sem pagamento registrado"],
    ["Nota fiscal", textoNota(conta)],
  ];
  const ehPdf = ext === "pdf";
  const imagem = anexo && MIME_IMAGEM[ext] ? `data:${MIME_IMAGEM[ext]};base64,${bytesParaBase64(anexo)}` : null;
  const juntou = await imprimirDocumento(`Conta ${conta.nomeEmpresa}`, (folha) => {
    const p1 = criar("section", "folha__pagina");
    p1.append(cabecalhoFolha("Ficha de conta a pagar"), tabelaCampos(linhas));
    if (notaDisponivel(conta) && !ehPdf && !imagem) {
      p1.appendChild(criar("p", "folha__nota", `A nota fiscal "${conta.anexoNome}" está em formato Word: use BAIXAR NOTA e imprima pelo Word.`));
    } else if (ehPdf && anexo) {
      p1.appendChild(criar("p", "folha__nota", "A nota fiscal anexada segue nas próximas páginas."));
    }
    p1.appendChild(assinaturas(["Conferido por", "Autorizado por", "Data"]));
    folha.appendChild(p1);
    if (imagem) {
      const p2 = criar("section", "folha__pagina");
      p2.appendChild(cabecalhoFolha(`Nota fiscal — ${conta.nomeEmpresa}`));
      const img = criar("img", "folha__imagem");
      img.alt = "Nota fiscal anexada";
      img.src = imagem;
      p2.appendChild(img);
      folha.appendChild(p2);
    }
  }, { retrato: true, anexoPdf: ehPdf && anexo ? anexo : undefined });
  if (ehPdf && anexo && !juntou) {
    notificar("A nota fiscal em PDF não pôde ser juntada (arquivo protegido). Use BAIXAR NOTA para imprimi-la.", "info");
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

  ligarExpansaoColunas(el("billsTable"), el("btnExpandirColunas"));
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

  el("btnClearSelection").addEventListener("click", fecharEdicao);
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
  // "Alterar um campo": texto com mascara ou caixa de selecao, conforme o campo
  editor = montarEditor();
  // nota fiscal anexada: salva em Downloads (sem dialogo nativo) e oferece ABRIR
  el("btnImprimirLista").addEventListener("click", () => void imprimirLista());
  el("btnImprimirConta").addEventListener("click", () => {
    const conta = contas.find((c) => c.id === selecionadoId);
    if (conta) void imprimirConta(conta);
  });
  el("btnBaixarAnexo").addEventListener("click", () => {
    const conta = contas.find((c) => c.id === selecionadoId);
    if (conta && notaDisponivel(conta)) void salvarNotaNoComputador(conta);
  });
  // nota fiscal mostrada abaixo da edicao: clique (ou Enter/Espaco) = imprimir ou salvar
  const visualizacao = el("notaVisualizacao");
  visualizacao.addEventListener("click", () => void acaoNota());
  visualizacao.addEventListener("keydown", (evento) => {
    if (evento.key !== "Enter" && evento.key !== " ") return;
    evento.preventDefault();
    void acaoNota();
  });
  const inputNota = el<HTMLInputElement>("inputNovaNota");
  el("btnTrocarNota").addEventListener("click", () => inputNota.click());
  el("btnAnexarNotaVazia").addEventListener("click", () => inputNota.click());
  inputNota.addEventListener("change", () => {
    const arquivo = inputNota.files?.[0];
    inputNota.value = "";
    void trocarNota(arquivo);
  });
  el("btnExcluirNota").addEventListener("click", () => void excluirNota());

  void verificarApi();
  void recarregar();
  console.info("[ContasAPagar] tela todas as contas iniciada");
}

export function iniciarTodasAsContas(): void {
  iniciar();
}
