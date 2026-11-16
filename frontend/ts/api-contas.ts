// Contas de usuario com PIN (tela "Quem esta usando?" e CONTAS), igual ao Sistema de
// Garantias. A sessao aberta com o PIN vai no header X-Contas-Sessao; o servidor
// confere o admin em cada pedido.
import { ErroApi, ErroValidacaoApi } from "./api";

export { ErroApi, ErroValidacaoApi };

/** Sessao do perfil (token devolvido ao entrar com o PIN). */
function sessao(): Record<string, string> {
  try {
    const p = JSON.parse(sessionStorage.getItem("contas.perfil") ?? "null") as { token?: string } | null;
    return p?.token ? { "X-Contas-Sessao": p.token } : {};
  } catch {
    return {};
  }
}

function url(cfg: FinDeskConfig, caminho: string): string {
  return `http://127.0.0.1:${cfg.port}${caminho}`;
}

async function get<T>(cfg: FinDeskConfig, caminho: string): Promise<T> {
  const resposta = await fetch(url(cfg, caminho), { headers: { "X-FinDesk-Token": cfg.token, ...sessao() } });
  if (!resposta.ok) throw new ErroApi(resposta.status, await resposta.json().catch(() => ({})));
  return (await resposta.json()) as T;
}

/** POST/PUT/DELETE com JSON: 400 vira ErroValidacaoApi (campo -> mensagem). */
async function enviar<T>(cfg: FinDeskConfig, metodo: string, caminho: string, corpo?: unknown): Promise<T> {
  const resposta = await fetch(url(cfg, caminho), {
    method: metodo,
    headers: { "X-FinDesk-Token": cfg.token, "Content-Type": "application/json", ...sessao() },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  if (resposta.status === 400) {
    const erro = (await resposta.json().catch(() => ({}))) as { campos?: Record<string, string> };
    throw new ErroValidacaoApi(erro.campos ?? {});
  }
  if (!resposta.ok) throw new ErroApi(resposta.status, await resposta.json().catch(() => ({})));
  return resposta.status === 204 ? (undefined as T) : ((await resposta.json()) as T);
}

export interface PerfilConta {
  id: number;
  nome: string;
  temFoto: boolean;
  admin: boolean;
}

export interface SessaoConta {
  token: string;
  id: number;
  nome: string;
  admin: boolean;
}

export interface UsuarioDados {
  id: number;
  nome: string;
  login: string;
  email: string | null;
  admin: boolean;
  ativo: boolean;
  temFoto: boolean;
  acessos: number;
  ultimoAcesso: string | null;
  bloqueado: boolean;
  criadoEm: string;
}

export interface AcessoDados {
  id: number;
  idUsuario: number | null;
  nome: string;
  momento: string;
  tipo: string;
}

export interface UsuarioEntrada {
  nome?: string;
  login?: string;
  email?: string;
  pin?: string;
  admin?: boolean;
  ativo?: boolean;
  fotoBase64?: string;
  /** so na primeira conta (admin) */
  emailLoja?: string;
}

export function listarPerfis(cfg: FinDeskConfig): Promise<{ primeiroAcesso: boolean; perfis: PerfilConta[] }> {
  return get(cfg, "/api/perfis");
}

/** Foto da conta como data URL (a CSP so aceita imagem local ou data:). */
export async function fotoDoPerfil(cfg: FinDeskConfig, id: number): Promise<string | null> {
  const resposta = await fetch(url(cfg, `/api/perfis/${id}/foto`), { headers: { "X-FinDesk-Token": cfg.token } });
  if (!resposta.ok) return null;
  const blob = await resposta.blob();
  return new Promise((ok) => {
    const leitor = new FileReader();
    leitor.onload = () => ok(String(leitor.result));
    leitor.onerror = () => ok(null);
    leitor.readAsDataURL(blob);
  });
}

export function criarPrimeiroAdmin(cfg: FinDeskConfig, dados: UsuarioEntrada): Promise<SessaoConta> {
  return enviar(cfg, "POST", "/api/perfis/primeiro-admin", dados);
}

export function entrarComPin(cfg: FinDeskConfig, idUsuario: number, pin: string): Promise<SessaoConta> {
  return enviar(cfg, "POST", "/api/sessao", { idUsuario, pin });
}

export function sairDaSessao(cfg: FinDeskConfig): Promise<void> {
  return enviar(cfg, "DELETE", "/api/sessao");
}

export function esqueciPin(cfg: FinDeskConfig, login: string): Promise<{ enviadoPara: string }> {
  return enviar(cfg, "POST", "/api/sessao/esqueci-pin", { login });
}

export function redefinirPin(cfg: FinDeskConfig, login: string, codigo: string, novoPin: string): Promise<void> {
  return enviar(cfg, "POST", "/api/sessao/redefinir-pin", { login, codigo, novoPin });
}

export function minhaConta(cfg: FinDeskConfig): Promise<UsuarioDados> {
  return get(cfg, "/api/usuarios/eu");
}

export function trocarMeuPin(cfg: FinDeskConfig, pinAtual: string, novoPin: string): Promise<void> {
  return enviar(cfg, "PUT", "/api/usuarios/eu/pin", { pinAtual, novoPin });
}

export function listarUsuarios(cfg: FinDeskConfig): Promise<UsuarioDados[]> {
  return get(cfg, "/api/usuarios");
}

export function cadastrarUsuario(cfg: FinDeskConfig, dados: UsuarioEntrada): Promise<UsuarioDados> {
  return enviar(cfg, "POST", "/api/usuarios", dados);
}

export function atualizarUsuario(cfg: FinDeskConfig, id: number, dados: UsuarioEntrada): Promise<UsuarioDados> {
  return enviar(cfg, "PUT", `/api/usuarios/${id}`, dados);
}

export function novoPinDoUsuario(cfg: FinDeskConfig, id: number, novoPin: string): Promise<void> {
  return enviar(cfg, "PUT", `/api/usuarios/${id}/pin`, { novoPin });
}

export function trocarFotoDoUsuario(cfg: FinDeskConfig, id: number, fotoBase64: string | null): Promise<void> {
  return enviar(cfg, "PUT", `/api/usuarios/${id}/foto`, { fotoBase64 });
}

export function excluirUsuario(cfg: FinDeskConfig, id: number): Promise<void> {
  return enviar(cfg, "DELETE", `/api/usuarios/${id}`);
}

export function listarAcessos(cfg: FinDeskConfig, id?: number, limite = 100): Promise<AcessoDados[]> {
  return get(cfg, `/api/usuarios/acessos?limite=${limite}${id ? `&id=${id}` : ""}`);
}

export function configEmail(cfg: FinDeskConfig): Promise<{ remetente: string | null; configurado: boolean }> {
  return get(cfg, "/api/email-config");
}

export function gravarConfigEmail(cfg: FinDeskConfig, remetente: string, senhaApp: string): Promise<void> {
  return enviar(cfg, "PUT", "/api/email-config", { remetente, senhaApp });
}

export function testarEmail(cfg: FinDeskConfig, destino: string): Promise<void> {
  return enviar(cfg, "POST", "/api/email-config/teste", { destino });
}
