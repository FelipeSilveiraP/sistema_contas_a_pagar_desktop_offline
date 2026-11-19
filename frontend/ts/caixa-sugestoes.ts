// Caixa de DIGITAR OU ESCOLHER no estilo neobrutalista (a mesma do Sistema de Garantias),
// no lugar da lista padrao do Windows (<datalist>), que e pequena e fora do design.
// Todo <input list="..."> da tela vira essa caixa sozinho (inclusive os de pop-ups criados
// depois): a lista abre ao clicar ou digitar, filtra pelo que foi digitado, aceita texto
// livre, setas + Enter escolhem e Esc fecha so a lista.

function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim();
}

function converter(campo: HTMLInputElement): void {
  const fonte = document.getElementById(campo.getAttribute("list") ?? "");
  if (!(fonte instanceof HTMLDataListElement)) return;
  const opcoes = [...fonte.options].map((o) => o.value).filter(Boolean);
  campo.removeAttribute("list");
  campo.classList.add("caixa-busca__campo");
  campo.setAttribute("role", "combobox");
  campo.setAttribute("aria-autocomplete", "list");
  campo.setAttribute("aria-expanded", "false");

  const envoltorio = document.createElement("div");
  envoltorio.className = "caixa-busca";
  campo.before(envoltorio);
  envoltorio.appendChild(campo);

  const seta = document.createElement("button");
  seta.type = "button";
  seta.className = "caixa-busca__seta";
  seta.tabIndex = -1;
  seta.setAttribute("aria-label", "Abrir a lista");
  const icone = document.createElement("span");
  icone.className = "material-symbols-outlined";
  icone.setAttribute("aria-hidden", "true");
  icone.textContent = "expand_more";
  seta.appendChild(icone);

  const lista = document.createElement("ul");
  lista.className = "caixa-busca__lista hidden";
  lista.setAttribute("role", "listbox");
  lista.id = `${campo.id || "caixa"}-lista`;
  campo.setAttribute("aria-controls", lista.id);
  envoltorio.append(seta, lista);

  let visiveis: string[] = [];
  let ativo = -1;
  const aberta = (): boolean => !lista.classList.contains("hidden");

  const marcar = (): void => {
    [...lista.children].forEach((li, i) => li.setAttribute("aria-selected", String(i === ativo)));
    (lista.children[ativo] as HTMLElement | undefined)?.scrollIntoView({ block: "nearest" });
  };
  const escolher = (valor: string): void => {
    campo.value = valor;
    campo.dispatchEvent(new Event("input", { bubbles: true }));
    campo.dispatchEvent(new Event("change", { bubbles: true }));
    fechar();
  };
  const desenhar = (): void => {
    const digitado = normalizar(campo.value);
    // texto igual a uma opcao (ja escolhida): mostra todas para poder trocar
    const exata = opcoes.some((o) => normalizar(o) === digitado);
    visiveis = !digitado || exata ? opcoes : opcoes.filter((o) => normalizar(o).includes(digitado));
    ativo = -1;
    if (!visiveis.length) {
      const vazio = document.createElement("li");
      vazio.className = "caixa-busca__vazio";
      vazio.textContent = "Nada na lista: pode deixar escrito assim.";
      lista.replaceChildren(vazio);
      return;
    }
    lista.replaceChildren(...visiveis.map((valor) => {
      const li = document.createElement("li");
      li.className = "caixa-busca__opcao";
      li.setAttribute("role", "option");
      li.textContent = valor;
      // mousedown: escolhe antes de o campo perder o foco
      li.addEventListener("mousedown", (evento) => {
        evento.preventDefault();
        escolher(valor);
      });
      return li;
    }));
  };
  const abrir = (): void => {
    desenhar();
    lista.classList.remove("hidden");
    campo.setAttribute("aria-expanded", "true");
  };
  function fechar(): void {
    lista.classList.add("hidden");
    campo.setAttribute("aria-expanded", "false");
    ativo = -1;
  }

  campo.addEventListener("focus", abrir);
  campo.addEventListener("click", () => { if (!aberta()) abrir(); });
  campo.addEventListener("input", () => { if (document.activeElement === campo) abrir(); });
  campo.addEventListener("blur", () => window.setTimeout(fechar, 120));
  seta.addEventListener("mousedown", (evento) => {
    evento.preventDefault();
    if (aberta()) fechar();
    else {
      campo.focus();
      abrir();
    }
  });
  // na janela e na captura: roda antes dos atalhos da tela e do pop-up (Enter = confirmar,
  // Esc = fechar o pop-up), para Enter escolher a opcao e Esc fechar so a lista
  window.addEventListener("keydown", (evento) => {
    if (evento.target !== campo || !aberta()) return;
    if (evento.key === "ArrowDown" || evento.key === "ArrowUp") {
      evento.preventDefault();
      evento.stopPropagation();
      if (!visiveis.length) return;
      ativo = evento.key === "ArrowDown" ? (ativo + 1) % visiveis.length : (ativo <= 0 ? visiveis.length - 1 : ativo - 1);
      marcar();
    } else if (evento.key === "Enter" && ativo >= 0) {
      evento.preventDefault();
      evento.stopPropagation();
      escolher(visiveis[ativo]);
    } else if (evento.key === "Escape") {
      evento.preventDefault();
      evento.stopPropagation();
      fechar();
    }
  }, true);
}

/** Converte os <input list> que existem e os que aparecerem depois (pop-ups). */
export function ligarCaixasSugestoes(): void {
  const varrer = (): void => {
    document.querySelectorAll<HTMLInputElement>("input[list]").forEach(converter);
  };
  varrer();
  new MutationObserver(varrer).observe(document.body, { childList: true, subtree: true });
}
