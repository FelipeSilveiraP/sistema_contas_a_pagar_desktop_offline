// Area de edicao padrao (mesmo desenho em Contas, Pagos, Recorrentes, Mensagens e
// Cadastros): cabecalho amarelo + resumo + ACOES + "Alterar um campo".
// Este modulo cuida do "Alterar um campo": monta a lista de campos, mostra caixa
// de TEXTO (com mascara) ou caixa de SELECAO conforme o campo, ou um painel proprio
// (ex.: telefones da empresa), e o DESFAZER volta ao valor gravado.
// IDs esperados no HTML: fieldSelect, newValueInput, newValueSelect, btnCancelEdit
// e o <p data-erro-campo="edicao">.
import { MASCARAS, mascaraDinamica } from "./mascaras";

export interface Opcao {
  valor: string;
  rotulo: string;
}

export interface CampoEditavel {
  valor: string;
  rotulo: string;
  mascara?: keyof typeof MASCARAS;
  /** lista fechada: aparece como caixa de selecao */
  opcoes?: () => Opcao[];
  /** painel proprio no lugar do "novo valor" (ex.: lista de telefones) */
  painel?: HTMLElement;
}

export interface EditorCampo {
  campo: () => string;
  ler: () => string;
  /** recarrega o "novo valor" com o valor gravado do campo escolhido */
  atualizar: () => void;
  /** refaz a lista de campos (quando ela depende do tipo de registro) */
  recarregarCampos: () => void;
  erro: (mensagem?: string) => void;
}

function porId<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

export function criarEditorCampo(
  camposOuFuncao: CampoEditavel[] | (() => CampoEditavel[]),
  valorAtual: (campo: string) => string,
  aoMudar?: (campo: string) => void,
): EditorCampo {
  const seletor = porId<HTMLSelectElement>("fieldSelect");
  const input = porId<HTMLInputElement>("newValueInput");
  const escolha = porId<HTMLSelectElement>("newValueSelect");
  const erroEl = document.querySelector<HTMLElement>('[data-erro-campo="edicao"]');

  let campos: CampoEditavel[] = [];
  const recarregarCampos = (): void => {
    const anterior = seletor.value;
    for (const c of campos) c.painel?.classList.add("hidden");
    campos = typeof camposOuFuncao === "function" ? camposOuFuncao() : camposOuFuncao;
    seletor.replaceChildren(...campos.map((c) => {
      const o = document.createElement("option");
      o.value = c.valor;
      o.textContent = c.rotulo;
      return o;
    }));
    if (campos.some((c) => c.valor === anterior)) seletor.value = anterior;
  };
  recarregarCampos();

  const atual = (): CampoEditavel | undefined => campos.find((c) => c.valor === seletor.value);
  mascaraDinamica(input, () => atual()?.mascara ?? null);

  const erro = (mensagem?: string): void => {
    if (!erroEl) return;
    erroEl.textContent = mensagem ?? "";
    erroEl.classList.toggle("hidden", !mensagem);
  };

  const atualizar = (): void => {
    const c = atual();
    if (!c) return;
    const gravado = valorAtual(c.valor);
    for (const outro of campos) outro.painel?.classList.add("hidden");
    const usaLista = Boolean(c.opcoes);
    input.classList.toggle("hidden", usaLista || Boolean(c.painel));
    escolha.classList.toggle("hidden", !usaLista || Boolean(c.painel));
    c.painel?.classList.remove("hidden");
    if (c.opcoes) {
      const lista = c.opcoes();
      if (gravado && !lista.some((o) => o.valor.toLowerCase() === gravado.toLowerCase())) {
        lista.push({ valor: gravado, rotulo: `${gravado} (não cadastrado)` });
      }
      escolha.replaceChildren(...lista.map((o) => {
        const op = document.createElement("option");
        op.value = o.valor;
        op.textContent = o.rotulo;
        return op;
      }));
      escolha.value = lista.find((o) => o.valor.toLowerCase() === gravado.toLowerCase())?.valor ?? lista[0]?.valor ?? "";
    } else {
      input.value = gravado;
      input.inputMode = c.mascara ? "numeric" : "text";
      if (c.mascara === "cnpj") input.inputMode = "text";
    }
    erro();
    aoMudar?.(c.valor);
  };

  seletor.addEventListener("change", atualizar);
  porId("btnCancelEdit").addEventListener("click", atualizar);

  return {
    campo: () => seletor.value,
    ler: () => (atual()?.opcoes ? escolha.value : input.value).trim(),
    atualizar,
    recarregarCampos,
    erro,
  };
}
