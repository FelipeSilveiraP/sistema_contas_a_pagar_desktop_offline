// Tabelas com muitas colunas: so as principais aparecem; o botao » no cabecalho
// mostra/esconde as demais (classe .col-extra; CSS em tailwind.input.css).
// A escolha fica guardada por tabela durante a sessao.

export function ligarExpansaoColunas(tabela: HTMLElement, botao: HTMLElement): void {
  const chave = `findesk:colunas:${tabela.id}`;
  const aplicar = (expandida: boolean): void => {
    tabela.classList.toggle("tabela-expandida", expandida);
    botao.setAttribute("aria-expanded", String(expandida));
    const texto = expandida ? "Esconder colunas extras" : "Mostrar mais colunas";
    botao.title = texto;
    const leitor = botao.querySelector(".sr-only");
    if (leitor) leitor.textContent = texto;
    try {
      sessionStorage.setItem(chave, expandida ? "1" : "0");
    } catch {
      // sem sessionStorage: so nao lembra a escolha
    }
  };
  let inicial = false;
  try {
    inicial = sessionStorage.getItem(chave) === "1";
  } catch {
    inicial = false;
  }
  aplicar(inicial);
  botao.addEventListener("click", (evento) => {
    evento.stopPropagation();
    aplicar(!tabela.classList.contains("tabela-expandida"));
  });
}
