import { buscarStatus } from "../api";
import { Tela, irPara } from "../navegacao";
import { registrarAtalhos, respostaProvisoria } from "../componentes";
import { montarNavbar } from "../navbar";
import { BotaoSubmenu, ConfigSubmenu } from "../submenus-config";

function cartaoHtml(botao: BotaoSubmenu): string {
  const traco = botao.traco ?? "2.5";
  return `<a class="submenu-cartao group relative flex flex-col border-4 border-[#1c1b1b] shadow-[8px_8px_0_0_#1c1b1b] hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[12px_12px_0_0_#1c1b1b] active:translate-x-1 active:translate-y-1 active:shadow-[2px_2px_0_0_#1c1b1b] transition-all cursor-pointer no-underline overflow-hidden select-none" data-modulo="${botao.chave}" href="#">
<div class="submenu-cartao__area ${botao.cor} flex items-center justify-center relative">
<div class="w-24 h-24 sm:w-28 sm:h-28 bg-white border-4 border-[#1c1b1b] shadow-[4px_4px_0_0_#1c1b1b] flex items-center justify-center group-hover:scale-105 transition-transform duration-200">
<svg class="w-12 h-12 sm:w-14 sm:h-14 text-[#1c1b1b]" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="${traco}" viewBox="0 0 24 24">${botao.icone}</svg>
</div>
</div>
<div class="submenu-cartao__descricao border-t-4 border-[#1c1b1b] bg-white px-5 sm:px-6 py-3 flex items-center justify-between">
<span class="font-headline font-bold text-lg sm:text-xl leading-tight tracking-wider text-[#1c1b1b] uppercase">${botao.rotulo}</span>
<div class="w-8 h-8 sm:w-9 sm:h-9 ${botao.cor} border-2 border-[#1c1b1b] shadow-[2px_2px_0_0_#1c1b1b] flex items-center justify-center shrink-0 ml-2">
<span class="material-symbols-outlined text-base sm:text-lg ${botao.seloTexto} font-bold">${botao.selo}</span>
</div>
</div>
</a>`;
}

function acionarBotao(botao: BotaoSubmenu): void {
  console.info(`[ContasAPagar] opção "${botao.rotulo}" acionada`);
  if (botao.destino) {
    void irPara(botao.destino);
    return;
  }
  respostaProvisoria(botao.rotulo, "Opção");
}

function registrarOpcoes(config: ConfigSubmenu): void {
  const porChave = new Map(config.botoes.map((b) => [b.chave, b]));
  document.querySelectorAll<HTMLAnchorElement>("a[data-modulo]").forEach((ancora) => {
    ancora.addEventListener("click", (evento) => {
      evento.preventDefault();
      const botao = porChave.get(ancora.dataset.modulo ?? "");
      if (botao) acionarBotao(botao);
    });
  });
}

function registrarAtalhosSubmenu(config: ConfigSubmenu): void {
  const mapa: Record<string, () => void> = {};
  config.botoes.forEach((botao, indice) => {
    mapa[String(indice + 1)] = () => acionarBotao(botao);
  });
  registrarAtalhos(mapa);
}

async function verificarApi(): Promise<void> {
  try {
    if (!window.finDesk) {
      throw new Error("configuração indisponível");
    }
    const cfg = await window.finDesk.config();
    const status = await buscarStatus(cfg);
    document.body.dataset.apiStatus = "ok";
    console.info("[ContasAPagar] API:", status);
  } catch (erro) {
    document.body.dataset.apiStatus = "erro";
    console.warn("[ContasAPagar] sonda de API nao concluida (navegacao ou indisponibilidade):", erro instanceof Error ? erro.message : erro);
  }
}

export function iniciarSubmenu(tela: Tela, config: ConfigSubmenu): void {
  document.body.dataset.botoes = String(config.botoes.length);
  const grade = document.querySelector(".submenu-grade");
  if (grade) {
    grade.innerHTML = config.botoes.map((botao) => cartaoHtml(botao)).join("");
  }
  montarNavbar(tela);
  registrarOpcoes(config);
  registrarAtalhosSubmenu(config);
  console.info(`[ContasAPagar] submenu "${tela}" (${config.botoes.length} opções) iniciado`);
  void verificarApi();
}
