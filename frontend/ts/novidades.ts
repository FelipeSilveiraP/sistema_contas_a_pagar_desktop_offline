// O QUE MUDOU (pedido do usuario, 2026-11-23): depois de uma atualizacao, o Menu mostra um
// pop-up grande com o que foi feito desde a ultima vez que a pessoa viu (a lista vem dos
// commits, montada em desktop/novidades.js). ENTENDI marca como visto; so aparece de novo na
// proxima atualizacao. Arquivo IGUAL nos dois sistemas.
import { escolher } from "./dialogos";

function diaMes(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

/** Mostra o pop-up se houver novidades. Resolve quando a pessoa fecha (ou na hora, se nada). */
export async function mostrarNovidades(): Promise<void> {
  const n = await window.finDesk?.novidades?.().catch(() => null);
  if (!n || !n.itens.length) return;
  document.body.dataset.novidades = n.versao;
  const itens = n.itens.map((i) => `${diaMes(i.data)} · ${i.tipo}: ${i.texto}`);
  if (n.restantes > 0) itens.push(`... e mais ${n.restantes} mudanças mais antigas.`);
  await escolher({
    grande: true,
    titulo: `O QUE MUDOU · VERSÃO ${n.versao}`,
    mensagem: "O sistema foi atualizado. Isto é o que foi feito desde a última vez (do mais novo para o mais antigo):",
    itens,
    tom: "normal",
    icone: "new_releases",
    textoConfirmar: "ENTENDI",
    semCancelar: true,
  });
  await window.finDesk?.marcarNovidadesVistas?.().catch(() => false);
  delete document.body.dataset.novidades;
}
