import {
  buscarStatus,
  listarAvisos,
  atualizarAviso,
  excluirAviso,
  AvisoDados,
  ErroValidacaoApi,
} from "../api";
import { confirmar } from "../componentes";
import { montarNavbar } from "../navbar";
import { formatarDataBR, parseDataBR } from "../mascaras";

let avisos: AvisoDados[] = [];
let pesquisa = "";
let filtro = "TODOS";
let ordenarCronologico = false;
let selecionadoId: number | null = null;

function el<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

function hoje(): string {
  return new Date().toISOString().split("T")[0];
}

function ativoEm(aviso: AvisoDados, data: string): boolean {
  if (data < aviso.dataInicio || data > aviso.dataFim) return false;
  if (aviso.diaSemana === "TODOS") return true;
  const codigo = ["DOMINGO", "SEGUNDA", "TERCA", "QUARTA", "QUINTA", "SEXTA", "SABADO"][new Date(data).getUTCDay()];
  return aviso.diaSemana.split(",").some((d) => d.trim() === codigo);
}

function filtrados(): AvisoDados[] {
  const termo = pesquisa.toLowerCase();
  const hojeStr = hoje();
  let lista = avisos.filter((a) => {
    if (termo && !`${a.titulo} ${a.mensagem}`.toLowerCase().includes(termo)) return false;
    if (filtro === "ATIVOS") return ativoEm(a, hojeStr);
    if (filtro === "EXPIRADOS") return !ativoEm(a, hojeStr) && a.dataFim < hojeStr;
    return true;
  });
  if (ordenarCronologico || filtro === "ORDEM") {
    lista = [...lista].sort((a, b) => a.dataInicio.localeCompare(b.dataInicio));
  }
  return lista;
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
  for (const aviso of filtrados()) {
    const tr = document.createElement("tr");
    tr.className = "bill-row cursor-pointer transition-colors hover:bg-[#fce7f3]";
    tr.dataset.id = String(aviso.id);
    if (selecionadoId === aviso.id) tr.classList.add("bg-[#FF5E89]", "border-l-8", "border-l-[#1c1b1b]");
    const ativo = ativoEm(aviso, hoje());
    const tdStatus = celula(ativo ? "ATIVO" : aviso.dataFim < hoje() ? "EXPIRADO" : "FORA DE VIGÊNCIA", "py-3.5 px-4 text-center whitespace-nowrap");
    tdStatus.textContent = "";
    const selo = document.createElement("span");
    selo.className = `inline-block rounded-full px-3 py-1 text-xs font-mono font-bold uppercase leading-none ${ativo ? "bg-[#006c46]/10 text-[#006c46]" : "bg-neutral-200 text-neutral-600"}`;
    selo.textContent = ativo ? "ATIVO" : aviso.dataFim < hoje() ? "EXPIRADO" : "INATIVO";
    tdStatus.appendChild(selo);
    const tdMsg = celula(aviso.mensagem, "py-3.5 px-4 text-xs text-neutral-700");
    tr.append(
      celula(formatarDataBR(aviso.dataInicio), "py-3.5 px-4 font-mono font-bold whitespace-nowrap"),
      celula(formatarDataBR(aviso.dataFim), "py-3.5 px-4 font-mono whitespace-nowrap"),
      celula(aviso.diaSemana, "py-3.5 px-4 font-mono text-xs whitespace-nowrap"),
      celula(aviso.titulo, "py-3.5 px-4"),
      tdMsg,
      tdStatus,
    );
    tr.addEventListener("click", () => selecionar(aviso.id));
    corpo.appendChild(tr);
  }
  el("tableSummaryCount").textContent = String(filtrados().length);
  el("selectionEmptyState").classList.toggle("hidden", filtrados().length > 0);
}

function valorAtual(aviso: AvisoDados, campo: string): string {
  switch (campo) {
    case "dataInicio": return formatarDataBR(aviso.dataInicio);
    case "dataFim": return formatarDataBR(aviso.dataFim);
    case "diaSemana": return aviso.diaSemana;
    case "mensagem": return aviso.mensagem;
    default: return aviso.titulo;
  }
}

function selecionar(id: number): void {
  selecionadoId = id;
  const aviso = avisos.find((a) => a.id === id);
  if (!aviso) return;
  el("editorContainer").classList.remove("hidden");
  el("editorRecordName").textContent = aviso.titulo;
  el<HTMLInputElement>("newValueInput").value = valorAtual(aviso, el<HTMLSelectElement>("fieldSelect").value);
  renderTabela();
}

function toast(mensagem: string): void {
  let t = document.getElementById("toast-mensagens");
  if (!t) {
    t = document.createElement("div");
    t.id = "toast-mensagens";
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
  avisos = await listarAvisos(cfg);
  renderTabela();
}

async function aplicarAlteracao(): Promise<void> {
  const aviso = avisos.find((a) => a.id === selecionadoId);
  if (!aviso) return;
  const campo = el<HTMLSelectElement>("fieldSelect").value;
  const bruto = el<HTMLInputElement>("newValueInput").value.trim();
  const patch = {
    dataInicio: aviso.dataInicio,
    dataFim: aviso.dataFim,
    diaSemana: aviso.diaSemana,
    titulo: aviso.titulo,
    mensagem: aviso.mensagem,
  };
  if (campo === "dataInicio" || campo === "dataFim") {
    const iso = parseDataBR(bruto);
    if (!iso) return mostrarErro("data invalida (use DD/MM/AAAA)");
    patch[campo] = iso;
  } else if (campo === "diaSemana") {
    const dias = bruto.toUpperCase().split(",").map((d) => d.trim());
    const validos = ["TODOS", "DOMINGO", "SEGUNDA", "TERCA", "QUARTA", "QUINTA", "SEXTA", "SABADO"];
    if (dias.some((d) => !validos.includes(d))) return mostrarErro("dias invalidos (ex.: SEGUNDA,QUARTA ou TODOS)");
    patch.diaSemana = dias.join(",");
  } else if (campo === "titulo") {
    if (bruto.length < 2 || bruto.length > 100) return mostrarErro("titulo deve ter 2 a 100 caracteres");
    patch.titulo = bruto;
  } else {
    if (bruto.length < 2 || bruto.length > 500) return mostrarErro("mensagem deve ter 2 a 500 caracteres");
    patch.mensagem = bruto;
  }
  if (patch.dataFim < patch.dataInicio) return mostrarErro("o fim deve ser igual ou posterior ao inicio");
  mostrarErro();
  try {
    const cfg = await window.finDesk!.config();
    await atualizarAviso(cfg, aviso.id, patch);
    await recarregar();
    toast("Mensagem atualizada.");
  } catch (erro) {
    if (erro instanceof ErroValidacaoApi) mostrarErro(Object.values(erro.campos)[0] ?? "dados invalidos");
    else {
      mostrarErro("nao foi possivel atualizar a mensagem");
      console.error("[ContasAPagar] falha na edicao da mensagem:", erro);
    }
  }
}

async function excluirSelecionado(): Promise<void> {
  const aviso = avisos.find((a) => a.id === selecionadoId);
  if (!aviso) return;
  if (!confirmar(`Excluir definitivamente a mensagem "${aviso.titulo}"?`)) return;
  try {
    const cfg = await window.finDesk!.config();
    await excluirAviso(cfg, aviso.id);
    selecionadoId = null;
    el("editorContainer").classList.add("hidden");
    await recarregar();
    toast("Mensagem excluída.");
  } catch (erro) {
    mostrarErro("nao foi possivel excluir a mensagem");
    console.error("[ContasAPagar] falha na exclusao da mensagem:", erro);
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
  montarNavbar("todas-as-mensagens");
  el("searchInput").addEventListener("input", () => {
    pesquisa = el<HTMLInputElement>("searchInput").value.trim();
    renderTabela();
  });
  document.querySelectorAll<HTMLButtonElement>(".filter-btn").forEach((botao) => {
    botao.addEventListener("click", () => {
      filtro = botao.dataset.filter ?? "TODOS";
      ordenarCronologico = filtro === "ORDEM";
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
  el("btnDeleteAction").addEventListener("click", () => void excluirSelecionado());
  el<HTMLSelectElement>("fieldSelect").addEventListener("change", () => {
    const aviso = avisos.find((a) => a.id === selecionadoId);
    if (aviso) el<HTMLInputElement>("newValueInput").value = valorAtual(aviso, el<HTMLSelectElement>("fieldSelect").value);
    mostrarErro();
  });

  void verificarApi();
  void recarregar();
  console.info("[ContasAPagar] tela todas as mensagens iniciada");
}

export function iniciarTodasAsMensagens(): void {
  iniciar();
}
