interface FinDeskConfig {
  port: number;
  token: string;
}

type TelaFinDesk =
  | "menu"
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
  };
}
