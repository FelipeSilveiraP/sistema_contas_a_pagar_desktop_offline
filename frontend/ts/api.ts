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
