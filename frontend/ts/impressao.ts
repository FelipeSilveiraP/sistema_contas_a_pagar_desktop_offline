// Impressao de relatorios (Graficos, lista de contas): o processo principal gera
// um PDF da tela atual em Downloads e o abre no leitor padrao, onde o usuario
// imprime. Sem window.print(): a janela nativa de impressao e modal e causava
// o bug de foco dos inputs no Electron/Windows.
import { notificar } from "./notificacoes";

export async function imprimirRelatorio(nome: string): Promise<void> {
  try {
    const r = await window.finDesk!.imprimirPdf(nome);
    if (!r.ok || !r.caminho) throw new Error("falha ao gerar o PDF");
    const caminho = r.caminho;
    document.body.dataset.relatorioPdf = caminho;
    notificar("Relatório aberto em PDF para imprimir.", "sucesso", {
      rotulo: "Abrir",
      aoClicar: () => void window.finDesk!.abrirArquivo(caminho),
    });
  } catch {
    notificar("Não foi possível gerar o relatório. Tente de novo.", "erro");
  }
}
