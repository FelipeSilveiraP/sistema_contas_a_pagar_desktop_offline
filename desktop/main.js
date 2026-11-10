const { app, BrowserWindow, dialog, ipcMain, screen, shell } = require("electron");
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

// Diagnostico opcional (FINDESK_DIAG_DIR): registro de eventos de foco/entrada
// para investigar perda de interacao dos inputs. Sem o env, nada e gravado.
const DIAG_DIR = process.env.FINDESK_DIAG_DIR || null;
const DIAG_EVENTOS = DIAG_DIR ? path.join(DIAG_DIR, "eventos.jsonl") : null;
const DIAG_PEDIDOS = DIAG_DIR ? path.join(DIAG_DIR, "requisicoes.jsonl") : null;
const DIAG_RESPOSTAS = DIAG_DIR ? path.join(DIAG_DIR, "respostas.jsonl") : null;

function diagLinha(obj) {
  if (!DIAG_EVENTOS) return;
  try {
    fs.appendFileSync(DIAG_EVENTOS, JSON.stringify({ t: Date.now(), ...obj }) + "\n");
  } catch {
    // diagnostico nunca deve derrubar o app
  }
}

function diagResponder(obj) {
  if (!DIAG_RESPOSTAS) return;
  try {
    fs.appendFileSync(DIAG_RESPOSTAS, JSON.stringify(obj) + "\n");
  } catch {
    // idem
  }
}

function diagPontoNormalizado(cx, cy) {
  const conteudo = janela.getContentBounds();
  const fisico = screen.dipToScreenPoint({ x: Math.round(conteudo.x + cx), y: Math.round(conteudo.y + cy) });
  const display = screen.getPrimaryDisplay();
  const origem = screen.dipToScreenPoint({ x: 0, y: 0 });
  const fim = screen.dipToScreenPoint({ x: display.bounds.width, y: display.bounds.height });
  return {
    x: Math.round(((fisico.x - origem.x) / (fim.x - origem.x)) * 65535),
    y: Math.round(((fisico.y - origem.y) / (fim.y - origem.y)) * 65535),
    px: fisico.x,
    py: fisico.y,
  };
}

function diagColetarRenderer() {
  if (!DIAG_DIR || !janela || janela.isDestroyed()) return;
  janela.webContents
    .executeJavaScript(
      `(() => { try { return JSON.stringify(window.__diagColetar ? window.__diagColetar() : []); } catch { return "[]"; } })()`
    )
    .then((texto) => {
      try {
        for (const evento of JSON.parse(texto || "[]")) {
          diagLinha({ camada: "renderer", ...evento });
        }
      } catch {
        // resposta invalida
      }
    })
    .catch(() => {
      // pagina carregando
    });
}

function diagProcessarPedidos() {
  if (!DIAG_PEDIDOS || !janela || janela.isDestroyed()) return;
  let linhas;
  try {
    if (!fs.existsSync(DIAG_PEDIDOS)) return;
    linhas = fs.readFileSync(DIAG_PEDIDOS, "utf8").split("\n").filter((l) => l.trim());
    if (!linhas.length) return;
    fs.writeFileSync(DIAG_PEDIDOS, "");
  } catch {
    return;
  }
  for (const linha of linhas) {
    let pedido;
    try {
      pedido = JSON.parse(linha);
    } catch {
      continue;
    }
    if (pedido.acao === "rect") {
      janela.webContents
        .executeJavaScript(
          `(() => { const el = document.querySelector(${JSON.stringify(pedido.seletor)}); if (!el) return null; const r = el.getBoundingClientRect(); return JSON.stringify({ x: r.x + r.width / 2, y: r.y + r.height / 2 }); })()`
        )
        .then((texto) => {
          const p = texto ? JSON.parse(texto) : null;
          diagResponder({ id: pedido.id, ok: Boolean(p), ponto: p ? diagPontoNormalizado(p.x, p.y) : null });
        })
        .catch(() => diagResponder({ id: pedido.id, ok: false, ponto: null }));
    } else if (pedido.acao === "estado") {
      janela.webContents
        .executeJavaScript(
          `(() => {
            const a = document.activeElement;
            const campo = (id) => { const el = document.getElementById(id); return el && typeof el.value === "string" ? el.value.length : null; };
            return JSON.stringify({
              tela: document.body.dataset.tela || null,
              pronto: document.body.dataset.pronto || null,
              hasFocus: document.hasFocus(),
              ativo: a ? a.tagName + (a.id ? "#" + a.id : "") : null,
              menuAberto: document.getElementById("nav-global") ? document.getElementById("nav-global").dataset.menuAberto : null,
              dialogoAberto: Boolean(document.querySelector("[data-dialogo]")),
              comprimentos: {
                campoInstituicao: campo("campo-instituicao"),
                campoNome: campo("campo-nome"),
                campoRazao: campo("campo-razao-social"),
                campoPesquisa: campo("campo-pesquisa"),
              },
            });
          })()`
        )
        .then((texto) => diagResponder({ id: pedido.id, ok: true, estado: JSON.parse(texto) }))
        .catch(() => diagResponder({ id: pedido.id, ok: false, estado: null }));
    }
  }
}

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
  ["todos-cadastros", path.join(__dirname, "..", "frontend", "html", "todos-cadastros.html")],
  ["inserir-conta", path.join(__dirname, "..", "frontend", "html", "inserir-conta.html")],
  ["todas-as-contas", path.join(__dirname, "..", "frontend", "html", "todas-as-contas.html")],
  ["pagos", path.join(__dirname, "..", "frontend", "html", "pagos.html")],
  ["recorrentes-tabela", path.join(__dirname, "..", "frontend", "html", "recorrentes-tabela.html")],
  ["form-recorrente", path.join(__dirname, "..", "frontend", "html", "form-recorrente.html")],
  ["todas-as-mensagens", path.join(__dirname, "..", "frontend", "html", "todas-as-mensagens.html")],
  ["criar-mensagem", path.join(__dirname, "..", "frontend", "html", "criar-mensagem.html")],
  ["graficos", path.join(__dirname, "..", "frontend", "html", "graficos.html")],
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
  if (DIAG_DIR) {
    for (const evento of ["focus", "blur", "minimize", "restore", "show", "hide"]) {
      janela.on(evento, () => diagLinha({ camada: "janela", tipo: evento, focada: janela.isFocused() }));
    }
    janela.webContents.on("before-input-event", (_evento, entrada) => {
      diagLinha({
        camada: "electron",
        tipo: "before-input",
        entradaTipo: entrada.type,
        tecla: entrada.key && entrada.key.length > 1 ? entrada.key : "*",
      });
    });
    setInterval(() => {
      diagProcessarPedidos();
      diagColetarRenderer();
    }, 250);
  }
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
    diagLinha({ camada: "janela", tipo: "did-finish-load", url: janela.webContents.getURL().split("/").pop(), focada: janela.isFocused() });
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

// Reparo de foco da pagina apos fechar dialogos modais nativos (alert/confirm):
// o Chromium/Windows devolve a janela como ativa sem re-emitir o ciclo de foco
// do widget (document.hasFocus() fica falso e o teclado e engolido). Um ciclo
// blur->focus na janela re-sincroniza o foco da pagina (mesmo mecanismo que
// restaura o uso apos minimizar/restaurar — ver smoke-dev.js).
ipcMain.handle("findesk:reparar-foco", () => {
  if (!janela || janela.isDestroyed()) return false;
  janela.blur();
  janela.focus();
  janela.webContents.focus();
  return true;
});

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

// Nota fiscal (PDF anexado a uma conta): grava direto em Downloads, sem a
// janela nativa "Salvar como" (dialogos modais nativos causavam o bug de foco).
// O renderer manda os bytes; o main valida tamanho/nome e so abre arquivos
// dentro desta pasta.
const LIMITE_NOTA_BYTES = 16 * 1024 * 1024;

function pastaNotas() {
  return path.join(app.getPath("downloads"), "Chaveiro Universal - Notas Fiscais");
}

function nomeSeguro(nome) {
  const base = String(nome || "nota-fiscal.pdf").replace(/[\\/:*?"<>|\x00-\x1f]/g, "_").slice(0, 120);
  return base.toLowerCase().endsWith(".pdf") ? base : `${base}.pdf`;
}

ipcMain.handle("findesk:salvar-nota", (_evento, nome, bytes) => {
  if (!(bytes instanceof Uint8Array) || bytes.length === 0 || bytes.length > LIMITE_NOTA_BYTES) {
    return { ok: false };
  }
  const pasta = pastaNotas();
  fs.mkdirSync(pasta, { recursive: true });
  const arquivo = nomeSeguro(nome);
  let destino = path.join(pasta, arquivo);
  for (let n = 2; fs.existsSync(destino); n++) {
    destino = path.join(pasta, arquivo.replace(/\.pdf$/i, ` (${n}).pdf`));
  }
  fs.writeFileSync(destino, Buffer.from(bytes));
  return { ok: true, caminho: destino };
});

function pastaRelatorios() {
  return path.join(app.getPath("downloads"), "Chaveiro Universal - Relatórios");
}

// Abre SO arquivos gerados pelo app (notas fiscais e relatorios) no programa padrao.
async function abrirGerado(caminho) {
  const alvo = path.resolve(String(caminho || ""));
  const permitido = [pastaNotas(), pastaRelatorios()].some((p) => alvo.startsWith(p + path.sep));
  if (!permitido || !fs.existsSync(alvo)) return false;
  return (await shell.openPath(alvo)) === "";
}

ipcMain.handle("findesk:abrir-nota", (_evento, caminho) => abrirGerado(caminho));
ipcMain.handle("findesk:abrir-arquivo", (_evento, caminho) => abrirGerado(caminho));

// Impressao: gera PDF da tela atual (CSS @media print esconde navbar/botoes) em
// Downloads e o usuario imprime pelo leitor de PDF — sem a janela nativa de
// impressao, que e modal e causava o bug de foco dos inputs.
ipcMain.handle("findesk:imprimir-pdf", async (_evento, nome) => {
  if (!janela || janela.isDestroyed()) return { ok: false };
  const agora = new Date();
  const carimbo = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}-${String(agora.getDate()).padStart(2, "0")} ${String(agora.getHours()).padStart(2, "0")}h${String(agora.getMinutes()).padStart(2, "0")}`;
  const base = String(nome || "Relatorio").replace(/[^A-Za-z0-9 _-]/g, "_").slice(0, 40);
  const pasta = pastaRelatorios();
  fs.mkdirSync(pasta, { recursive: true });
  const destino = path.join(pasta, `${base} - ${carimbo}.pdf`);
  const pdf = await janela.webContents.printToPDF({ printBackground: true, landscape: true, pageSize: "A4" });
  fs.writeFileSync(destino, pdf);
  await shell.openPath(destino);
  return { ok: true, caminho: destino };
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
  app.on("browser-window-focus", () => diagLinha({ camada: "app", tipo: "browser-window-focus" }));
  app.on("browser-window-blur", () => diagLinha({ camada: "app", tipo: "browser-window-blur" }));
  app.on("window-all-closed", () => {
    app.quit();
  });
}
