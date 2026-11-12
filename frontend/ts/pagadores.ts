// Caixa de selecao do pagador responsavel (pedido do usuario: escolher entre os
// pagadores cadastrados em vez de digitar). Um valor antigo digitado a mao (ex.:
// contas do legado) continua aparecendo como opcao para nao ser perdido na edicao.
import { listarPagadores } from "./api";

function opcao(valor: string, texto: string, desabilitada = false): HTMLOptionElement {
  const o = document.createElement("option");
  o.value = valor;
  o.textContent = texto;
  o.disabled = desabilitada;
  return o;
}

/** Preenche o <select> com os pagadores cadastrados. `primeira` = texto da opcao vazia. */
export async function preencherSelectPagadores(
  select: HTMLSelectElement,
  primeira: string,
  valorAtual = "",
): Promise<void> {
  const cfg = await window.finDesk!.config();
  const nomes = (await listarPagadores(cfg)).map((p) => p.nome);
  select.replaceChildren(opcao("", primeira));
  for (const nome of nomes) select.appendChild(opcao(nome, nome));
  if (valorAtual && !nomes.some((n) => n.toLowerCase() === valorAtual.toLowerCase())) {
    select.appendChild(opcao(valorAtual, `${valorAtual} (não cadastrado)`));
  }
  if (!nomes.length) {
    select.appendChild(opcao("", "Nenhum pagador cadastrado — use CADASTROS › NOVO CADASTRO", true));
  }
  select.value = valorAtual
    ? [...select.options].find((o) => o.value.toLowerCase() === valorAtual.toLowerCase())?.value ?? ""
    : "";
}
