// Botao unico da conta (bolinha + nome + seta), na barra global e no Menu.
// Abre uma lista com MINHA CONTA (tela CONTAS: editar a conta; o admin administra
// as outras) e SAIR E TROCAR DE CONTA (volta para "Quem esta usando?", que encerra
// a sessao). Padrao menu-button do WAI-ARIA: ESC fecha, clique fora fecha, setas
// navegam. DOM so por createElement/textContent.
import { irPara } from "./navegacao";
import { criarAvatar, Perfil } from "./perfil";

const SETA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 9l7 7 7-7"/></svg>';

function item(icone: string, rotulo: string, acao: () => void): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "conta-menu__item";
  b.setAttribute("role", "menuitem");
  const i = document.createElement("span");
  i.className = "material-symbols-outlined";
  i.setAttribute("aria-hidden", "true");
  i.textContent = icone;
  const t = document.createElement("span");
  t.textContent = rotulo;
  b.append(i, t);
  b.addEventListener("click", (evento) => {
    evento.stopPropagation();
    acao();
  });
  return b;
}

/** `classeBotao`: "nav-item" na barra global, "menu-perfil" no topo do Menu. */
export function criarBotaoConta(perfil: Perfil, classeBotao: string, ativo = false): HTMLElement {
  const raiz = document.createElement("div");
  raiz.className = "conta-menu";

  const botao = document.createElement("button");
  botao.type = "button";
  botao.className = `${classeBotao} conta-menu__botao`;
  botao.title = `${perfil.nome}: minha conta ou trocar de conta`;
  botao.setAttribute("aria-haspopup", "menu");
  botao.setAttribute("aria-expanded", "false");
  if (ativo) botao.setAttribute("aria-current", "page");
  const nome = document.createElement("span");
  nome.className = "conta-menu__nome";
  nome.textContent = perfil.nome;
  const seta = document.createElement("span");
  seta.className = "conta-menu__seta";
  seta.innerHTML = SETA; // nosemgrep: innerhtml-com-dados -- desenho SVG fixo do codigo
  botao.append(criarAvatar(perfil, "pequena"), nome, seta);

  const lista = document.createElement("div");
  lista.className = "conta-menu__lista";
  lista.setAttribute("role", "menu");
  lista.setAttribute("aria-label", "Conta");
  const itens = [
    item("manage_accounts", "MINHA CONTA", () => {
      fechar();
      void irPara("usuarios");
    }),
    item("logout", "SAIR E TROCAR DE CONTA", () => {
      fechar();
      void window.finDesk?.navegar("perfis");
    }),
  ];
  lista.append(...itens);
  raiz.append(botao, lista);

  const aberto = (): boolean => raiz.classList.contains("aberto");
  function fechar(focarBotao = false): void {
    raiz.classList.remove("aberto");
    botao.setAttribute("aria-expanded", "false");
    if (focarBotao) botao.focus();
  }
  function abrir(): void {
    raiz.classList.add("aberto");
    botao.setAttribute("aria-expanded", "true");
    itens[0].focus();
  }

  botao.addEventListener("click", (evento) => {
    evento.stopPropagation();
    if (aberto()) fechar();
    else abrir();
  });
  document.addEventListener("click", (evento) => {
    if (aberto() && !raiz.contains(evento.target as Node)) fechar();
  });
  // captura: o ESC fecha a lista antes do ESC global (voltar)
  document.addEventListener("keydown", (evento) => {
    if (!aberto()) return;
    if (evento.key === "Escape") {
      evento.preventDefault();
      evento.stopImmediatePropagation();
      fechar(true);
      return;
    }
    if (evento.key === "ArrowDown" || evento.key === "ArrowUp") {
      evento.preventDefault();
      const atual = itens.indexOf(document.activeElement as HTMLButtonElement);
      const proximo = evento.key === "ArrowDown" ? atual + 1 : atual - 1;
      itens[(proximo + itens.length) % itens.length].focus();
    }
  }, true);
  return raiz;
}
