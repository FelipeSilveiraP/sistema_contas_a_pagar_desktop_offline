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
  | "novo-cadastro";

interface Window {
  finDesk?: {
    config: () => Promise<FinDeskConfig>;
    navegar: (tela: TelaFinDesk) => Promise<void>;
  };
}
