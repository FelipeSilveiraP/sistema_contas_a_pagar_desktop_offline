export function respostaProvisoria(nome: string, tipo = "Módulo"): void {
  window.alert(`${tipo} ${nome}\n\nDisponível nas próximas fases do FinDesk.`);
}

export function registrarAtalhos(mapa: Record<string, () => void>): void {
  document.addEventListener("keydown", (evento) => {
    const acao = mapa[evento.key];
    if (!acao) return;
    evento.preventDefault();
    acao();
  });
}
