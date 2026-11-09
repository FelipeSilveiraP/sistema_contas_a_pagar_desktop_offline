// Despacho por tela com carregamento sob demanda: cada pagina importa somente
// o modulo que utiliza (chunks ESM gerados pelo esbuild --splitting).
import { iniciarDiagnostico } from "./diagnostico";

iniciarDiagnostico();

const tela = document.body.dataset.tela ?? "menu";

async function iniciar(): Promise<void> {
  switch (tela) {
    case "menu": {
      const { iniciarMenu } = await import("./telas/menu");
      iniciarMenu();
      return;
    }
    case "carregando": {
      const { iniciarCarregando } = await import("./telas/carregando");
      iniciarCarregando();
      return;
    }
    case "form-banco": {
      const { iniciarFormBanco } = await import("./telas/form-banco");
      iniciarFormBanco();
      return;
    }
    case "form-pagador": {
      const { iniciarFormPagador } = await import("./telas/form-pagador");
      iniciarFormPagador();
      return;
    }
    case "form-empresa": {
      const { iniciarFormEmpresa } = await import("./telas/form-empresa");
      iniciarFormEmpresa();
      return;
    }
    case "todos-cadastros": {
      const { iniciarTodosCadastros } = await import("./telas/todos-cadastros");
      iniciarTodosCadastros();
      return;
    }
    case "inserir-conta": {
      const { iniciarInserirConta } = await import("./telas/inserir-conta");
      iniciarInserirConta();
      return;
    }
    case "pagos": {
      const { iniciarPagos } = await import("./telas/pagos");
      iniciarPagos();
      return;
    }
    case "recorrentes-tabela": {
      const { iniciarRecorrentesTabela } = await import("./telas/recorrentes-tabela");
      iniciarRecorrentesTabela();
      return;
    }
    case "form-recorrente": {
      const { iniciarFormRecorrente } = await import("./telas/form-recorrente");
      iniciarFormRecorrente();
      return;
    }
    case "todas-as-mensagens": {
      const { iniciarTodasAsMensagens } = await import("./telas/todas-as-mensagens");
      iniciarTodasAsMensagens();
      return;
    }
    case "criar-mensagem": {
      const { iniciarCriarMensagem } = await import("./telas/criar-mensagem");
      iniciarCriarMensagem();
      return;
    }
    case "graficos": {
      const { iniciarGraficos } = await import("./telas/graficos");
      iniciarGraficos();
      return;
    }
    case "todas-as-contas": {
      const { iniciarTodasAsContas } = await import("./telas/todas-as-contas");
      iniciarTodasAsContas();
      return;
    }
    default: {
      const { iniciarSubmenu } = await import("./telas/submenu");
      const { SUBMENUS } = await import("./submenus-config");
      const config = (SUBMENUS as Record<string, Parameters<typeof iniciarSubmenu>[1]>)[tela];
      if (config) {
        iniciarSubmenu(tela as Parameters<typeof iniciarSubmenu>[0], config);
      } else {
        console.error("[ContasAPagar] tela desconhecida:", tela);
      }
    }
  }
}

void iniciar().then(() => {
  // Sinal de prontidao: componentes da tela ja inicializados.
  document.body.dataset.pronto = "true";
});
