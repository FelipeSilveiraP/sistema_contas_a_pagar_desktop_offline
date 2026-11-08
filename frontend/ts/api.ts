export interface StatusApi {
  status: string;
  app: string;
  fase: string;
}

export interface ContaDados {
  id: number;
  idEmpresa: number;
  razaoSocial: string;
  idPagador: number | null;
  nomePagador: string | null;
  categoria: string | null;
  numeroDocumento: string | null;
  valor: number;
  vencimento: string;
  boletoNaPasta: boolean;
  status: string;
}

export interface ContaEntrada {
  idEmpresa: number;
  idPagador?: number;
  categoria?: string;
  numeroDocumento?: string;
  valor: string;
  vencimento: string;
  boletoNaPasta?: boolean;
  forcar?: boolean;
}

export class ErroDuplicidadeApi extends Error {
  constructor(public existente: ContaDados) {
    super("possivel duplicidade");
  }
}

async function get<T>(cfg: FinDeskConfig, caminho: string): Promise<T> {
  const resposta = await fetch(`http://127.0.0.1:${cfg.port}${caminho}`, {
    headers: { "X-FinDesk-Token": cfg.token },
  });
  if (!resposta.ok) {
    throw new Error(`HTTP ${resposta.status}`);
  }
  return (await resposta.json()) as T;
}

export function buscarStatus(cfg: FinDeskConfig): Promise<StatusApi> {
  return get<StatusApi>(cfg, "/api/status");
}

export function buscarContas(cfg: FinDeskConfig): Promise<ContaDados[]> {
  return get<ContaDados[]>(cfg, "/api/contas");
}

export interface BancoDados {
  id: number;
  instituicao: string;
  chavePix: string | null;
}

export class ErroValidacaoApi extends Error {
  constructor(public campos: Record<string, string>) {
    super("dados invalidos");
  }
}

export class ErroApi extends Error {
  constructor(public status: number) {
    super(`HTTP ${status}`);
  }
}

export async function criarBanco(
  cfg: FinDeskConfig,
  dados: { instituicao: string; chavePix?: string }
): Promise<BancoDados> {
  const resposta = await fetch(`http://127.0.0.1:${cfg.port}/api/bancos`, {
    method: "POST",
    headers: { "X-FinDesk-Token": cfg.token, "Content-Type": "application/json" },
    body: JSON.stringify(dados),
  });
  if (resposta.status === 400) {
    const corpo = (await resposta.json()) as { campos?: Record<string, string> };
    throw new ErroValidacaoApi(corpo.campos ?? {});
  }
  if (!resposta.ok) {
    throw new ErroApi(resposta.status);
  }
  return (await resposta.json()) as BancoDados;
}

export interface PagadorDados {
  id: number;
  nome: string;
  cpf: string;
  funcao: string | null;
}

export async function criarPagador(
  cfg: FinDeskConfig,
  dados: { nome: string; cpf: string; funcao?: string }
): Promise<PagadorDados> {
  const resposta = await fetch(`http://127.0.0.1:${cfg.port}/api/pagadores`, {
    method: "POST",
    headers: { "X-FinDesk-Token": cfg.token, "Content-Type": "application/json" },
    body: JSON.stringify(dados),
  });
  if (resposta.status === 400) {
    const corpo = (await resposta.json()) as { campos?: Record<string, string> };
    throw new ErroValidacaoApi(corpo.campos ?? {});
  }
  if (!resposta.ok) {
    throw new ErroApi(resposta.status);
  }
  return (await resposta.json()) as PagadorDados;
}

export interface TelefoneEmpresaDados {
  numero: string;
  tipo: string | null;
}

export interface EmpresaDados {
  id: number;
  cnpj: string | null;
  razaoSocial: string;
  nomeRepresentante: string | null;
  email: string | null;
  logradouro: string | null;
  telefones: TelefoneEmpresaDados[];
}

export interface EmpresaEntrada {
  cnpj?: string;
  razaoSocial: string;
  nomeRepresentante?: string;
  email?: string;
  logradouro?: string;
  telefones?: { numero: string; tipo?: string }[];
}

export async function criarEmpresa(
  cfg: FinDeskConfig,
  dados: EmpresaEntrada
): Promise<EmpresaDados> {
  const resposta = await fetch(`http://127.0.0.1:${cfg.port}/api/empresas`, {
    method: "POST",
    headers: { "X-FinDesk-Token": cfg.token, "Content-Type": "application/json" },
    body: JSON.stringify(dados),
  });
  if (resposta.status === 400) {
    const corpo = (await resposta.json()) as { campos?: Record<string, string> };
    throw new ErroValidacaoApi(corpo.campos ?? {});
  }
  if (!resposta.ok) {
    throw new ErroApi(resposta.status);
  }
  return (await resposta.json()) as EmpresaDados;
}

export function listarBancos(cfg: FinDeskConfig): Promise<BancoDados[]> {
  return get<BancoDados[]>(cfg, "/api/bancos");
}

export function listarPagadores(cfg: FinDeskConfig): Promise<PagadorDados[]> {
  return get<PagadorDados[]>(cfg, "/api/pagadores");
}

export function listarEmpresas(cfg: FinDeskConfig): Promise<EmpresaDados[]> {
  return get<EmpresaDados[]>(cfg, "/api/empresas");
}

async function atualizar<T>(cfg: FinDeskConfig, caminho: string, dados: unknown): Promise<T> {
  const resposta = await fetch(`http://127.0.0.1:${cfg.port}${caminho}`, {
    method: "PUT",
    headers: { "X-FinDesk-Token": cfg.token, "Content-Type": "application/json" },
    body: JSON.stringify(dados),
  });
  if (resposta.status === 400) {
    const corpo = (await resposta.json()) as { campos?: Record<string, string> };
    throw new ErroValidacaoApi(corpo.campos ?? {});
  }
  if (!resposta.ok) {
    throw new ErroApi(resposta.status);
  }
  return (await resposta.json()) as T;
}

export function atualizarBanco(
  cfg: FinDeskConfig,
  id: number,
  dados: { instituicao: string; chavePix?: string }
): Promise<BancoDados> {
  return atualizar<BancoDados>(cfg, `/api/bancos/${id}`, dados);
}

export function atualizarPagador(
  cfg: FinDeskConfig,
  id: number,
  dados: { nome: string; cpf: string; funcao?: string }
): Promise<PagadorDados> {
  return atualizar<PagadorDados>(cfg, `/api/pagadores/${id}`, dados);
}

export function atualizarEmpresa(
  cfg: FinDeskConfig,
  id: number,
  dados: EmpresaEntrada
): Promise<EmpresaDados> {
  return atualizar<EmpresaDados>(cfg, `/api/empresas/${id}`, dados);
}

async function excluir(cfg: FinDeskConfig, caminho: string): Promise<void> {
  const resposta = await fetch(`http://127.0.0.1:${cfg.port}${caminho}`, {
    method: "DELETE",
    headers: { "X-FinDesk-Token": cfg.token },
  });
  if (!resposta.ok) {
    throw new ErroApi(resposta.status);
  }
}

export function excluirBanco(cfg: FinDeskConfig, id: number): Promise<void> {
  return excluir(cfg, `/api/bancos/${id}`);
}

export function excluirPagador(cfg: FinDeskConfig, id: number): Promise<void> {
  return excluir(cfg, `/api/pagadores/${id}`);
}

export function excluirEmpresa(cfg: FinDeskConfig, id: number): Promise<void> {
  return excluir(cfg, `/api/empresas/${id}`);
}

export async function criarConta(cfg: FinDeskConfig, dados: ContaEntrada): Promise<ContaDados> {
  const resposta = await fetch(`http://127.0.0.1:${cfg.port}/api/contas`, {
    method: "POST",
    headers: { "X-FinDesk-Token": cfg.token, "Content-Type": "application/json" },
    body: JSON.stringify(dados),
  });
  if (resposta.status === 400) {
    const corpo = (await resposta.json()) as { campos?: Record<string, string> };
    throw new ErroValidacaoApi(corpo.campos ?? {});
  }
  if (resposta.status === 409) {
    const corpo = (await resposta.json()) as { tipo?: string; existente?: ContaDados };
    if (corpo.tipo === "possivel_duplicata" && corpo.existente) {
      throw new ErroDuplicidadeApi(corpo.existente);
    }
    throw new ErroApi(409);
  }
  if (!resposta.ok) {
    throw new ErroApi(resposta.status);
  }
  return (await resposta.json()) as ContaDados;
}

export function listarContas(cfg: FinDeskConfig, status?: string): Promise<ContaDados[]> {
  const consulta = status ? `?status=${encodeURIComponent(status)}` : "";
  return get<ContaDados[]>(cfg, `/api/contas${consulta}`);
}
