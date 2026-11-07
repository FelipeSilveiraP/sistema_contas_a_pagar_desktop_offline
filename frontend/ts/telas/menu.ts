import { buscarStatus, buscarContas } from "../api";
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
  "controle-de-contas": "controle",
  cadastros: "cadastros",
  "mensagens-e-avisos": "mensagens",
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
      console.info(`[FinDesk] módulo "${nome}" acionado`);
      acionarModulo(chave);
    });
  });
  console.info(`[FinDesk] ${Object.keys(MODULOS).length} botões do menu registrados`);
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

async function iniciar(): Promise<void> {
  try {
    if (!window.finDesk) {
      throw new Error("configuração indisponível");
    }
    const cfg = await window.finDesk.config();
    const status = await buscarStatus(cfg);
    const contas = await buscarContas(cfg);
    document.body.dataset.apiStatus = "ok";
    document.title += " - API OK";
    console.info("[FinDesk] API:", status, "| contas de teste:", contas.length);
  } catch (erro) {
    document.body.dataset.apiStatus = "erro";
    document.title += " - API OFFLINE";
    console.error("[FinDesk] falha na API:", erro);
  }
}

export function iniciarMenu(): void {
  registrarBotoes();
  registrarAtalhos();
  void iniciar();
}
