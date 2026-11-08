const { app, BrowserWindow, dialog, ipcMain, screen } = require("electron");
const { spawn } = require("child_process");
const net = require("net");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

let processoBackend = null;
let janela = null;
let token = null;
let porta = null;
let encerrando = false;
let estadoInicializacao = "aguardando";
let menuLiberado = false;

// Marcos de tempo do ciclo de inicializacao (sem tokens nem caminhos sensiveis)
const INICIO_PROCESSO = Date.now();
function marco(nome) {
  console.log(`[startup] ${nome} +${Date.now() - INICIO_PROCESSO}ms`);
}
marco("processo-inicio");

const TELAS = new Map([
  ["menu", path.join(__dirname, "..", "frontend", "html", "menu.html")],
  ["controle", path.join(__dirname, "..", "frontend", "html", "controle.html")],
  ["cadastros", path.join(__dirname, "..", "frontend", "html", "cadastros.html")],
  ["mensagens", path.join(__dirname, "..", "frontend", "html", "mensagens.html")],
  ["recorrentes", path.join(__dirname, "..", "frontend", "html", "recorrentes.html")],
  ["novo-cadastro", path.join(__dirname, "..", "frontend", "html", "novo-cadastro.html")],
  ["form-banco", path.join(__dirname, "..", "frontend", "html", "form-banco.html")],
  ["form-pagador", path.join(__dirname, "..", "frontend", "html", "form-pagador.html")],
  ["form-empresa", path.join(__dirname, "..", "frontend", "html", "form-empresa.html")],
]);

const NOME_APP = "Sistema de Contas a Pagar — Chaveiro Universal";

function portaLivre() {
  return new Promise((resolver, rejeitar) => {
    const servidor = net.createServer();
    servidor.listen(0, "127.0.0.1", () => {
      const p = servidor.address().port;
      servidor.close(() => resolver(p));
    });
    servidor.on("error", rejeitar);
  });
}

function definirEstadoInicializacao(estado) {
  estadoInicializacao = estado;
  marco(`estado-${estado}`);
  if (janela && !janela.isDestroyed()) {
    janela.webContents.send("findesk:inicializacao", { estado });
  }
}

async function aguardarBackend() {
  const inicio = Date.now();
  while (Date.now() - inicio < 60000) {
    try {
      const resposta = await fetch(`http://127.0.0.1:${porta}/api/status`, {
        headers: { "X-FinDesk-Token": token },
      });
      if (resposta.ok) {
        const dados = await resposta.json();
        if (dados.inicializado === "true") {
          marco("api-pronta");
          return;
        }
      }
    } catch {
      // backend ainda subindo
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error("o backend Java nao respondeu em 60 segundos");
}

async function iniciarBackend() {
  // reinicio seguro: mata eventual processo anterior sem dialog de saida inesperada
  if (processoBackend && processoBackend.exitCode === null) {
    encerrando = true;
    processoBackend.kill();
    processoBackend = null;
  }
  encerrando = false;

  porta = await portaLivre();
  token = crypto.randomBytes(24).toString("hex");

  const jar = path.join(__dirname, "..", "backend", "target", "findesk-backend-0.1.0.jar");
  if (!fs.existsSync(jar)) {
    throw new Error("backend nao compilado. Execute: mvn -f backend/pom.xml package");
  }

  const proc = spawn("java", ["-jar", jar], {
    env: { ...process.env, SERVER_PORT: String(porta), FINDESK_API_TOKEN: token },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  processoBackend = proc;

  proc.stdout.on("data", (d) => console.log("[backend]", d.toString().trim()));
  proc.stderr.on("data", (d) => console.error("[backend]", d.toString().trim()));
  marco("backend-spawn");
  proc.on("exit", (codigo) => {
    if (proc !== processoBackend) return;
    if (encerrando) return;
    if (estadoInicializacao === "pronto") {
      dialog.showErrorBox(NOME_APP, `O backend encerrou inesperadamente (código ${codigo}).`);
      app.quit();
    } else {
      console.error(`[startup] backend encerrou durante a inicializacao (codigo ${codigo})`);
      definirEstadoInicializacao("falhou");
    }
  });

  await aguardarBackend();
}

function liberarAplicativo() {
  if (!janela || janela.isDestroyed()) return;
  marco("liberando-menu");
  janela.loadFile(path.join(__dirname, "..", "frontend", "html", "menu.html"));
}

async function prepararAplicativo() {
  try {
    await iniciarBackend();
    definirEstadoInicializacao("pronto");
    liberarAplicativo();
  } catch (erro) {
    console.error("[startup] falha na inicializacao:", erro.message);
    definirEstadoInicializacao("falhou");
    throw erro;
  }
}

function criarJanela() {
  const area = screen.getPrimaryDisplay().workAreaSize;
  janela = new BrowserWindow({
    width: Math.min(1500, area.width),
    height: Math.min(950, area.height),
    minWidth: 480,
    minHeight: 480,
    center: true,
    title: NOME_APP,
    backgroundColor: "#fcf9f8",
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  janela.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  janela.webContents.on("will-navigate", (evento) => evento.preventDefault());
  // A janela so aparece quando estiver pronta e ATIVADA pelo SO: sem isso ela
  // sobe sem foco/z-order e os inputs ficam impossiveis de usar.
  janela.once("ready-to-show", () => {
    marco("janela-visivel");
    janela.show();
    janela.setAlwaysOnTop(true);
    janela.moveTop();
    janela.setAlwaysOnTop(false);
    janela.focus();
    janela.webContents.focus();
    marco(janela.isFocused() ? "janela-focada" : "janela-SEM-foco");
  });
  janela.webContents.on("did-finish-load", () => {
    if (!janela || janela.isDestroyed()) return;
    janela.focus();
    janela.webContents.focus();
    marco("interface-carregada");
    if (!menuLiberado && janela.webContents.getURL().includes("menu.html")) {
      menuLiberado = true;
      marco("interacao-liberada");
    }
  });
  marco("janela-criada");
  janela.loadFile(path.join(__dirname, "..", "frontend", "html", "carregando.html"));
  janela.on("closed", () => {
    janela = null;
  });
}

function encerrarBackend() {
  encerrando = true;
  if (processoBackend && processoBackend.exitCode === null) {
    processoBackend.kill();
  }
}

ipcMain.handle("findesk:config", () => ({ port: porta, token }));

ipcMain.handle("findesk:navegar", (_evento, tela) => {
  const destino = TELAS.get(tela);
  if (!destino || !janela) return false;
  janela.loadFile(destino);
  return true;
});

ipcMain.handle("findesk:estado-inicializacao", () => ({ estado: estadoInicializacao }));

ipcMain.handle("findesk:reiniciar-backend", async () => {
  definirEstadoInicializacao("aguardando");
  try {
    await prepararAplicativo();
    return { ok: true };
  } catch {
    return { ok: false };
  }
});

ipcMain.handle("findesk:fechar", () => {
  app.quit();
});

const instanciaUnica = app.requestSingleInstanceLock();
if (!instanciaUnica) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (janela) {
      if (janela.isMinimized()) janela.restore();
      janela.focus();
    }
  });

  app.whenReady()
    .then(() => {
      marco("app-pronto");
      // A janela aparece imediatamente (tela de carregamento); o backend
      // Java/SQLite sobe em paralelo e a interface so e liberada quando a
      // API responder com o banco ja inicializado.
      criarJanela();
      prepararAplicativo().catch(() => {
        // estado 'falhou' ja registrado; a tela oferece tentar novamente/fechar
      });
    })
    .catch((erro) => {
      dialog.showErrorBox(NOME_APP, String(erro));
      app.quit();
    });

  app.on("before-quit", encerrarBackend);
  app.on("window-all-closed", () => {
    app.quit();
  });
}
