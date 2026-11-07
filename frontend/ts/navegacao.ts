export type Tela =
  | "menu"
  | "controle"
  | "cadastros"
  | "mensagens"
  | "recorrentes"
  | "novo-cadastro"
  | "form-banco"
  | "form-pagador";

const CHAVE_PILHA = "findesk.pilha-navegacao";

function telaAtual(): Tela {
  return (document.body.dataset.tela as Tela) || "menu";
}

function lerPilha(): Tela[] {
  try {
    const bruto = sessionStorage.getItem(CHAVE_PILHA);
    const lista: unknown = bruto ? JSON.parse(bruto) : [];
    return Array.isArray(lista) ? (lista as Tela[]) : [];
  } catch {
    return [];
  }
}

function gravarPilha(pilha: Tela[]): void {
  sessionStorage.setItem(CHAVE_PILHA, JSON.stringify(pilha));
}

async function carregar(destino: Tela): Promise<void> {
  if (!window.finDesk) {
    throw new Error("navegação indisponível");
  }
  await window.finDesk.navegar(destino);
}

export async function irPara(destino: Tela): Promise<void> {
  const pilha = lerPilha();
  pilha.push(telaAtual());
  gravarPilha(pilha);
  await carregar(destino);
}

export async function voltar(): Promise<void> {
  const pilha = lerPilha();
  const anterior = pilha.pop();
  gravarPilha(pilha);
  await carregar(anterior ?? "menu");
}

export async function menuPrincipal(): Promise<void> {
  gravarPilha([]);
  await carregar("menu");
}
