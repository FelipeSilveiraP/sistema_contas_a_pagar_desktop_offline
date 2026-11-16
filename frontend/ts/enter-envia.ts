// Enter = botao de enviar/concluir, em QUALQUER formulario do sistema (pedido do usuario,
// 2026-11-16). Vale em campo de texto, numero, data, caixa de selecao e caixa de marcar:
// - dentro de um <form>: clica no botao de enviar VISIVEL (o mesmo que clicar nele, com
//   as mesmas conferencias da tela). Em formulario com etapas, enquanto o botao de
//   salvar esta escondido, vale o botao do data-enter-envia do form (ex.: PROXIMA);
// - fora de <form>: clica no botao indicado pelo bloco mais proximo marcado com
//   data-enter-envia="<seletor do botao>" (ex.: "APLICAR ALTERACAO" das tabelas).
// Nao muda: Shift/Ctrl/Alt+Enter, area de texto grande (Enter = nova linha), botoes e
// links (o Enter deles ja e o clique). Com um dialogo aberto, o fundo fica inerte
// (dialogos.ts) e nao recebe teclas.

const TIPOS_SEM_ENVIO = new Set(["button", "submit", "reset", "file", "image", "hidden", "color", "range"]);

/** Campo em que o Enter deve enviar (ou null quando o Enter tem outro papel ali). */
function campoQueEnvia(alvo: EventTarget | null): HTMLInputElement | HTMLSelectElement | null {
  if (alvo instanceof HTMLSelectElement) return alvo;
  if (alvo instanceof HTMLInputElement && !TIPOS_SEM_ENVIO.has(alvo.type)) return alvo;
  return null;
}

function usavel(botao: HTMLButtonElement | null): botao is HTMLButtonElement {
  return !!botao && !botao.disabled && botao.isConnected && botao.getClientRects().length > 0;
}

/**
 * O que o Enter faz neste campo: enviar o formulario, clicar num botao, ou nada.
 * Exportado para os testes (desktop/teste-enter.js).
 */
export function acaoDoEnter(campo: HTMLInputElement | HTMLSelectElement): { form: HTMLFormElement } | { botao: HTMLButtonElement } | null {
  if (campo.disabled) return null;
  const form = campo.form;
  if (form) {
    const enviar = [...form.querySelectorAll<HTMLButtonElement>("button[type='submit'], button:not([type])")].find(usavel);
    if (enviar) return { form };
    // etapa intermediaria (salvar escondido): o botao indicado no form, ex.: PROXIMA
    const proximo = form.dataset.enterEnvia ? form.querySelector<HTMLButtonElement>(form.dataset.enterEnvia) : null;
    return usavel(proximo) ? { botao: proximo } : null;
  }
  const zona = campo.closest<HTMLElement>("[data-enter-envia]");
  if (!zona) return null;
  const seletor = zona.dataset.enterEnvia || "button";
  const botao = zona.querySelector<HTMLButtonElement>(seletor) ?? document.querySelector<HTMLButtonElement>(seletor);
  return usavel(botao) ? { botao } : null;
}

export function ligarEnterEnvia(raiz: Document = document): void {
  raiz.addEventListener("keydown", (evento) => {
    if (evento.key !== "Enter" || evento.defaultPrevented || evento.isComposing) return;
    if (evento.shiftKey || evento.ctrlKey || evento.altKey || evento.metaKey) return;
    const campo = campoQueEnvia(evento.target);
    if (!campo) return;
    const acao = acaoDoEnter(campo);
    if (!acao) return;
    evento.preventDefault();
    if ("form" in acao) {
      // requestSubmit com o botao visivel: dispara o "submit" da tela (com as validacoes),
      // igual a clicar no botao
      const enviar = [...acao.form.querySelectorAll<HTMLButtonElement>("button[type='submit'], button:not([type])")].find(usavel);
      acao.form.requestSubmit(enviar);
    } else {
      acao.botao.click();
    }
  });
}
