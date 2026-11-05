interface FinDeskConfig {
  port: number;
  token: string;
}

interface Window {
  finDesk?: {
    config: () => Promise<FinDeskConfig>;
  };
}
