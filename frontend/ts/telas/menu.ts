import { AlertaContaDados, AlertasDados, buscarAlertas, buscarStatus } from "../api";
import { formatarDataBR, formatarMoedaBR } from "../mascaras";
import { Tela, irPara } from "../navegacao";
import { respostaProvisoria } from "../componentes";

const MODULOS: Record<string, string> = {
  "inserir-conta": "INSERIR CONTA",
  "controle-de-contas": "CONTROLE",
  cadastros: "CADASTROS",
  "mensagens-e-avisos": "MENSAGENS",
  "graficos-e-relatorios": "GRÁFICOS",
};

const DESTINOS: Record<string, Tela> = {
  "inserir-conta": "inserir-conta",
  "controle-de-contas": "controle",
  cadastros: "cadastros",
  "mensagens-e-avisos": "mensagens",
  "graficos-e-relatorios": "graficos",
};

function acionarModulo(chave: string): void {
  const destino = DESTINOS[chave];
  if (destino) {
    void irPara(destino);
    return;
  }
  respostaProvisoria(MODULOS[chave] ?? chave);
}

function registrarBotoes(): void {
  document.querySelectorAll<HTMLAnchorElement>("a[data-path]").forEach((ancora) => {
    ancora.addEventListener("click", (evento) => {
      evento.preventDefault();
      const chave = ancora.dataset.path ?? "";
      const nome = MODULOS[chave] ?? chave;
      console.info(`[ContasAPagar] módulo "${nome}" acionado`);
      acionarModulo(chave);
    });
  });
  console.info(`[ContasAPagar] ${Object.keys(MODULOS).length} botões do menu registrados`);
}

function registrarAtalhos(): void {
  const atalhos: Record<string, string> = {
    F1: "inserir-conta",
    "1": "inserir-conta",
    F2: "controle-de-contas",
    "2": "controle-de-contas",
    F3: "mensagens-e-avisos",
    "3": "mensagens-e-avisos",
    F4: "graficos-e-relatorios",
    "4": "graficos-e-relatorios",
  };
  document.addEventListener("keydown", (evento) => {
    const alvo = atalhos[evento.key];
    if (!alvo) return;
    evento.preventDefault();
    document.querySelector<HTMLAnchorElement>(`a[data-path="${alvo}"]`)?.click();
  });
}

// ===== "Mensagens do dia": alertas reais (regra do VBA VerificarVencimentosAoAbrir) =====
// atrasadas de 1 a 15 dias + a vencer de hoje ate 10 dias + recados vigentes hoje.
const MAX_LINHAS = 4;
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

function celula(texto: string, classe: string, rotulo: string): HTMLTableCellElement {
  const td = document.createElement("td");
  td.className = classe;
  td.dataset.rotulo = rotulo;
  td.textContent = texto;
  return td;
}

function selo(texto: string, cores: string): HTMLSpanElement {
  const s = document.createElement("span");
  s.className = `inline-block border-2 border-[#1c1b1b] text-[11px] sm:text-xs font-bold uppercase px-2.5 py-0.5 ${cores}`;
  s.textContent = texto;
  return s;
}

function situacao(dias: number): { texto: string; cores: string; atrasada: boolean } {
  if (dias < 0) {
    const n = Math.abs(dias);
    return { texto: `Atrasada ${n} dia${n > 1 ? "s" : ""}`, cores: "bg-[#ffdad6] text-[#93000a]", atrasada: true };
  }
  if (dias === 0) return { texto: "Vence hoje", cores: "bg-[#FF5E89]/20 text-[#b6212a]", atrasada: false };
  return { texto: `Vence em ${dias} dia${dias > 1 ? "s" : ""}`, cores: "bg-[#FFE600]/30 text-[#6a5f00]", atrasada: false };
}

function linhaAlerta(conta: AlertaContaDados): HTMLTableRowElement {
  const s = situacao(conta.dias);
  const tr = document.createElement("tr");
  tr.className = s.atrasada ? "bg-[#fff1ef]" : "hover:bg-[#fff9d6] transition-colors";
  tr.dataset.alerta = s.atrasada ? "atrasada" : "a-vencer";
  tr.appendChild(celula(formatarDataBR(conta.vencimento), `p-2.5 sm:px-4 py-2 text-center font-mono ${s.atrasada ? "text-[#ba1a1a]" : "text-[#1c1b1b]"}`, "Vencimento"));
  tr.appendChild(celula(conta.nomeEmpresa, "p-2.5 sm:px-4 py-2", "Empresa"));
  tr.appendChild(celula(formatarMoedaBR(Math.round(conta.valor * 100)), "p-2.5 sm:px-4 py-2 text-right font-mono whitespace-nowrap", "Valor"));
  const pasta = celula("", "p-2.5 sm:px-4 py-2 text-center", "Na Pasta?");
  pasta.appendChild(conta.boletoNaPasta
    ? selo("Sim", "bg-[#00FF66]/20 text-[#006c46]")
    : selo("Não", "bg-[#e5e2e1] text-[#4b4731] border-[#cdc7aa]"));
  tr.appendChild(pasta);
  const status = celula("", "p-2.5 sm:px-4 py-2 text-center", "Status");
  status.appendChild(selo(s.texto, s.cores));
  tr.appendChild(status);
  return tr;
}

function linhaUnica(texto: string, classe: string): HTMLTableRowElement {
  const tr = document.createElement("tr");
  const td = document.createElement("td");
  td.colSpan = 5;
  td.className = classe;
  td.textContent = texto;
  tr.appendChild(td);
  return tr;
}

function renderAlertas(dados: AlertasDados): void {
  const [ano, mes, dia] = dados.hoje.split("-").map(Number);
  const hoje = document.getElementById("alertas-hoje");
  if (hoje) hoje.textContent = `Hoje: ${dia} de ${MESES[mes - 1]} de ${ano}`;

  const corpo = document.getElementById("alertas-corpo");
  if (!corpo) return;
  const todas = [...dados.atrasados, ...dados.aVencer];
  const linhas = todas.slice(0, MAX_LINHAS).map(linhaAlerta);
  if (!todas.length) {
    linhas.push(linhaUnica("Tudo em dia! Nenhuma conta atrasada ou vencendo nos próximos 10 dias.", "p-3 text-center text-[#006c46] uppercase"));
  } else if (todas.length > MAX_LINHAS) {
    const resto = todas.length - MAX_LINHAS;
    linhas.push(linhaUnica(`+ ${resto} conta${resto > 1 ? "s" : ""} — veja todas em CONTROLE › TODAS AS CONTAS`, "p-2 text-center font-mono text-xs text-neutral-600 uppercase"));
  }
  corpo.replaceChildren(...linhas);

  const rodape = document.getElementById("alertas-rodape");
  if (rodape) {
    const partes: string[] = [];
    if (dados.atrasados.length) partes.push(`${dados.atrasados.length} atrasada${dados.atrasados.length > 1 ? "s" : ""}`);
    if (dados.aVencer.length) partes.push(`${dados.aVencer.length} a vencer`);
    const recados = dados.avisosHoje.map((a) => `${a.titulo}: ${a.mensagem}`).join("  •  ");
    rodape.textContent = recados
      ? `Recados de hoje — ${recados}`
      : partes.length ? `Contas: ${partes.join(" e ")}. Nenhum recado para hoje.` : "Nenhum recado para hoje.";
    rodape.title = rodape.textContent;
    rodape.classList.add("truncate");
  }
  document.body.dataset.alertas = String(todas.length);
}

function erroAlertas(): void {
  const corpo = document.getElementById("alertas-corpo");
  corpo?.replaceChildren(linhaUnica("Não foi possível carregar as contas do dia. Abra CONTROLE para conferir.", "p-3 text-center text-[#ba1a1a] uppercase"));
}

async function iniciar(): Promise<void> {
  try {
    if (!window.finDesk) {
      throw new Error("configuração indisponível");
    }
    const cfg = await window.finDesk.config();
    const status = await buscarStatus(cfg);
    document.body.dataset.apiStatus = "ok";
    document.title += " - API OK";
    console.info("[ContasAPagar] API:", status);
    try {
      renderAlertas(await buscarAlertas(cfg));
    } catch (erro) {
      erroAlertas();
      console.warn("[ContasAPagar] alertas indisponiveis:", erro instanceof Error ? erro.message : erro);
    }
  } catch (erro) {
    document.body.dataset.apiStatus = "erro";
    document.title += " - API OFFLINE";
    erroAlertas();
    console.warn("[ContasAPagar] sonda de API nao concluida (navegacao ou indisponibilidade):", erro instanceof Error ? erro.message : erro);
  }
}

export function iniciarMenu(): void {
  registrarBotoes();
  registrarAtalhos();
  void iniciar();
}
