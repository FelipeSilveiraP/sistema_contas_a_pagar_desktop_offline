// Componentes transversais: atalhos + dialogs neobrutalistas.
// window.alert/window.confirm sao PROIBIDOS nos fluxos do aplicativo — usar
// confirmar()/aviso()/sucesso()/erro()/informacao() do ./dialogos (API
// assincrona que devolve a escolha do usuario, com foco gerenciado e sem o
// defeito de perda de foco dos dialogs modais nativos do Electron/Windows).
import { aviso, dialogoEstaAberto } from "./dialogos";

export {
  confirmar,
  confirmarExclusao,
  confirmarDuplicidade,
  aviso,
  sucesso,
  erro,
  informacao,
  recorrencia,
  dialogoEstaAberto,
} from "./dialogos";

export function respostaProvisoria(nome: string, tipo = "Módulo"): void {
  void aviso(`${tipo} ${nome}\n\nDisponível nas próximas fases do Sistema de Contas a Pagar — Chaveiro Universal.`);
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
