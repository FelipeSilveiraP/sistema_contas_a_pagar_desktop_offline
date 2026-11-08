// Reparo de foco pos-dialogo modal nativo (alert/confirm): no Electron 33 /
// Windows, ao fechar esses dialogos a janela volta a ficar ATIVA sem que o
// widget do Chromium re-emit o ciclo de foco da PAGINA (document.hasFocus()
// fica falso); o teclado passa a ser engolido e os inputs morrem. O reparo e
// um ciclo blur->focus na janela executado pelo processo principal
// (findesk:reparar-foco) — o mesmo mecanismo que restaura o uso apos
// minimizar/restaurar. Chamada unica e dirigida por evento (sem timers).
function repararFocoPosDialogo(): void {
  window.focus();
  void window.finDesk?.repararFoco();
}

export function confirmar(mensagem: string): boolean {
  const resposta = window.confirm(mensagem);
  repararFocoPosDialogo();
  return resposta;
}

export function aviso(mensagem: string): void {
  window.alert(mensagem);
  repararFocoPosDialogo();
}

export function respostaProvisoria(nome: string, tipo = "Módulo"): void {
  aviso(`${tipo} ${nome}\n\nDisponível nas próximas fases do Sistema de Contas a Pagar — Chaveiro Universal.`);
}

export function registrarAtalhos(mapa: Record<string, () => void>): void {
  document.addEventListener("keydown", (evento) => {
    const acao = mapa[evento.key];
    if (!acao) return;
    evento.preventDefault();
    acao();
  });
}
