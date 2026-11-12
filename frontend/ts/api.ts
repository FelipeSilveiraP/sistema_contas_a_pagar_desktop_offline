export interface StatusApi {
  status: string;
  app: string;
  fase: string;
}

export interface ContaDados {
  id: number;
  nomeEmpresa: string;
  idEmpresa: number | null;
  razaoSocial: string | null;
  pagadorResponsavel: string;
  tipoPessoa: string;
  formaPagamento: string;
  categoria: string | null;
  numeroDocumento: string | null;
  valor: number;
  vencimento: string;
  boletoNaPasta: boolean;
  anexoNome: string | null;
  semNotaFiscal: boolean;
  /** data (aaaa-mm-dd) em que a limpeza trimestral apagou o arquivo da nota */
  anexoRemovidoEm: string | null;
  status: string;
}

export interface ContaEntrada {
  nomeEmpresa: string;
  idEmpresa?: number;
  pagadorResponsavel: string;
  tipoPessoa: string;
  formaPagamento: string;
  categoria?: string;
  numeroDocumento?: string;
  valor: string;
  vencimento: string;
  boletoNaPasta?: boolean;
  anexoNome?: string;
  anexoPdfBase64?: string;
  semNotaFiscal?: boolean;
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

/** Bytes do arquivo da nota fiscal anexada (PDF, foto ou Word). */
export async function baixarAnexoConta(cfg: FinDeskConfig, id: number): Promise<Uint8Array> {
  const resposta = await fetch(`http://127.0.0.1:${cfg.port}/api/contas/${id}/anexo`, {
    headers: { "X-FinDesk-Token": cfg.token },
  });
  if (!resposta.ok) throw new ErroApi(resposta.status);
  return new Uint8Array(await resposta.arrayBuffer());
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

export interface PagamentoDados {
  id: number;
  idConta: number;
  dataPagamento: string;
  valorPago: number;
  idBanco: number | null;
  instituicaoBanco: string | null;
  nomeEmpresa: string;
  statusConta: string;
}

export interface RecorrenteDados {
  id: number;
  nomeEmpresa: string;
  idEmpresa: number | null;
  pagadorResponsavel: string;
  categoria: string | null;
  numeroDocumento: string | null;
  valor: number;
  dia: number;
  periodicidade: string;
  formaPagamento: string | null;
  ativo: boolean;
  tipoPessoa: string;
}

export interface AvisoDados {
  id: number;
  dataInicio: string;
  dataFim: string;
  diaSemana: string;
  titulo: string;
  mensagem: string;
}

export interface ResumoDashboard {
  totalPagoCentavos: number;
  totalPendenteCentavos: number;
  vencidasCentavos: number;
  aVencerCentavos: number;
  porCategoria: { categoria: string; totalCentavos: number }[];
  porMes: { mes: string; totalPagoCentavos: number; totalPendenteCentavos: number }[];
  quantidadePagas: number;
  quantidadePendentes: number;
  maioresFornecedores: { nomeEmpresa: string; totalCentavos: number; quantidade: number }[];
}

export interface AlertaContaDados {
  id: number;
  nomeEmpresa: string;
  vencimento: string;
  valor: number;
  /** dias ate o vencimento (negativo = atrasada) */
  dias: number;
  boletoNaPasta: boolean;
  pagadorResponsavel: string | null;
}

export interface AlertasDados {
  hoje: string;
  atrasados: AlertaContaDados[];
  aVencer: AlertaContaDados[];
  avisosAtivos: number;
  avisosHoje: { id: number; titulo: string; mensagem: string }[];
}

async function post<T>(cfg: FinDeskConfig, caminho: string, dados: unknown): Promise<T> {
  const resposta = await fetch(`http://127.0.0.1:${cfg.port}${caminho}`, {
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
  return (await resposta.json()) as T;
}

export function registrarPagamento(
  cfg: FinDeskConfig,
  idConta: number,
  dados: { dataPagamento: string; valorPago: string; idBanco?: number }
): Promise<PagamentoDados> {
  return post<PagamentoDados>(cfg, `/api/contas/${idConta}/pagamento`, dados);
}

export function buscarPagamentoConta(cfg: FinDeskConfig, idConta: number): Promise<PagamentoDados> {
  return get<PagamentoDados>(cfg, `/api/contas/${idConta}/pagamento`);
}

export async function estornarPagamento(cfg: FinDeskConfig, idConta: number): Promise<void> {
  await excluir(cfg, `/api/contas/${idConta}/pagamento`);
}

export function atualizarPagamento(
  cfg: FinDeskConfig,
  id: number,
  dados: { dataPagamento: string; valorPago: string; idBanco?: number }
): Promise<PagamentoDados> {
  return atualizar<PagamentoDados>(cfg, `/api/pagamentos/${id}`, dados);
}

export function listarPagamentos(cfg: FinDeskConfig): Promise<PagamentoDados[]> {
  return get<PagamentoDados[]>(cfg, "/api/pagamentos");
}

export function listarRecorrentes(cfg: FinDeskConfig): Promise<RecorrenteDados[]> {
  return get<RecorrenteDados[]>(cfg, "/api/recorrentes");
}

export function criarRecorrente(cfg: FinDeskConfig, dados: Omit<RecorrenteDados, "id">): Promise<RecorrenteDados> {
  return post<RecorrenteDados>(cfg, "/api/recorrentes", dados);
}

export function gerarContasRecorrente(cfg: FinDeskConfig, id: number): Promise<{ geradas: number }> {
  return post<{ geradas: number }>(cfg, `/api/recorrentes/${id}/gerar`, {});
}

export function atualizarRecorrente(
  cfg: FinDeskConfig,
  id: number,
  dados: Omit<RecorrenteDados, "id">
): Promise<RecorrenteDados> {
  return atualizar<RecorrenteDados>(cfg, `/api/recorrentes/${id}`, dados);
}

export function excluirRecorrente(cfg: FinDeskConfig, id: number): Promise<void> {
  return excluir(cfg, `/api/recorrentes/${id}`);
}

export function listarAvisos(cfg: FinDeskConfig): Promise<AvisoDados[]> {
  return get<AvisoDados[]>(cfg, "/api/avisos");
}

export function criarAviso(cfg: FinDeskConfig, dados: Omit<AvisoDados, "id">): Promise<AvisoDados> {
  return post<AvisoDados>(cfg, "/api/avisos", dados);
}

export function atualizarAviso(cfg: FinDeskConfig, id: number, dados: Omit<AvisoDados, "id">): Promise<AvisoDados> {
  return atualizar<AvisoDados>(cfg, `/api/avisos/${id}`, dados);
}

export function excluirAviso(cfg: FinDeskConfig, id: number): Promise<void> {
  return excluir(cfg, `/api/avisos/${id}`);
}

export function buscarResumo(cfg: FinDeskConfig, de?: string, ate?: string): Promise<ResumoDashboard> {
  const params = new URLSearchParams();
  if (de) params.set("de", de);
  if (ate) params.set("ate", ate);
  const consulta = params.toString() ? `?${params.toString()}` : "";
  return get<ResumoDashboard>(cfg, `/api/dashboard/resumo${consulta}`);
}

export interface SituacaoBackupDrive {
  estado: "aguardando" | "executando" | "ok" | "erro" | "desligado";
  mensagem: string;
  arquivo: string | null;
  quando: string | null;
}

/** Resultado do backup em planilha na pasta do Google Drive, feito na abertura. */
export function buscarBackupDrive(cfg: FinDeskConfig): Promise<SituacaoBackupDrive> {
  return get<SituacaoBackupDrive>(cfg, "/api/backup-drive");
}

export function buscarAlertas(cfg: FinDeskConfig): Promise<AlertasDados> {
  return get<AlertasDados>(cfg, "/api/contas/alertas");
}

export function atualizarConta(cfg: FinDeskConfig, id: number, dados: ContaEntrada): Promise<ContaDados> {
  return atualizar<ContaDados>(cfg, `/api/contas/${id}`, dados);
}

export function excluirConta(cfg: FinDeskConfig, id: number): Promise<void> {
  return excluir(cfg, `/api/contas/${id}`);
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

export function listarContasFixas(cfg: FinDeskConfig): Promise<ContaDados[]> {
  return get<ContaDados[]>(cfg, "/api/contas?fixas=true");
}

export function listarContas(cfg: FinDeskConfig, status?: string): Promise<ContaDados[]> {
  const consulta = status ? `?status=${encodeURIComponent(status)}` : "";
  return get<ContaDados[]>(cfg, `/api/contas${consulta}`);
}
