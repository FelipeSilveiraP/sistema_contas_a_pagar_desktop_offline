// Perfil em uso (tela "Quem esta usando?", como na Netflix): a conta que entrou
// com o PIN. Fica na sessao da janela ate trocar de perfil ou fechar o sistema.
// O token da sessao vai em toda requisicao (api.ts); o servidor confere o admin.

export interface Perfil {
  id: number;
  nome: string;
  admin?: boolean;
  /** token da sessao aberta com o PIN */
  token?: string;
  /** foto como data URL (opcional) */
  foto?: string | null;
}

const CHAVE = "contas.perfil";

/** Cores neobrutalistas das bolinhas sem foto (sempre a mesma cor para a mesma conta). */
const CORES = ["#FFE600", "#38BDF8", "#00FF66", "#FF8C00", "#FF5E89", "#A78BFA", "#FF3B30", "#2DD4BF"];

export function perfilAtual(): Perfil | null {
  try {
    const bruto = sessionStorage.getItem(CHAVE);
    if (!bruto) return null;
    const p = JSON.parse(bruto) as Perfil;
    return typeof p?.nome === "string" && p.nome && p.token ? p : null;
  } catch {
    return null;
  }
}

export function definirPerfil(perfil: Perfil): void {
  try {
    sessionStorage.setItem(CHAVE, JSON.stringify(perfil));
  } catch {
    // sem sessionStorage: o sistema volta para a tela de perfis
  }
}

export function limparPerfil(): void {
  try {
    sessionStorage.removeItem(CHAVE);
  } catch {
    // ignora
  }
}

/** "CARLOS H." -> "CH"; "FELIPE" -> "FE". */
export function iniciais(nome: string): string {
  const partes = nome.replace(/[^\p{L}\s]/gu, " ").trim().split(/\s+/).filter(Boolean);
  if (partes.length >= 2) return (partes[0][0] + partes[1][0]).toUpperCase();
  return (partes[0] ?? "?").slice(0, 2).toUpperCase();
}

export function corDoPerfil(id: number): string {
  return CORES[Math.abs(id) % CORES.length];
}

/** Bolinha: a foto da conta, ou as iniciais numa cor fixa (tamanho pelo CSS). */
export function criarAvatar(perfil: Perfil, tamanho: "grande" | "pequena"): HTMLSpanElement {
  const bolinha = document.createElement("span");
  bolinha.className = `perfil-avatar perfil-avatar--${tamanho}`;
  bolinha.setAttribute("aria-hidden", "true");
  if (perfil.foto) {
    const img = document.createElement("img");
    img.src = perfil.foto;
    img.alt = "";
    bolinha.classList.add("perfil-avatar--foto");
    bolinha.appendChild(img);
    return bolinha;
  }
  bolinha.style.backgroundColor = corDoPerfil(perfil.id);
  bolinha.textContent = iniciais(perfil.nome);
  return bolinha;
}

/** Sem sessao, volta para "Quem esta usando?". Devolve o perfil quando ha sessao. */
export function exigirPerfil(): Perfil | null {
  const p = perfilAtual();
  if (!p) void window.finDesk?.navegar("perfis");
  return p;
}
