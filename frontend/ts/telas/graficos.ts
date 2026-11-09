import { buscarStatus, buscarResumo, ResumoDashboard } from "../api";
import { montarNavbar } from "../navbar";
import { formatarMoedaBR } from "../mascaras";

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
  if (periodo === "trimestre") {
    const inicio = new Date(ano, mes - 2, 1);
    const fim = new Date(ano, mes + 1, 0);
    return { de: inicio.toISOString().split("T")[0], ate: fim.toISOString().split("T")[0] };
  }
  const fim = new Date(ano, mes + 1, 0);
  return { de: new Date(ano, mes, 1).toISOString().split("T")[0], ate: fim.toISOString().split("T")[0] };
}

function moeda(centavos: number): string {
  return formatarMoedaBR(centavos);
}

function renderKpis(resumo: ResumoDashboard): void {
  el("kpiPago").textContent = moeda(resumo.totalPagoCentavos);
  el("kpiVencer").textContent = moeda(resumo.aVencerCentavos);
  el("kpiVencidas").textContent = moeda(resumo.vencidasCentavos);
  el("kpiPagoSub").textContent = "TOTAL QUITADO NO PERÍODO";
  el("kpiVencerSub").textContent = "TÍTULOS PENDENTES A VENCER";
  el("kpiVencidasSub").textContent = "TÍTULOS PENDENTES EM ATRASO";
}

function renderMensal(resumo: ResumoDashboard): void {
  const area = el("graficoMensal");
  area.replaceChildren();
  const meses = resumo.porMes.slice(-6);
  if (meses.length === 0) {
    const vazio = document.createElement("p");
    vazio.className = "font-mono text-sm font-bold text-neutral-500 uppercase self-center";
    vazio.textContent = "Sem movimentação registrada no período.";
    area.appendChild(vazio);
    return;
  }
  const maximo = Math.max(...meses.map((m) => m.totalPagoCentavos), 1);
  for (const item of meses) {
    const coluna = document.createElement("div");
    coluna.className = "flex flex-col items-center gap-1 min-w-[3rem]";
    const valor = document.createElement("span");
    valor.className = "font-mono text-[10px] font-bold text-[#006c46]";
    valor.textContent = moeda(item.totalPagoCentavos).replace("R$ ", "");
    const barra = document.createElement("div");
    barra.className = "w-10 bg-[#00FF66] border-2 border-black shadow-[2px_2px_0px_0px_#000]";
    barra.style.height = `${Math.max(8, Math.round((item.totalPagoCentavos / maximo) * 140))}px`;
    const rotulo = document.createElement("span");
    rotulo.className = "font-mono text-[10px] font-bold uppercase";
    rotulo.textContent = item.mes;
    coluna.append(valor, barra, rotulo);
    area.appendChild(coluna);
  }
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
    const resumo = await buscarResumo(cfg, de, ate);
    renderKpis(resumo);
    renderMensal(resumo);
    renderCategorias(resumo);
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
  el("btn-imprimir").addEventListener("click", () => window.print());

  void verificarApi();
  void carregar();
  console.info("[ContasAPagar] tela de graficos iniciada (dados reais do SQLite)");
}

export function iniciarGraficos(): void {
  iniciar();
}
