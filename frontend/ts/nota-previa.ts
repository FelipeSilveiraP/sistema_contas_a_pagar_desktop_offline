// Previa da nota fiscal (Inserir Conta e Todas as Contas): foto vira <img>,
// PDF vira o visualizador do Chromium (<embed> de um blob:) e Word vira um
// cartao com o nome, porque o navegador nao desenha .docx.
// O <embed> fica sem eventos de mouse/foco (CSS .nota-visualizacao__conteudo):
// o leitor de PDF nunca rouba o foco dos inputs (bug historico do Electron).
// A pagina precisa liberar na CSP: img-src blob:, frame-src blob:, object-src blob:
// e os 2 estilos internos do visualizador (ver docs/decisoes.md, 2026-11-13).

export const MIME_IMAGEM: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };

export function extensaoNota(nome: string | null | undefined): string {
  return (nome ?? "").split(".").pop()?.toLowerCase() ?? "";
}

/**
 * Desenha a nota dentro de `destino` (substitui o conteudo) e devolve a
 * funcao que libera a memoria do arquivo; chame-a antes de trocar a previa.
 */
export function montarPreviaNota(destino: HTMLElement, nome: string, bytes: Uint8Array, dicaWord: string): () => void {
  const ext = extensaoNota(nome);
  const mime = ext === "pdf" ? "application/pdf" : MIME_IMAGEM[ext] ?? "application/octet-stream";
  const url = URL.createObjectURL(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: mime }));
  destino.replaceChildren();
  if (ext === "pdf") {
    const quadro = document.createElement("embed");
    quadro.type = "application/pdf";
    quadro.title = `Nota fiscal ${nome}`;
    quadro.tabIndex = -1;
    quadro.src = `${url}#toolbar=0&navpanes=0&view=FitH`;
    destino.appendChild(quadro);
  } else if (MIME_IMAGEM[ext]) {
    const img = document.createElement("img");
    img.alt = `Nota fiscal ${nome}`;
    img.src = url;
    destino.appendChild(img);
  } else {
    const cartao = document.createElement("div");
    cartao.className = "nota-visualizacao__arquivo";
    const icone = document.createElement("span");
    icone.className = "material-symbols-outlined text-5xl";
    icone.textContent = "description";
    const titulo = document.createElement("span");
    titulo.textContent = nome;
    const dica = document.createElement("span");
    dica.className = "text-neutral-600";
    dica.textContent = dicaWord;
    cartao.append(icone, titulo, dica);
    destino.appendChild(cartao);
  }
  return () => {
    URL.revokeObjectURL(url);
    destino.replaceChildren();
  };
}
