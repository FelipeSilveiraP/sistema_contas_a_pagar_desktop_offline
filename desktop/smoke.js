const { app, BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs");

const SAIDA = path.join(__dirname, "..", "docs", "responsivo");
const RESOLUCOES = [
  { w: 480, h: 800 },
  { w: 600, h: 800 },
  { w: 768, h: 800 },
  { w: 960, h: 800 },
  { w: 1280, h: 800 },
  { w: 1536, h: 864 },
  { w: 1920, h: 1000 },
];
const CAPTURAS = [
  { w: 1536, h: 864 },
  { w: 768, h: 800 },
  { w: 480, h: 800 },
];

const SUBMENUS = [
  {
    tela: "controle",
    numBotoes: 3,
    entrada: 'a[data-path="controle-de-contas"]',
    origem: "menu",
    volta: "menu",
    botoes: [
      { sel: 'a[data-modulo="todas-as-contas"]', nome: "TODAS AS CONTAS", tipo: "provisorio" },
      { sel: 'a[data-modulo="contas-recorrentes"]', nome: "CONTAS RECORRENTES", tipo: "nav", destino: "recorrentes" },
      { sel: 'a[data-modulo="pagos"]', nome: "PAGOS", tipo: "provisorio" },
    ],
  },
  {
    tela: "cadastros",
    numBotoes: 2,
    entrada: 'a[data-path="cadastros"]',
    origem: "menu",
    volta: "menu",
    botoes: [
      { sel: 'a[data-modulo="todos-os-cadastros"]', nome: "TODOS OS CADASTROS", tipo: "provisorio" },
      { sel: 'a[data-modulo="novo-cadastro"]', nome: "NOVO CADASTRO", tipo: "nav", destino: "novo-cadastro" },
    ],
  },
  {
    tela: "mensagens",
    numBotoes: 2,
    entrada: 'a[data-path="mensagens-e-avisos"]',
    origem: "menu",
    volta: "menu",
    botoes: [
      { sel: 'a[data-modulo="todas-as-mensagens"]', nome: "TODAS AS MENSAGENS", tipo: "provisorio" },
      { sel: 'a[data-modulo="criar-nova-mensagem"]', nome: "CRIAR NOVA MENSAGEM", tipo: "provisorio" },
    ],
  },
  {
    tela: "recorrentes",
    numBotoes: 2,
    entrada: 'a[data-modulo="contas-recorrentes"]',
    origem: "controle",
    volta: "controle",
    botoes: [
      { sel: 'a[data-modulo="todas-contas-recorrentes"]', nome: "TODAS CONTAS RECORRENTES", tipo: "provisorio" },
      { sel: 'a[data-modulo="cadastrar-nova-recorrente"]', nome: "CADASTRAR NOVA CONTA RECORRENTE", tipo: "provisorio" },
    ],
  },
  {
    tela: "novo-cadastro",
    numBotoes: 3,
    entrada: 'a[data-modulo="novo-cadastro"]',
    origem: "cadastros",
    volta: "cadastros",
    botoes: [
      { sel: 'a[data-modulo="empresa"]', nome: "CADASTRAR NOVA EMPRESA", tipo: "provisorio" },
      { sel: 'a[data-modulo="pagador"]', nome: "CADASTRAR NOVO PAGADOR", tipo: "provisorio" },
      { sel: 'a[data-modulo="banco"]', nome: "CADASTRAR NOVO BANCO", tipo: "provisorio" },
    ],
  },
];

const resultados = [];
const errosConsole = [];
const avisosConsole = [];
let janela = null;

function teste(nome, ok, detalhe = "") {
  resultados.push({ nome, ok, detalhe });
  console.log(`${ok ? "[OK]    " : "[FALHA]"} ${nome}${detalhe ? " — " + detalhe : ""}`);
}

function esperar(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function js(codigo) {
  return janela.webContents.executeJavaScript(codigo);
}

async function esperarTela(tela, timeoutMs = 15000) {
  const inicio = Date.now();
  while (Date.now() - inicio < timeoutMs) {
    try {
      const atual = await js("document.body ? (document.body.dataset.tela || '') : ''");
      if (atual === tela) return true;
    } catch {
      // contexto ainda em carregamento
    }
    await esperar(150);
  }
  return false;
}

async function esperarPredicado(codigo, timeoutMs = 15000) {
  const inicio = Date.now();
  while (Date.now() - inicio < timeoutMs) {
    try {
      if (await js(codigo)) return true;
    } catch {
      // contexto ainda em carregamento
    }
    await esperar(150);
  }
  return false;
}

async function prepararPagina() {
  await esperarPredicado("!!document.body && !!document.body.dataset.tela");
  await esperarPredicado("document.body.dataset.apiStatus !== undefined", 15000);
  await js("window.__alertas = []; window.alert = (m) => { window.__alertas.push(String(m)); }; 'ok'");
}

async function clicar(seletor) {
  return js(`(() => { const el = document.querySelector(${JSON.stringify(seletor)}); if (!el) return false; el.click(); return true; })()`);
}

async function tecla(key) {
  await js(`document.dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(key)}, bubbles: true, cancelable: true }))`);
}

async function lerAlertas() {
  return JSON.parse(await js("JSON.stringify(window.__alertas || [])"));
}

async function navegarPor(seletor, destino) {
  await prepararPagina();
  await clicar(seletor);
  const ok = await esperarTela(destino);
  await prepararPagina();
  return ok;
}

async function voltarPara(destino) {
  await prepararPagina();
  await clicar("#btn-back");
  const ok = await esperarTela(destino);
  await prepararPagina();
  return ok;
}

async function testarProvisorio(seletor, nome) {
  await js("window.__alertas = []");
  await clicar(seletor);
  const alertas = await lerAlertas();
  return alertas.length === 1 && alertas[0].includes(nome);
}

function colunasEsperadas(numBotoes, w) {
  if (w >= 961) return numBotoes >= 3 ? 3 : 2;
  if (w >= 600) return 2;
  return 1;
}

function escanearOffline() {
  const raiz = path.join(__dirname, "..", "frontend");
  const alvos = [];
  const varrer = (dir) => {
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      const cheio = path.join(dir, item.name);
      if (item.isDirectory()) {
        if (item.name === "assets" || item.name === "node_modules") continue;
        varrer(cheio);
      } else if (/\.(html|css|ts|js)$/.test(item.name)) {
        alvos.push(cheio);
      }
    }
  };
  varrer(raiz);
  const externos = [];
  for (const arquivo of alvos) {
    let texto = fs.readFileSync(arquivo, "utf8");
    texto = texto.replace(/\/\*[\s\S]*?\*\//g, " ");
    texto = texto.replace(/data:[^"')\s,]+/g, " ");
    const regex = /https?:\/\/(?!127\.0\.0\.1|localhost|www\.w3\.org)[^\s"'`)<>]+/g;
    for (const achado of texto.match(regex) || []) {
      externos.push(`${path.relative(raiz, arquivo)}: ${achado}`);
    }
  }
  return externos;
}

async function medirTela() {
  return JSON.parse(
    await js(`(() => {
      const grade = document.querySelector(".submenu-grade, .menu-grade");
      const colunas = getComputedStyle(grade).gridTemplateColumns.split(" ").filter(Boolean).length;
      const doc = document.documentElement;
      return JSON.stringify({ colunas, overflow: doc.scrollWidth - doc.clientWidth });
    })()`)
  );
}

app.on("browser-window-created", (_evento, win) => {
  if (janela) return;
  janela = win;
  win.webContents.on("console-message", (...args) => {
    const ev = args[0] || {};
    const alvo = typeof args[1] === "object" && args[1] !== null ? args[1] : ev.details || ev;
    const nivel = typeof args[1] === "number" ? args[1] : (alvo.level ?? alvo.severity ?? 0);
    const msg = typeof args[2] === "string" ? args[2] : String(alvo.message ?? "");
    const texto = String(nivel).toLowerCase();
    if (nivel === 3 || texto === "error") errosConsole.push(msg);
    if (nivel === 2 || texto === "warning" || texto === "warn") avisosConsole.push(msg);
  });
});

require("./main.js");

async function executar() {
  while (!janela) await esperar(100);
  janela.setContentSize(1536, 864);

  console.log("\n=== SMOKE TEST — navegação completa + submenus ===\n");

  // 1. Abertura do Menu + API + segurança
  teste("Abertura do Menu Principal", await esperarPredicado("document.body.dataset.tela === 'menu'"));
  teste(
    "Comunicação com a API (menu)",
    await esperarPredicado("document.body.dataset.apiStatus === 'ok'", 30000),
    `título: ${await js("document.title")}`
  );
  const semNode = await js("typeof window.require === 'undefined' && typeof window.process === 'undefined'");
  teste("Renderer sem acesso a Node/fs (contextIsolation)", semNode === true);
  await js("sessionStorage.setItem('smoke-probe', 'ok')");
  await prepararPagina();

  // 2. Segurança da navegação no Electron
  const navInvalida = await js("window.finDesk.navegar('../../etc/passwd')");
  teste("Navegação bloqueada fora da whitelist", navInvalida === false);
  teste("Tela inalterada após navegação inválida", (await js("document.body.dataset.tela")) === "menu");
  for (const tela of ["controle", "cadastros", "mensagens", "recorrentes", "novo-cadastro", "menu"]) {
    await prepararPagina();
    await js(`window.finDesk.navegar('${tela}')`);
    teste(`Whitelist permite navegar para "${tela}"`, await esperarTela(tela));
  }
  await prepararPagina();

  // 3. Botões do Menu (provisórios)
  for (const [sel, nome] of [
    ['a[data-path="inserir-conta"]', "INSERIR CONTA"],
    ['a[data-path="graficos-e-relatorios"]', "GRÁFICOS"],
  ]) {
    teste(`Botão ${nome} do Menu responde (provisório)`, await testarProvisorio(sel, nome));
  }

  // 4. Atalhos do Menu (regressão)
  for (const [teclaAlvo, nome] of [
    ["F1", "INSERIR CONTA"],
    ["1", "INSERIR CONTA"],
    ["F4", "GRÁFICOS"],
    ["4", "GRÁFICOS"],
  ]) {
    await prepararPagina();
    await js("window.__alertas = []");
    await tecla(teclaAlvo);
    const alertas = await lerAlertas();
    teste(`Atalho ${teclaAlvo} no Menu (${nome})`, alertas.length === 1 && alertas[0].includes(nome));
  }
  for (const [teclaAlvo, destino] of [
    ["F2", "controle"],
    ["2", "controle"],
    ["F3", "mensagens"],
    ["3", "mensagens"],
  ]) {
    await prepararPagina();
    await tecla(teclaAlvo);
    teste(`Atalho ${teclaAlvo} no Menu navega para ${destino}`, await esperarTela(destino));
    await prepararPagina();
    await tecla("Escape");
    teste(`Escape em ${destino} volta ao Menu`, await esperarTela("menu"));
    await prepararPagina();
  }

  // 5. Submenus: entrada, rótulos, botões e VOLTAR
  for (const sub of SUBMENUS) {
    if ((await js("document.body.dataset.tela")) !== sub.origem) {
      await prepararPagina();
      await js(`window.finDesk.navegar('${sub.origem}')`);
      await esperarTela(sub.origem);
      await prepararPagina();
    }
    const entrou = await navegarPor(sub.entrada, sub.tela);
    teste(`${sub.origem} ⇄ ${sub.tela}: navegação de entrada`, entrou);
    teste(`Persistência sessionStorage (pilha do Voltar) em ${sub.tela}`, (await js("String(sessionStorage.getItem('smoke-probe'))")) === "ok");
    const rotulos = JSON.parse(
      await js("JSON.stringify([...document.querySelectorAll('a[data-modulo] span.font-headline')].map(s => s.textContent.trim()))")
    );
    teste(
      `Rótulos corretos em ${sub.tela}`,
      rotulos.length === sub.numBotoes && sub.botoes.every((b, i) => rotulos[i] === b.nome),
      JSON.stringify(rotulos)
    );
    teste(`Botão VOLTAR presente em ${sub.tela}`, (await js("!!document.getElementById('btn-back')")) === true);
    teste(`API respondendo em ${sub.tela}`, (await js("document.body.dataset.apiStatus")) === "ok");
    for (const botao of sub.botoes) {
      if (botao.tipo === "provisorio") {
        teste(`Botão ${botao.nome} responde (provisório)`, await testarProvisorio(botao.sel, botao.nome));
      } else {
        await prepararPagina();
        await clicar(botao.sel);
        teste(`Botão ${botao.nome} navega para ${botao.destino}`, await esperarTela(botao.destino));
        await prepararPagina();
        await clicar("#btn-back");
        teste(`VOLTAR de ${botao.destino} retorna a ${sub.tela}`, await esperarTela(sub.tela));
        await prepararPagina();
      }
    }
    const voltou = await voltarPara(sub.volta);
    teste(`VOLTAR em ${sub.tela} retorna a ${sub.volta}`, voltou);
  }

  // 6. Atalhos nos submenus
  for (const [tela, chaves] of [
    ["mensagens", [["1", "TODAS AS MENSAGENS"], ["2", "CRIAR NOVA MENSAGEM"]]],
    ["novo-cadastro", [["1", "CADASTRAR NOVA EMPRESA"], ["2", "CADASTRAR NOVO PAGADOR"], ["3", "CADASTRAR NOVO BANCO"]]],
  ]) {
    await js(`window.finDesk.navegar('${tela}')`);
    await esperarTela(tela);
    await prepararPagina();
    for (const [teclaAlvo, nome] of chaves) {
      await js("window.__alertas = []");
      await tecla(teclaAlvo);
      const alertas = await lerAlertas();
      teste(`Atalho ${teclaAlvo} em ${tela} (${nome})`, alertas.length === 1 && alertas[0].includes(nome));
    }
    await tecla("Escape");
    teste(`Escape em ${tela} volta ao Menu`, await esperarTela("menu"));
    await prepararPagina();
  }
  // controle: tecla 2 navega para recorrentes
  await js("window.finDesk.navegar('controle')");
  await esperarTela("controle");
  await prepararPagina();
  await tecla("2");
  teste("Atalho 2 em controle navega para recorrentes", await esperarTela("recorrentes"));
  await prepararPagina();
  await tecla("Escape");
  teste("Escape em recorrentes volta ao controle", await esperarTela("controle"));
  await prepararPagina();

  // 7. Pilha profunda: Menu → cadastros → novo-cadastro → VOLTAR → VOLTAR
  await js("window.finDesk.navegar('menu')");
  await esperarTela("menu");
  teste("Pilha profunda: Menu → cadastros", await navegarPor('a[data-path="cadastros"]', "cadastros"));
  teste("Pilha profunda: cadastros → novo-cadastro", await navegarPor('a[data-modulo="novo-cadastro"]', "novo-cadastro"));
  teste("Pilha profunda: VOLTAR → cadastros", await voltarPara("cadastros"));
  teste("Pilha profunda: VOLTAR → menu", await voltarPara("menu"));

  // 8. Navegação repetida sem erros
  let repeticaoOk = true;
  for (let i = 1; i <= 3; i++) {
    for (const rota of [
      ['a[data-path="controle-de-contas"]', "controle", "menu"],
      ['a[data-path="cadastros"]', "cadastros", "menu"],
      ['a[data-path="mensagens-e-avisos"]', "mensagens", "menu"],
    ]) {
      if (!(await navegarPor(rota[0], rota[1]))) repeticaoOk = false;
      if (!(await voltarPara(rota[2]))) repeticaoOk = false;
    }
  }
  teste("Navegação repetida 3x (Menu ⇄ 3 submenus) sem erro", repeticaoOk);

  // 9. Responsividade (medição) + capturas dos submenus
  if (!fs.existsSync(SAIDA)) fs.mkdirSync(SAIDA, { recursive: true });
  const paginas = [
    { tela: "menu", numBotoes: 5 },
    ...SUBMENUS.map((s) => ({ tela: s.tela, numBotoes: s.numBotoes })),
  ];
  for (const pagina of paginas) {
    await js(`window.finDesk.navegar('${pagina.tela}')`);
    await esperarTela(pagina.tela);
    await prepararPagina();
    for (const { w, h } of RESOLUCOES) {
      janela.setContentSize(w, h);
      await esperar(350);
      const medido = await medirTela();
      const esperado = colunasEsperadas(pagina.numBotoes, w);
      teste(
        `Responsividade ${pagina.tela} ${w}x${h} (${esperado} col)`,
        medido.colunas === esperado && medido.overflow <= 1,
        `colunas=${medido.colunas} overflow=${medido.overflow}px`
      );
      if (pagina.tela !== "menu" && CAPTURAS.some((c) => c.w === w && c.h === h)) {
        const imagem = await janela.webContents.capturePage();
        fs.writeFileSync(path.join(SAIDA, `${pagina.tela}-${w}x${h}.png`), imagem.toPNG());
      }
    }
  }

  // 10. Offline + console
  const externos = escanearOffline();
  teste("Offline: nenhuma URL externa em frontend/", externos.length === 0, externos.slice(0, 5).join(" | "));
  teste("Ausência de erros no console", errosConsole.length === 0, errosConsole.slice(0, 3).join(" | "));
  console.log(`\nAvisos de console: ${avisosConsole.length}${avisosConsole.length ? " — " + avisosConsole.slice(0, 3).join(" | ") : ""}`);

  const falhas = resultados.filter((r) => !r.ok);
  console.log(`\n=== RESULTADO: ${resultados.length - falhas.length}/${resultados.length} verificações passaram ===`);
  if (falhas.length) {
    console.log("Falhas:");
    for (const f of falhas) console.log(` - ${f.nome} ${f.detalhe}`);
  }
  console.log(`\nCapturas em ${SAIDA}`);
  app.exitCode = falhas.length ? 1 : 0;
  app.quit();
}

executar().catch((erro) => {
  console.error("ERRO FATAL NO SMOKE:", erro);
  app.exitCode = 1;
  app.quit();
});
