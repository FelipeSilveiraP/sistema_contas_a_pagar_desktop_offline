export interface StatusApi {
  status: string;
  app: string;
  fase: string;
}

export interface ContaResumo {
  id: number;
  empresa: string;
  valor: number;
  vencimento: string;
  status: string;
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

export function buscarContas(cfg: FinDeskConfig): Promise<ContaResumo[]> {
  return get<ContaResumo[]>(cfg, "/api/contas");
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
