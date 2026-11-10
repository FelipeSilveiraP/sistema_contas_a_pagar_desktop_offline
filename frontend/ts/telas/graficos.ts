import { buscarStatus, buscarResumo, ResumoDashboard } from "../api";
import { montarNavbar } from "../navbar";
import { formatarMoedaBR } from "../mascaras";
import { isoLocal } from "../filtros";
import { imprimirRelatorio } from "../impressao";

let periodo: "mes" | "trimestre" | "ano" = "mes";

function el<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

function limites(): { de: string; ate: string } {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = hoje.getMonth();
  if (periodo === "ano") {
    return { de: `${ano}-01-01`, ate: `${ano}-12-31` };
  }
  const inicio = periodo === "trimestre" ? new Date(ano, mes - 2, 1) : new Date(ano, mes, 1);
  return { de: isoLocal(inicio), ate: isoLocal(new Date(ano, mes + 1, 0)) };
}

/** Os 6 meses ate o mes atual (o fluxo mensal nao depende do periodo escolhido). */
function seisMeses(): { de: string; ate: string; meses: string[] } {
  const hoje = new Date();
  const meses: string[] = [];
  for (let i = 5; i >= 0; i--) meses.push(isoLocal(new Date(hoje.getFullYear(), hoje.getMonth() - i, 1)).slice(0, 7));
  return { de: `${meses[0]}-01`, ate: isoLocal(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)), meses };
}

const NOMES_MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function moeda(centavos: number): string {
  return formatarMoedaBR(centavos);
}

function plural(n: number, singular: string, pluralTexto: string): string {
  return `${n} ${n === 1 ? singular : pluralTexto}`;
}

function renderKpis(resumo: ResumoDashboard): void {
  el("kpiPago").textContent = moeda(resumo.totalPagoCentavos);
  el("kpiVencer").textContent = moeda(resumo.aVencerCentavos);
  el("kpiVencidas").textContent = moeda(resumo.vencidasCentavos);
  el("kpiPagoSub").textContent = `${plural(resumo.quantidadePagas, "conta paga", "contas pagas")} no período`;
  el("kpiVencerSub").textContent = `${plural(resumo.quantidadePendentes, "conta pendente", "contas pendentes")} no período`;
  el("kpiVencidasSub").textContent = "Títulos pendentes com vencimento já passado";
}

function barra(centavos: number, maximo: number, cor: string, rotulo: string): HTMLDivElement {
  const b = document.createElement("div");
  b.className = `w-5 ${cor} border-2 border-black`;
  b.style.height = `${centavos > 0 ? Math.max(6, Math.round((centavos / maximo) * 120)) : 2}px`;
  b.title = `${rotulo}: ${moeda(centavos)}`;
  return b;
}

function renderMensal(fluxo: ResumoDashboard, meses: string[]): void {
  const area = el("graficoMensal");
  area.replaceChildren();
  const porMes = new Map(fluxo.porMes.map((m) => [m.mes, m]));
  const dados = meses.map((mes) => porMes.get(mes) ?? { mes, totalPagoCentavos: 0, totalPendenteCentavos: 0 });
  const maximo = Math.max(...dados.map((m) => Math.max(m.totalPagoCentavos, m.totalPendenteCentavos)), 1);
  if (dados.every((m) => m.totalPagoCentavos === 0 && m.totalPendenteCentavos === 0)) {
    const vazio = document.createElement("p");
    vazio.className = "font-mono text-sm font-bold text-neutral-500 uppercase self-center";
    vazio.textContent = "Sem contas nos últimos 6 meses.";
    area.appendChild(vazio);
    return;
  }
  for (const item of dados) {
    const coluna = document.createElement("div");
    coluna.className = "flex flex-col items-center gap-1 min-w-[3rem] flex-1";
    coluna.dataset.mes = item.mes;
    const barras = document.createElement("div");
    barras.className = "flex items-end gap-1";
    barras.append(
      barra(item.totalPagoCentavos, maximo, "bg-[#00FF66]", "Pago"),
      barra(item.totalPendenteCentavos, maximo, "bg-[#FFE600]", "Pendente"),
    );
    const rotulo = document.createElement("span");
    rotulo.className = "font-mono text-[10px] font-bold uppercase";
    const [a, m] = item.mes.split("-").map(Number);
    rotulo.textContent = `${NOMES_MES[m - 1]}/${String(a).slice(2)}`;
    coluna.append(barras, rotulo);
    area.appendChild(coluna);
  }
}

function renderFornecedores(resumo: ResumoDashboard): void {
  const lista = el("graficoFornecedores");
  lista.replaceChildren();
  if (!resumo.maioresFornecedores.length) {
    const vazio = document.createElement("li");
    vazio.className = "font-mono text-sm font-bold text-neutral-500 uppercase";
    vazio.textContent = "Nenhuma conta no período.";
    lista.appendChild(vazio);
    return;
  }
  resumo.maioresFornecedores.forEach((f, i) => {
    const li = document.createElement("li");
    li.className = "flex items-center gap-3 border-b-2 border-black/10 pb-2";
    const pos = document.createElement("span");
    pos.className = "w-7 h-7 shrink-0 flex items-center justify-center bg-[#00FF66] border-2 border-black font-mono text-xs font-bold";
    pos.textContent = String(i + 1);
    const nome = document.createElement("span");
    nome.className = "flex-1 min-w-0 font-bold text-sm uppercase truncate";
    nome.textContent = f.nomeEmpresa;
    nome.title = `${f.nomeEmpresa} — ${plural(f.quantidade, "conta", "contas")}`;
    const valor = document.createElement("span");
    valor.className = "shrink-0 font-mono text-xs font-bold";
    valor.textContent = moeda(f.totalCentavos);
    li.append(pos, nome, valor);
    lista.appendChild(li);
  });
}

function renderCategorias(resumo: ResumoDashboard): void {
  const area = el("graficoCategorias");
  area.replaceChildren();
  const categorias = resumo.porCategoria.slice(0, 8);
  if (categorias.length === 0) {
    const vazio = document.createElement("p");
    vazio.className = "font-mono text-sm font-bold text-neutral-500 uppercase";
    vazio.textContent = "Nenhuma categoria com lançamentos no período.";
    area.appendChild(vazio);
    return;
  }
  const maximo = Math.max(...categorias.map((c) => c.totalCentavos), 1);
  for (const item of categorias) {
    const linha = document.createElement("div");
    linha.className = "flex items-center gap-3";
    const nome = document.createElement("span");
    nome.className = "w-44 shrink-0 font-mono text-xs font-bold uppercase truncate";
    nome.textContent = item.categoria;
    const trilho = document.createElement("div");
    trilho.className = "flex-1 h-6 bg-white border-2 border-black";
    const barra = document.createElement("div");
    barra.className = "h-full bg-[#FFE600] border-r-2 border-black";
    barra.style.width = `${Math.max(4, Math.round((item.totalCentavos / maximo) * 100))}%`;
    trilho.appendChild(barra);
    const valor = document.createElement("span");
    valor.className = "w-28 shrink-0 font-mono text-xs font-bold text-right";
    valor.textContent = moeda(item.totalCentavos).replace("R$ ", "");
    linha.append(nome, trilho, valor);
    area.appendChild(linha);
  }
}

async function carregar(): Promise<void> {
  try {
    const cfg = await window.finDesk!.config();
    const { de, ate } = limites();
    const seis = seisMeses();
    const [resumo, fluxo] = await Promise.all([buscarResumo(cfg, de, ate), buscarResumo(cfg, seis.de, seis.ate)]);
    renderKpis(resumo);
    renderMensal(fluxo, seis.meses);
    renderCategorias(resumo);
    renderFornecedores(resumo);
    document.body.dataset.resumoCarregado = "true";
  } catch (erro) {
    console.error("[ContasAPagar] falha ao carregar o dashboard:", erro);
    document.body.dataset.resumoCarregado = "erro";
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
  montarNavbar("graficos");
  document.querySelectorAll<HTMLButtonElement>(".periodo-btn").forEach((botao) => {
    botao.addEventListener("click", () => {
      periodo = (botao.dataset.periodo ?? "mes") as "mes" | "trimestre" | "ano";
      document.querySelectorAll<HTMLButtonElement>(".periodo-btn").forEach((b) => {
        const ativo = b === botao;
        b.classList.toggle("bg-[#00FF66]", ativo);
        b.classList.toggle("border-2", ativo);
        b.classList.toggle("border-black", ativo);
        b.classList.toggle("shadow-[2px_2px_0px_0px_#000]", ativo);
        b.classList.toggle("bg-white", !ativo);
      });
      void carregar();
    });
  });
  // impressao sem a janela nativa (risco de bug de foco): gera PDF em Downloads e abre
  el("btn-imprimir").addEventListener("click", () => void imprimirRelatorio("Graficos"));

  void verificarApi();
  void carregar();
  console.info("[ContasAPagar] tela de graficos iniciada (dados reais do SQLite)");
}

export function iniciarGraficos(): void {
  iniciar();
}
