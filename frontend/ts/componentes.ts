// Componentes transversais: atalhos + confirmacoes + notificacoes.
// window.alert/window.confirm/window.prompt sao PROIBIDOS (causavam o bug de foco
// dos inputs no Electron/Windows). Decisao -> confirmar*() de ./dialogos;
// resultado de acao -> notificar() de ./notificacoes; erro de campo -> inline.
import { dialogoEstaAberto } from "./dialogos";
import { notificar } from "./notificacoes";

export {
  confirmar,
  confirmarSaida,
  confirmarExclusao,
  confirmarEstorno,
  confirmarDuplicidade,
  dialogoEstaAberto,
} from "./dialogos";

export function respostaProvisoria(nome: string, tipo = "Módulo"): void {
  notificar(`${tipo} ${nome}: esta função ainda não está disponível.`, "info");
}

export function menuLateralAberto(): boolean {
  return document.getElementById("nav-global")?.dataset.menuAberto === "true";
}

export function registrarAtalhos(mapa: Record<string, () => void>): void {
  document.addEventListener("keydown", (evento) => {
    if (dialogoEstaAberto()) return;
    const acao = mapa[evento.key];
    if (!acao) return;
    evento.preventDefault();
    acao();
  });
}
