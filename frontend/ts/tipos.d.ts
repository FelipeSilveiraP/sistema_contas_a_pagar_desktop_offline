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
  | "form-empresa";

interface Window {
  finDesk?: {
    config: () => Promise<FinDeskConfig>;
    navegar: (tela: TelaFinDesk) => Promise<void>;
  };
}
