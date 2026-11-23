interface FinDeskConfig {
  port: number;
  token: string;
  /** versao instalada (package.json), mostrada no Menu */
  versao?: string;
}

type TelaFinDesk =
  | "menu"
  | "perfis"
  | "usuarios"
  | "controle"
  | "cadastros"
  | "mensagens"
  | "recorrentes"
  | "novo-cadastro"
  | "form-banco"
  | "form-pagador"
  | "form-empresa"
  | "todos-cadastros"
  | "inserir-conta"
  | "todas-as-contas"
  | "pagos"
  | "recorrentes-tabela"
  | "form-recorrente"
  | "todas-as-mensagens"
  | "criar-mensagem"
  | "graficos";

interface Window {
  finDesk?: {
    config: () => Promise<FinDeskConfig>;
    navegar: (tela: TelaFinDesk) => Promise<void>;
    estadoInicializacao: () => Promise<{ estado: "aguardando" | "pronto" | "falhou" }>;
    onInicializacao: (callback: (estado: { estado: "aguardando" | "pronto" | "falhou" }) => void) => void;
    reiniciarBackend: () => Promise<{ ok: boolean }>;
    repararFoco: () => Promise<boolean>;
    fecharAplicativo: () => Promise<void>;
    salvarNota: (nome: string, bytes: Uint8Array) => Promise<{ ok: boolean; caminho?: string }>;
    abrirNota: (caminho: string) => Promise<boolean>;
    abrirArquivo: (caminho: string) => Promise<boolean>;
    imprimirPdf: (
      nome: string,
      opcoes?: { retrato?: boolean; anexoPdf?: Uint8Array; formal?: boolean },
    ) => Promise<{ ok: boolean; caminho?: string; anexoIncluido?: boolean }>;
    atualizacaoDisponivel: () => Promise<{ versao: string; atual: string; novidades: string } | null>;
    novidades?: () => Promise<{ versao: string; itens: { data: string; tipo: string; texto: string }[]; restantes: number } | null>;
    marcarNovidadesVistas?: () => Promise<boolean>;
    instalarAtualizacao: () => Promise<boolean>;
    onProgressoAtualizacao?: (callback: (progresso: { recebidos: number; total: number }) => void) => void;
  };
}
