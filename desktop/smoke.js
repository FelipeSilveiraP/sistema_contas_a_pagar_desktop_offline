const { app, BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");

// Banco de dados isolado: os testes nunca tocam a base real do usuario
const BANCO_SMOKE = path.join(os.tmpdir(), "contas-a-pagar-smoke.db");
for (const sufixo of ["", "-wal", "-shm"]) {
  try { fs.unlinkSync(BANCO_SMOKE + sufixo); } catch { /* nao existia */ }
}
process.env.FINDESK_DB_PATH = BANCO_SMOKE;

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
const BREAKPOINT_BARRA = 851;

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
      { sel: 'a[data-modulo="todos-os-cadastros"]', nome: "TODOS OS CADASTROS", tipo: "nav", destino: "todos-cadastros" },
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
      { sel: 'a[data-modulo="empresa"]', nome: "CADASTRAR NOVA EMPRESA", tipo: "nav", destino: "form-empresa" },
      { sel: 'a[data-modulo="pagador"]', nome: "CADASTRAR NOVO PAGADOR", tipo: "nav", destino: "form-pagador" },
      { sel: 'a[data-modulo="banco"]', nome: "CADASTRAR NOVO BANCO", tipo: "nav", destino: "form-banco" },
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
      // tela + componentes inicializados (dataset.pronto setado pelo main.ts)
      const pronta = await js(`document.body && document.body.dataset.tela === ${JSON.stringify(tela)} && document.body.dataset.pronto === 'true'`);
      if (pronta) return true;
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
  await clicar('.nav-barra button[data-nav="voltar"]');
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

async function estadoMenu() {
  return JSON.parse(
    await js(`(() => {
      const raiz = document.getElementById('nav-global');
      const painel = document.querySelector('.nav-painel');
      const veu = document.querySelector('.nav-veu');
      const hamb = document.querySelector('.nav-hamburguer');
      const linhas = document.querySelectorAll('.nav-hamburguer__linha');
      const cs = (el) => (el ? getComputedStyle(el) : null);
      return JSON.stringify({
        aberto: raiz ? raiz.dataset.menuAberto : null,
        aria: hamb ? hamb.getAttribute('aria-expanded') : null,
        painelVisivel: cs(painel) ? cs(painel).visibility : null,
        painelTransform: cs(painel) ? cs(painel).transform : null,
        veuOpacidade: cs(veu) ? cs(veu).opacity : null,
        linha1: cs(linhas[0]) ? cs(linhas[0]).transform : null,
        linha2Opacidade: cs(linhas[1]) ? cs(linhas[1]).opacity : null,
        linha3: cs(linhas[2]) ? cs(linhas[2]).transform : null,
      });
    })()`)
  );
}

async function rectsCartoes() {
  return JSON.parse(
    await js(`JSON.stringify([...document.querySelectorAll('a[data-modulo]')].map((el) => {
      const r = el.getBoundingClientRect();
      return { x: +r.x.toFixed(2), y: +r.y.toFixed(2), w: +r.width.toFixed(2), h: +r.height.toFixed(2) };
    }))`)
  );
}

async function rectsCartoesEstavel() {
  let anterior = null;
  for (let i = 0; i < 12; i++) {
    const atual = await rectsCartoes();
    if (anterior && JSON.stringify(atual) === JSON.stringify(anterior)) return atual;
    anterior = atual;
    await esperar(200);
  }
  return anterior;
}

function rectsIguais(a, b) {
  return (
    a.length === b.length &&
    a.every(
      (r, i) =>
        Math.abs(r.x - b[i].x) < 0.5 &&
        Math.abs(r.y - b[i].y) < 0.5 &&
        Math.abs(r.w - b[i].w) < 0.5 &&
        Math.abs(r.h - b[i].h) < 0.5
    )
  );
}

function simetriaCentral(rects, largura) {
  if (!rects.length) return false;
  const esquerda = Math.min(...rects.map((r) => r.x));
  const direita = Math.max(...rects.map((r) => r.x + r.w));
  return Math.abs(esquerda - (largura - direita)) < 2;
}

  async function corBotaoNav(chave) {
    return js(`(() => { const el = document.querySelector('.nav-barra button[data-nav="${chave}"]'); return el ? getComputedStyle(el).backgroundColor : ''; })()`);
  }

async function capturar(nome) {
  if (janela.isMinimized()) janela.restore();
  const imagem = await janela.webContents.capturePage();
  fs.writeFileSync(path.join(SAIDA, nome), imagem.toPNG());
}

async function definirTamanho(w, h) {
  if (janela.isMinimized()) janela.restore();
  let anterior = null;
  let iguais = 0;
  for (let i = 0; i < 25; i++) {
    janela.setContentSize(w, h);
    await esperar(400);
    try {
      const d = JSON.parse(await js("JSON.stringify({ w: window.innerWidth, h: window.innerHeight })"));
      if (Math.abs(d.w - w) <= 2 && Math.abs(d.h - h) <= 2) {
        await esperar(300);
        return true;
      }
      if (anterior && Math.abs(d.w - anterior.w) <= 2 && Math.abs(d.h - anterior.h) <= 2) {
        iguais++;
        if (iguais >= 3 && i >= 10) {
          await esperar(300);
          return true;
        }
      } else {
        iguais = 0;
      }
      anterior = d;
    } catch {
      // renderer em carregamento
    }
  }
  console.log(`  [aviso] janela não estabilizou em ${w}x${h}`);
  return false;
}

async function medirTelaEstavel() {
  let anterior = null;
  for (let i = 0; i < 12; i++) {
    const atual = await medirTela();
    if (anterior && JSON.stringify(atual) === JSON.stringify(anterior)) return atual;
    anterior = atual;
    await esperar(200);
  }
  return anterior;
}

async function abrirMenu() {
  for (let tentativa = 1; tentativa <= 3; tentativa++) {
    await clicar(".nav-hamburguer");
    const ok = await esperarPredicado("document.getElementById('nav-global')?.dataset.menuAberto === 'true'", 3000);
    if (ok) break;
    console.log(`  [retry abrirMenu tentativa ${tentativa}]`);
  }
  await esperar(350);
}

async function fecharMenu() {
  for (let tentativa = 1; tentativa <= 3; tentativa++) {
    await clicar(".nav-hamburguer");
    const ok = await esperarPredicado("document.getElementById('nav-global')?.dataset.menuAberto === 'false'", 3000);
    if (ok) break;
    console.log(`  [retry fecharMenu tentativa ${tentativa}]`);
  }
  await esperar(350);
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
      const colunas = grade ? getComputedStyle(grade).gridTemplateColumns.split(" ").filter(Boolean).length : 0;
      const doc = document.documentElement;
      const barra = document.querySelector(".nav-barra");
      const hamb = document.querySelector(".nav-hamburguer");
      const visivel = (el) => !!el && getComputedStyle(el).display !== "none";
      return JSON.stringify({
        colunas,
        overflow: doc.scrollWidth - doc.clientWidth,
        barraVisivel: visivel(barra),
        hambVisivel: visivel(hamb),
        barraCabe: barra ? barra.scrollWidth - barra.clientWidth : 0,
        vw: window.innerWidth,
      });
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
  // blindagem: a janela de teste não pode ser arrastada/redimensionada pelo usuário
  try {
    janela.setMovable(false);
    janela.setIgnoreMouseEvents(true);
    janela.setAlwaysOnTop(true);
  } catch {
    // plataformas sem suporte
  }
  await definirTamanho(1536, 864);

  console.log("\n=== SMOKE TEST — navbar global + navegação completa ===\n");

    // 1. Abertura do Menu + API + segurança
    teste("Abertura do Menu Principal", await esperarPredicado("document.body.dataset.tela === 'menu'", 30000));
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
  for (const tela of ["controle", "cadastros", "mensagens", "recorrentes", "novo-cadastro", "todos-cadastros", "menu"]) {
    await prepararPagina();
    await js(`window.finDesk.navegar('${tela}')`);
    teste(`Whitelist permite navegar para "${tela}"`, await esperarTela(tela));
  }
  await prepararPagina();

  // 3. Botões do Menu (provisórios) + 4. atalhos do Menu (regressão)
  for (const [sel, nome] of [
    ['a[data-path="inserir-conta"]', "INSERIR CONTA"],
    ['a[data-path="graficos-e-relatorios"]', "GRÁFICOS"],
  ]) {
    teste(`Botão ${nome} do Menu responde (provisório)`, await testarProvisorio(sel, nome));
  }
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

  // 5. Navbar desktop: ordem, destinos, destaque ativo
  await js("window.finDesk.navegar('controle')");
  await esperarTela("controle");
  await prepararPagina();
  const ordem = JSON.parse(
    await js("JSON.stringify([...document.querySelectorAll('.nav-barra button[data-nav]')].map(b => b.dataset.nav))")
  );
  teste(
    "Barra desktop: ordem VOLTAR/MENU/CADASTROS/CONTROLE/MENSAGENS/GRÁFICOS",
    JSON.stringify(ordem) === JSON.stringify(["voltar", "menu", "cadastros", "controle", "mensagens", "graficos"]),
    JSON.stringify(ordem)
  );
  teste("Botao CONTROLE com fundo branco por padrao", (await corBotaoNav("controle")) === "rgb(255, 255, 255)", await corBotaoNav("controle"));

  // GRÁFICOS = provisório; MENU PRINCIPAL navega; destinos a partir de tela profunda
  teste("Navbar GRÁFICOS responde (provisório)", await testarProvisorio('.nav-barra button[data-nav="graficos"]', "GRÁFICOS"));
  await prepararPagina();
  await clicar('.nav-barra button[data-nav="menu"]');
  teste("Navbar MENU PRINCIPAL navega ao Menu", await esperarTela("menu"));
  teste("Menu Principal aprovado permanece sem navbar", (await js("!!document.getElementById('nav-global')")) === false);
  teste("Pilha profunda: Menu → cadastros", await navegarPor('a[data-path="cadastros"]', "cadastros"));
  teste("Botao CADASTROS com fundo branco por padrao", (await corBotaoNav("cadastros")) === "rgb(255, 255, 255)");
  teste("Pilha profunda: cadastros → novo-cadastro", await navegarPor('a[data-modulo="novo-cadastro"]', "novo-cadastro"));
  teste("Botao CADASTROS branco tambem em tela filha", (await corBotaoNav("cadastros")) === "rgb(255, 255, 255)");
  await prepararPagina();
  await clicar('.nav-barra button[data-nav="controle"]');
  teste("Da tela profunda (novo-cadastro), CONTROLE navega direto", await esperarTela("controle"));
  teste("VOLTAR preserva histórico após salto de módulo", await voltarPara("novo-cadastro"));
  await prepararPagina();
  await clicar('.nav-barra button[data-nav="mensagens"]');
  teste("Da tela profunda, MENSAGENS navega direto", await esperarTela("mensagens"));
  teste("Botao MENSAGENS com fundo branco por padrao", (await corBotaoNav("mensagens")) === "rgb(255, 255, 255)");
  await prepararPagina();
  await clicar('.nav-barra button[data-nav="menu"]');
  teste("Da tela profunda, MENU PRINCIPAL navega direto", await esperarTela("menu"));
  await prepararPagina();

  // 6. Submenus: entrada, rótulos, botões e VOLTAR
  for (const sub of SUBMENUS) {
    if ((await js("document.body.dataset.tela")) !== sub.origem) {
      await prepararPagina();
      await js(`window.finDesk.navegar('${sub.origem}')`);
      await esperarTela(sub.origem);
      await prepararPagina();
    }
    teste(`${sub.origem} ⇄ ${sub.tela}: navegação de entrada`, await navegarPor(sub.entrada, sub.tela));
    teste(`Persistência sessionStorage (pilha do Voltar) em ${sub.tela}`, (await js("String(sessionStorage.getItem('smoke-probe'))")) === "ok");
    const rotulos = JSON.parse(
      await js("JSON.stringify([...document.querySelectorAll('a[data-modulo] span.font-headline')].map(s => s.textContent.trim()))")
    );
    teste(
      `Rótulos corretos em ${sub.tela}`,
      rotulos.length === sub.numBotoes && sub.botoes.every((b, i) => rotulos[i] === b.nome),
      JSON.stringify(rotulos)
    );
    teste(`Navbar VOLTAR presente em ${sub.tela}`, (await js('!!document.querySelector(\'.nav-barra button[data-nav="voltar"]\')')) === true);
    teste(`API respondendo em ${sub.tela}`, (await js("document.body.dataset.apiStatus")) === "ok");
    for (const botao of sub.botoes) {
      if (botao.tipo === "provisorio") {
        teste(`Botão ${botao.nome} responde (provisório)`, await testarProvisorio(botao.sel, botao.nome));
      } else {
        await prepararPagina();
        await clicar(botao.sel);
        teste(`Botão ${botao.nome} navega para ${botao.destino}`, await esperarTela(botao.destino));
        await prepararPagina();
        await clicar('.nav-barra button[data-nav="voltar"]');
        teste(`VOLTAR de ${botao.destino} retorna a ${sub.tela}`, await esperarTela(sub.tela));
        await prepararPagina();
      }
    }
    teste(`VOLTAR em ${sub.tela} retorna a ${sub.volta}`, await voltarPara(sub.volta));
  }

  // 7. Atalhos nos submenus (regressão)
  for (const [tela, chaves] of [
    ["mensagens", [["1", "TODAS AS MENSAGENS"], ["2", "CRIAR NOVA MENSAGEM"]]],
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

  // 7b. Atalhos em Novo Cadastro (os 3 navegam aos forms)
  await js("window.finDesk.navegar('novo-cadastro')");
  await esperarTela("novo-cadastro");
  await prepararPagina();
  await tecla("1");
  teste("Atalho 1 em novo-cadastro navega para o form-empresa", await esperarTela("form-empresa"));
  await prepararPagina();
  await tecla("Escape");
  teste("Escape em form-empresa volta a novo-cadastro", await esperarTela("novo-cadastro"));
  await prepararPagina();
  await tecla("2");
  teste("Atalho 2 em novo-cadastro navega para o form-pagador", await esperarTela("form-pagador"));
  await prepararPagina();
  await tecla("Escape");
  teste("Escape em form-pagador volta a novo-cadastro", await esperarTela("novo-cadastro"));
  await prepararPagina();
  await tecla("3");
  teste("Atalho 3 em novo-cadastro navega para o form-banco", await esperarTela("form-banco"));
  await prepararPagina();
  await tecla("Escape");
  teste("Escape em form-banco volta a novo-cadastro", await esperarTela("novo-cadastro"));
  await prepararPagina();

  // 7c. Formulario de Banco (Entrega 3.1) — validacao, CRUD pela API, dirty-form
  await definirTamanho(1536, 864);
  await js("window.finDesk.navegar('form-banco')");
  await esperarTela("form-banco");
  await prepararPagina();
  const camposForm = JSON.parse(
    await js(`JSON.stringify({
      instituicao: !!document.getElementById('campo-instituicao'),
      chavePix: !!document.getElementById('campo-chave-pix'),
      salvar: !!document.getElementById('btn-salvar'),
      cancelar: !!document.getElementById('btn-cancelar'),
      navbar: !!document.querySelector('#nav-global .nav-barra'),
    })`)
  );
  teste("Form Banco: campos, acoes e navbar presentes", Object.values(camposForm).every(Boolean), JSON.stringify(camposForm));
  teste("Form Banco: botao CADASTROS branco na navbar", (await corBotaoNav("cadastros")) === "rgb(255, 255, 255)", await corBotaoNav("cadastros"));

  await clicar("#btn-salvar");
  await esperar(400);
  const errosVazio = JSON.parse(
    await js(`JSON.stringify([...document.querySelectorAll('.campo-erro')].filter(e => !e.classList.contains('hidden')).map(e => e.dataset.erroCampo))`)
  );
  teste(
    "Form Banco: submit vazio mostra erro no campo obrigatorio",
    errosVazio.includes("instituicao") && !errosVazio.includes("chavePix"),
    JSON.stringify(errosVazio)
  );
  await js(`(() => { document.getElementById('campo-instituicao').value = 'Banco Teste'; document.getElementById('campo-chave-pix').value = 'chave invalida'; return true; })()`);
  await clicar("#btn-salvar");
  await esperar(400);
  const erroPix = await js(`!document.querySelector('[data-erro-campo="chavePix"]').classList.contains('hidden')`);
  teste("Form Banco: chave Pix com espacos e recusada", erroPix === true);

  const nomeBanco = `BANCO SMOKE ${Date.now()}`;
  await js(`(() => {
    document.getElementById('campo-instituicao').value = ${JSON.stringify(nomeBanco)};
    document.getElementById('campo-chave-pix').value = 'pix@exemplo.com';
    for (const id of ['campo-instituicao','campo-chave-pix'])
      document.getElementById(id).dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  await clicar("#btn-salvar");
  const salvoOk = await esperarPredicado(`document.body.dataset.bancoSalvo !== undefined`, 10000);
  teste("Form Banco: salvar com dados validos confirma cadastro", salvoOk);
  const feedback = await js(`document.getElementById('feedback-banco').textContent`);
  teste("Form Banco: mensagem de sucesso exibida", String(feedback).includes("sucesso"), String(feedback));
  teste("Form Banco: campos limpos apos salvar", (await js(`document.getElementById('campo-instituicao').value`)) === "");

  const cfg = JSON.parse(await js(`(async () => JSON.stringify(await window.finDesk.config()))()`));
  const lista = JSON.parse(
    await js(`(async () => {
      const r = await fetch('http://127.0.0.1:${cfg.port}/api/bancos', { headers: { 'X-FinDesk-Token': '${cfg.token}' } });
      return JSON.stringify(await r.json());
    })()`)
  );
  const encontrado = lista.find((b) => b.instituicao === nomeBanco);
  teste("Form Banco: registro persistido consultavel pela API", Boolean(encontrado), JSON.stringify(encontrado ?? null));

  if (encontrado) {
    const statusDelete = await js(`(async () => {
      const r = await fetch('http://127.0.0.1:${cfg.port}/api/bancos/${encontrado.id}', { method: 'DELETE', headers: { 'X-FinDesk-Token': '${cfg.token}' } });
      return r.status;
    })()`);
    teste("API DELETE exclui o banco de teste (204)", statusDelete === 204, String(statusDelete));
    const statusApos = await js(`(async () => {
      const r = await fetch('http://127.0.0.1:${cfg.port}/api/bancos/${encontrado.id}', { headers: { 'X-FinDesk-Token': '${cfg.token}' } });
      return r.status;
    })()`);
    teste("API GET apos exclusao retorna 404", statusApos === 404, String(statusApos));
  }

  // fluxo de navegacao completo pela UI (Menu -> Cadastros -> Novo Cadastro -> Banco)
  await js("window.finDesk.navegar('menu')");
  await esperarTela("menu");
  await prepararPagina();
  teste("Fluxo UI: Menu -> cadastros", await navegarPor('a[data-path="cadastros"]', "cadastros"));
  teste("Fluxo UI: cadastros -> novo-cadastro", await navegarPor('a[data-modulo="novo-cadastro"]', "novo-cadastro"));
  teste("Fluxo UI: novo-cadastro -> banco (form-banco)", await navegarPor('a[data-modulo="banco"]', "form-banco"));

  // dirty-form: confirmacao ao abandonar com alteracoes nao salvas
  await js(`window.__confirmas = []; window.__confirmResposta = false; sessionStorage.setItem('smoke-confirmas', '[]'); window.confirm = (m) => { window.__confirmas.push(String(m)); sessionStorage.setItem('smoke-confirmas', JSON.stringify(window.__confirmas)); return window.__confirmResposta; }; 'ok'`);
  await js(`(() => { const el = document.getElementById('campo-instituicao'); el.value = 'Alteracao nao salva'; el.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
  await clicar('.nav-barra button[data-nav="voltar"]');
  await esperar(400);
  const confirmas1 = JSON.parse(await js(`sessionStorage.getItem('smoke-confirmas') || '[]'`));
  teste("Form Banco: VOLTAR com alteracoes nao salvas pede confirmacao", confirmas1.length === 1);
  teste("Form Banco: cancelamento da confirmacao mantem na tela", (await js("document.body.dataset.tela")) === "form-banco");
  await js("window.__confirmResposta = true");
  await clicar('.nav-barra button[data-nav="voltar"]');
  teste("Form Banco: confirmacao aceita VOLTAR a novo-cadastro", await esperarTela("novo-cadastro"));
  await prepararPagina();
  await navegarPor('a[data-modulo="banco"]', "form-banco");
  await js(`window.__confirmas = []; window.__confirmResposta = true; sessionStorage.setItem('smoke-confirmas', '[]'); window.confirm = (m) => { window.__confirmas.push(String(m)); sessionStorage.setItem('smoke-confirmas', JSON.stringify(window.__confirmas)); return window.__confirmResposta; }; 'ok'`);
  await js(`(() => { const el = document.getElementById('campo-instituicao'); el.value = 'x'; el.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
  await clicar("#btn-cancelar");
  await esperar(400);
  const confirmas2 = JSON.parse(await js(`sessionStorage.getItem('smoke-confirmas') || '[]'`));
  teste("Form Banco: CANCELAR sujo pede confirmacao e sai", confirmas2.length === 1 && (await js("document.body.dataset.tela")) !== "form-banco");

  // estabilidade dos campos com menu lateral aberto + capturas
  await js(`window.confirm = () => true; 'ok'`);
  await js("window.finDesk.navegar('form-banco')");
  await esperarTela("form-banco");
  await prepararPagina();
  await definirTamanho(480, 800);
  const camposAntes = JSON.parse(await js(`JSON.stringify([...document.querySelectorAll('.form-campo')].map(el => { const r = el.getBoundingClientRect(); return [+r.x.toFixed(1), +r.y.toFixed(1), +r.width.toFixed(1), +r.height.toFixed(1)]; }))`));
  await abrirMenu();
  const camposAberto = JSON.parse(await js(`JSON.stringify([...document.querySelectorAll('.form-campo')].map(el => { const r = el.getBoundingClientRect(); return [+r.x.toFixed(1), +r.y.toFixed(1), +r.width.toFixed(1), +r.height.toFixed(1)]; }))`));
  await fecharMenu();
  teste("Form Banco: campos estaveis com menu lateral aberto (480x800)", JSON.stringify(camposAntes) === JSON.stringify(camposAberto));
  await capturar("form-banco-480x800.png");
  await definirTamanho(768, 800);
  await capturar("form-banco-768x800.png");
  await definirTamanho(1536, 864);
  await capturar("form-banco-1536x864.png");
  teste("Form Banco: barra desktop visivel a partir de 900px", (await medirTela()).barraVisivel === true);
  await definirTamanho(480, 800);
  teste("Form Banco: hamburguer visivel abaixo de 900px", (await medirTela()).hambVisivel === true);
  await definirTamanho(1536, 864);

  // 7d. Formulario de Pagador (Entrega 3.2) — validacao, CRUD pela API, capturas
  await js("window.finDesk.navegar('form-pagador')");
  await esperarTela("form-pagador");
  await prepararPagina();
  const camposPagador = JSON.parse(
    await js(`JSON.stringify({
      nome: !!document.getElementById('campo-nome'),
      cpf: !!document.getElementById('campo-cpf'),
      funcao: !!document.getElementById('campo-funcao'),
      salvar: !!document.getElementById('btn-salvar'),
      cancelar: !!document.getElementById('btn-cancelar'),
      navbar: !!document.querySelector('#nav-global .nav-barra'),
    })`)
  );
  teste("Form Pagador: campos, acoes e navbar presentes", Object.values(camposPagador).every(Boolean), JSON.stringify(camposPagador));
  teste("Form Pagador: botao CADASTROS branco na navbar", (await corBotaoNav("cadastros")) === "rgb(255, 255, 255)", await corBotaoNav("cadastros"));

  await clicar("#btn-salvar");
  await esperar(400);
  const errosPagVazio = JSON.parse(
    await js(`JSON.stringify([...document.querySelectorAll('.campo-erro')].filter(e => !e.classList.contains('hidden')).map(e => e.dataset.erroCampo))`)
  );
  teste(
    "Form Pagador: submit vazio mostra erro so em nome (cpf e funcao opcionais)",
    errosPagVazio.includes("nome") && !errosPagVazio.includes("cpf") && !errosPagVazio.includes("funcao"),
    JSON.stringify(errosPagVazio)
  );
  await js(`(() => { document.getElementById('campo-nome').value = 'Pagador Teste'; document.getElementById('campo-cpf').value = '12345678900'; return true; })()`);
  await clicar("#btn-salvar");
  await esperar(400);
  const erroCpf = await js(`!document.querySelector('[data-erro-campo="cpf"]').classList.contains('hidden')`);
  teste("Form Pagador: CPF preenchido com digitos invalidos e recusado", erroCpf === true);

  const nomePagador = `PAGADOR SMOKE ${Date.now()}`;
  await js(`(() => {
    document.getElementById('campo-nome').value = ${JSON.stringify(nomePagador)};
    document.getElementById('campo-cpf').value = '529.982.247-25';
    document.getElementById('campo-funcao').value = 'Gerente';
    for (const id of ['campo-nome','campo-cpf','campo-funcao'])
      document.getElementById(id).dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  await clicar("#btn-salvar");
  const pagadorSalvoOk = await esperarPredicado(`document.body.dataset.pagadorSalvo !== undefined`, 10000);
  teste("Form Pagador: salvar com dados validos confirma cadastro", pagadorSalvoOk);
  const feedbackPag = await js(`document.getElementById('feedback-pagador').textContent`);
  teste("Form Pagador: mensagem de sucesso exibida", String(feedbackPag).includes("sucesso"), String(feedbackPag));
  teste("Form Pagador: campos limpos apos salvar", (await js(`document.getElementById('campo-nome').value`)) === "");

  const cfgPag = JSON.parse(await js(`(async () => JSON.stringify(await window.finDesk.config()))()`));
  const listaPag = JSON.parse(
    await js(`(async () => {
      const r = await fetch('http://127.0.0.1:${cfgPag.port}/api/pagadores', { headers: { 'X-FinDesk-Token': '${cfgPag.token}' } });
      return JSON.stringify(await r.json());
    })()`)
  );
  const encontradoPag = listaPag.find((p) => p.nome === nomePagador && p.cpf === "52998224725");
  teste("Form Pagador: registro persistido consultavel pela API", Boolean(encontradoPag), JSON.stringify(encontradoPag ?? null));

  if (encontradoPag) {
    const statusDeletePag = await js(`(async () => {
      const r = await fetch('http://127.0.0.1:${cfgPag.port}/api/pagadores/${encontradoPag.id}', { method: 'DELETE', headers: { 'X-FinDesk-Token': '${cfgPag.token}' } });
      return r.status;
    })()`);
    teste("API DELETE exclui o pagador de teste (204)", statusDeletePag === 204, String(statusDeletePag));
    const statusAposPag = await js(`(async () => {
      const r = await fetch('http://127.0.0.1:${cfgPag.port}/api/pagadores/${encontradoPag.id}', { headers: { 'X-FinDesk-Token': '${cfgPag.token}' } });
      return r.status;
    })()`);
    teste("API GET pagador apos exclusao retorna 404", statusAposPag === 404, String(statusAposPag));
  }

  await definirTamanho(480, 800);
  await capturar("form-pagador-480x800.png");
  await definirTamanho(768, 800);
  await capturar("form-pagador-768x800.png");
  await definirTamanho(1536, 864);
  await capturar("form-pagador-1536x864.png");

  // 7e. Formulario de Empresa (2 etapas) — validacao, CRUD pela API, capturas
  await js("window.finDesk.navegar('form-empresa')");
  await esperarTela("form-empresa");
  await prepararPagina();
  const camposEmpresa = JSON.parse(
    await js(`JSON.stringify({
      razaoSocial: !!document.getElementById('campo-razao-social'),
      cnpj: !!document.getElementById('campo-cnpj'),
      representante: !!document.getElementById('campo-representante'),
      email: !!document.getElementById('campo-email'),
      logradouro: !!document.getElementById('campo-logradouro'),
      addTelefone: !!document.getElementById('btn-add-telefone'),
      proxima: !!document.getElementById('btn-proxima'),
      salvar: !!document.getElementById('btn-salvar'),
      cancelar: !!document.getElementById('btn-cancelar'),
    })`)
  );
  teste("Form Empresa: campos, acoes e navbar presentes", Object.values(camposEmpresa).every(Boolean), JSON.stringify(camposEmpresa));
  teste("Form Empresa: botao CADASTROS branco na navbar", (await corBotaoNav("cadastros")) === "rgb(255, 255, 255)", await corBotaoNav("cadastros"));

  await clicar("#btn-salvar");
  await esperar(400);
  const errosEmpVazio = JSON.parse(
    await js(`JSON.stringify([...document.querySelectorAll('.campo-erro')].filter(e => !e.classList.contains('hidden')).map(e => e.dataset.erroCampo))`)
  );
  teste(
    "Form Empresa: submit vazio mostra erro em razao social (demais opcionais)",
    errosEmpVazio.includes("razaoSocial") && !errosEmpVazio.includes("cnpj") && !errosEmpVazio.includes("email"),
    JSON.stringify(errosEmpVazio)
  );
  await js(`(() => { document.getElementById('campo-razao-social').value = 'Empresa Teste'; document.getElementById('campo-cnpj').value = '11222333000182'; return true; })()`);
  await clicar("#btn-salvar");
  await esperar(400);
  const erroCnpj = await js(`!document.querySelector('[data-erro-campo="cnpj"]').classList.contains('hidden')`);
  teste("Form Empresa: CNPJ com digitos invalidos e recusado", erroCnpj === true);

  await js(`(() => {
    document.getElementById('campo-cnpj').value = '11.222.333/0001-81';
    document.getElementById('campo-email').value = 'contato@empresa.com.br';
    return true;
  })()`);
  await clicar("#btn-proxima");
  await esperar(300);
  teste("Form Empresa: etapa 2 exibida apos PROXIMA", (await js(`document.getElementById('etapa-2').classList.contains('hidden')`)) === false);
  teste("Form Empresa: etapa 1 oculta na etapa 2", (await js(`document.getElementById('etapa-1').classList.contains('hidden')`)) === true);
  await clicar("#btn-add-telefone");
  await esperar(200);
  await js(`(() => {
    document.querySelector('.linha-telefone .tel-numero').value = '(11) 3333-4444';
    document.querySelector('.linha-telefone .tel-numero').dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);

  const nomeEmpresa = `EMPRESA SMOKE ${Date.now()}`;
  await js(`(() => { document.getElementById('campo-razao-social').value = ${JSON.stringify(nomeEmpresa)}; document.getElementById('campo-razao-social').dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
  await clicar("#btn-salvar");
  const empresaSalvaOk = await esperarPredicado(`document.body.dataset.empresaSalva !== undefined`, 10000);
  teste("Form Empresa: salvar com dados validos confirma cadastro", empresaSalvaOk);
  const feedbackEmp = await js(`document.getElementById('feedback-empresa').textContent`);
  teste("Form Empresa: mensagem de sucesso exibida", String(feedbackEmp).includes("sucesso"), String(feedbackEmp));
  teste("Form Empresa: volta a etapa 1 apos salvar", (await js(`document.getElementById('etapa-1').classList.contains('hidden')`)) === false);

  const cfgEmp = JSON.parse(await js(`(async () => JSON.stringify(await window.finDesk.config()))()`));
  const listaEmp = JSON.parse(
    await js(`(async () => {
      const r = await fetch('http://127.0.0.1:${cfgEmp.port}/api/empresas', { headers: { 'X-FinDesk-Token': '${cfgEmp.token}' } });
      return JSON.stringify(await r.json());
    })()`)
  );
  const encontradaEmp = listaEmp.find((e) => e.razaoSocial === nomeEmpresa && e.telefones.length === 1);
  teste("Form Empresa: registro com telefone persistido pela API", Boolean(encontradaEmp), JSON.stringify(encontradaEmp ?? null));

  if (encontradaEmp) {
    const statusDelEmp = await js(`(async () => {
      const r = await fetch('http://127.0.0.1:${cfgEmp.port}/api/empresas/${encontradaEmp.id}', { method: 'DELETE', headers: { 'X-FinDesk-Token': '${cfgEmp.token}' } });
      return r.status;
    })()`);
    teste("API DELETE exclui a empresa de teste (204)", statusDelEmp === 204, String(statusDelEmp));
    const statusAposEmp = await js(`(async () => {
      const r = await fetch('http://127.0.0.1:${cfgEmp.port}/api/empresas/${encontradaEmp.id}', { headers: { 'X-FinDesk-Token': '${cfgEmp.token}' } });
      return r.status;
    })()`);
    teste("API GET empresa apos exclusao retorna 404", statusAposEmp === 404, String(statusAposEmp));
  }

  await definirTamanho(480, 800);
  await capturar("form-empresa-480x800.png");
  await definirTamanho(768, 800);
  await capturar("form-empresa-768x800.png");
  await definirTamanho(1536, 864);
  await capturar("form-empresa-1536x864.png");
  await js("sessionStorage.removeItem('findesk.pilha-navegacao')");
  await js("window.confirm = () => true; 'ok'");
  await js("window.finDesk.navegar('menu')");
  await esperarTela("menu");
  await prepararPagina();
  await js("window.finDesk.navegar('controle')");
  await esperarTela("controle");
  await prepararPagina();
  await tecla("2");
  teste("Atalho 2 em controle navega para recorrentes", await esperarTela("recorrentes"));
  await prepararPagina();
  await tecla("Escape");
  teste("Escape em recorrentes volta ao controle", await esperarTela("controle"));
  await prepararPagina();

  // 7b. Todos os Cadastros (Entrega 3.4): filtros, pesquisa, painel de edicao e exclusao
  await js("window.finDesk.navegar('todos-cadastros')");
  teste("Todos os Cadastros: tela abre pela whitelist", await esperarTela("todos-cadastros"));
  await prepararPagina();
  const tcEstrutura = JSON.parse(
    await js(`JSON.stringify({
      filtros: document.querySelectorAll('.btn-filtro').length,
      pesquisa: !!document.getElementById('campo-pesquisa'),
      area: !!document.getElementById('tabela-area'),
      painelOculto: document.getElementById('painel-edicao').hidden,
      navbar: !!document.querySelector('#nav-global .nav-barra'),
    })`)
  );
  teste(
    "Todos os Cadastros: estrutura (3 filtros, pesquisa, area, painel oculto, navbar)",
    tcEstrutura.filtros === 3 && tcEstrutura.pesquisa && tcEstrutura.area && tcEstrutura.painelOculto && tcEstrutura.navbar,
    JSON.stringify(tcEstrutura)
  );

  const cfgTc = JSON.parse(await js(`(async () => JSON.stringify(await window.finDesk.config()))()`));
  const tcCriar = async (caminho, dados) =>
    JSON.parse(
      await js(`(async () => {
        const r = await fetch('http://127.0.0.1:${cfgTc.port}${caminho}', {
          method: 'POST',
          headers: { 'X-FinDesk-Token': '${cfgTc.token}', 'Content-Type': 'application/json' },
          body: JSON.stringify(${JSON.stringify(dados)}),
        });
        return JSON.stringify({ status: r.status, body: await r.json() });
      })()`)
    );
  const sufixoTc = String(Date.now());
  const bancoTc = await tcCriar("/api/bancos", { instituicao: `TC BANCO ${sufixoTc}` });
  const pagadorTc = await tcCriar("/api/pagadores", { nome: `TC PAGADOR ${sufixoTc}`, cpf: "529.982.247-25", funcao: "Fiscal" });
  const empresaTc = await tcCriar("/api/empresas", { razaoSocial: `TC EMPRESA ${sufixoTc}`, cnpj: "11.222.333/0001-81" });
  teste("Todos os Cadastros: registros de teste criados via API", bancoTc.status === 201 && pagadorTc.status === 201 && empresaTc.status === 201,
    JSON.stringify({ b: bancoTc.status, p: pagadorTc.status, e: empresaTc.status }));

  await js("window.finDesk.navegar('todos-cadastros')");
  await esperarTela("todos-cadastros");
  await prepararPagina();
  const linhasEmpresas = await js(`document.querySelectorAll('#tabela-area tbody tr').length`);
  teste("Filtro EMPRESAS (padrao) lista a empresa de teste", Number(linhasEmpresas) >= 1 && (await js(`document.getElementById('tabela-area').textContent.includes('TC EMPRESA ${sufixoTc}')`)) === true);

  await clicar("#btn-filtro-pagadores");
  await esperar(200);
  const cabecalhoPag = await js(`JSON.stringify([...document.querySelectorAll('#tabela-area th')].map(th => th.textContent.trim()))`);
  teste("Filtro PAGADORES reconfigura colunas", JSON.stringify(JSON.parse(cabecalhoPag)) === JSON.stringify(["Nome", "CPF", "Função"]), cabecalhoPag);
  teste("Filtro PAGADORES lista o pagador de teste", (await js(`document.getElementById('tabela-area').textContent.includes('TC PAGADOR ${sufixoTc}')`)) === true);

  await clicar("#btn-filtro-bancos");
  await esperar(200);
  const cabecalhoBco = await js(`JSON.stringify([...document.querySelectorAll('#tabela-area th')].map(th => th.textContent.trim()))`);
  teste("Filtro BANCOS reconfigura colunas", JSON.stringify(JSON.parse(cabecalhoBco)) === JSON.stringify(["Instituição", "Chave Pix"]), cabecalhoBco);

  await js(`(() => { const el = document.getElementById('campo-pesquisa'); el.value = 'TC BANCO ${sufixoTc}'; el.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
  await esperar(200);
  const soBanco = await js(`document.querySelectorAll('#tabela-area tbody tr').length`);
  teste("Pesquisa filtra apenas o banco de teste", Number(soBanco) === 1 && (await js(`document.getElementById('tabela-area').textContent.includes('TC PAGADOR')`)) === false);

  await js(`(() => { const el = document.getElementById('campo-pesquisa'); el.value = 'xyz-inexistente-000'; el.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
  await esperar(200);
  teste("Pesquisa sem resultado mostra estado vazio", (await js("document.body.dataset.tabelaEstado")) === "vazio");
  await js(`(() => { const el = document.getElementById('campo-pesquisa'); el.value = ''; el.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
  await esperar(200);

  await clicar(`#tabela-area tbody tr`);
  await esperar(300);
  const painelAberto = JSON.parse(
    await js(`JSON.stringify({
      visivel: !document.getElementById('painel-edicao').hidden,
      edicao: document.body.dataset.registroEdicao || null,
      instituicao: document.getElementById('campo-edt-instituicao').value,
    })`)
  );
  teste("Clique na linha abre painel de edicao preenchido", painelAberto.visivel && painelAberto.instituicao === `TC BANCO ${sufixoTc}`, JSON.stringify(painelAberto));

  await js(`(() => { const el = document.getElementById('campo-edt-instituicao'); el.value = 'TC BANCO EDITADO ${sufixoTc}'; el.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
  await clicar("#btn-edt-salvar");
  await esperarPredicado(`document.body.dataset.registroSalvo !== undefined`, 10000);
  teste("Salvar no painel atualiza o registro (feedback sucesso)", (await js(`document.getElementById('feedback-edt').textContent`)).includes("sucesso"));
  teste("Linha atualizada reflete a edicao", (await js(`document.getElementById('tabela-area').textContent.includes('TC BANCO EDITADO ${sufixoTc}')`)) === true);

  await js(`window.__confirmas = []; window.__confirmResposta = false; sessionStorage.setItem('smoke-confirmas', '[]'); window.confirm = (m) => { window.__confirmas.push(String(m)); sessionStorage.setItem('smoke-confirmas', JSON.stringify(window.__confirmas)); return window.__confirmResposta; }; 'ok'`);
  await clicar("#btn-edt-excluir");
  await esperar(300);
  teste("Exclusao cancelada preserva o registro", (await js(`document.body.dataset.registroExcluido`)) === undefined && (await js(`document.getElementById('tabela-area').textContent.includes('TC BANCO EDITADO')`)) === true);

  await js("window.__confirmResposta = true");
  await clicar("#btn-edt-excluir");
  const excluidoOk = await esperarPredicado(`document.body.dataset.registroExcluido !== undefined`, 10000);
  teste("Exclusao confirmada remove o registro e fecha o painel", excluidoOk && (await js("document.getElementById('painel-edicao').hidden")) === true);
  teste("Registro excluido nao aparece mais na tabela", (await js(`document.getElementById('tabela-area').textContent.includes('TC BANCO EDITADO')`)) === false);

  await js("window.confirm = () => true; 'ok'");
  await js(`(() => { const el = document.getElementById('campo-pesquisa'); el.value = 'TC BANCO ${sufixoTc}'; el.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
  await definirTamanho(1536, 864);
  await capturar("todos-cadastros-1536x864.png");
  await definirTamanho(768, 800);
  await capturar("todos-cadastros-768x800.png");
  await definirTamanho(480, 800);
  await capturar("todos-cadastros-480x800.png");

  for (const [caminhoTc, idTc] of [["/api/bancos", bancoTc.body.id], ["/api/pagadores", pagadorTc.body.id], ["/api/empresas", empresaTc.body.id]]) {
    if (!idTc) continue;
    await js(`(async () => { await fetch('http://127.0.0.1:${cfgTc.port}${caminhoTc}/${idTc}', { method: 'DELETE', headers: { 'X-FinDesk-Token': '${cfgTc.token}' } }); return true; })()`);
  }
  teste("Registros de teste do Todos os Cadastros removidos da base temporaria", true);

  await definirTamanho(1536, 864);
  await js("window.finDesk.navegar('menu')");
  teste("Todos os Cadastros: estado restaurado para o fluxo das secoes seguintes", await esperarTela("menu"));
  await prepararPagina();

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

  // 9. Menu lateral compacto (480x800)
  await definirTamanho(480, 800);
  await js("window.finDesk.navegar('controle')");
  await esperarTela("controle");
  await prepararPagina();
  const medidoCompacto = await medirTela();
  teste("Compacto: hambúrguer visível e barra oculta em 480x800", medidoCompacto.hambVisivel && !medidoCompacto.barraVisivel);
  const rectsAntes = await rectsCartoes();
  teste("Hambúrguer abre o menu", await (async () => {
    await abrirMenu();
    const e = await estadoMenu();
    return e.aberto === "true" && e.aria === "true" && e.painelVisivel === "visible" && Number(e.veuOpacidade) > 0.9;
  })());
  const estadoAberto = await estadoMenu();
  const g1 = (estadoAberto.linha1 || "").match(/matrix\(([^)]+)\)/);
  const g3 = (estadoAberto.linha3 || "").match(/matrix\(([^)]+)\)/);
  const m1 = g1 ? g1[1].split(",").map(Number) : [];
  const m3 = g3 ? g3[1].split(",").map(Number) : [];
  teste(
    "Hambúrguer se transforma em X (rotações ±45°, linha central some)",
    m1.length > 1 && Math.abs(m1[1] - 0.7071) < 0.01 && m3.length > 1 && Math.abs(m3[1] + 0.7071) < 0.01 && Number(estadoAberto.linha2Opacidade) < 0.1,
    `linha1=${estadoAberto.linha1} linha2op=${estadoAberto.linha2Opacidade} linha3=${estadoAberto.linha3}`
  );
  await capturar("nav-menu-aberto-480x800.png");
  const rectsAberto = await rectsCartoes();
  teste("Estabilidade: cartões intactos com menu ABERTO (480x800)", rectsIguais(rectsAntes, rectsAberto), JSON.stringify({ antes: rectsAntes, aberto: rectsAberto }));
  const larguraConteudo = janela.getContentBounds().width;
  teste("Alinhamento central dos cartões preservado (480x800)", simetriaCentral(rectsAberto, larguraConteudo));
  const topoCartoes = await js(`(() => {
    return JSON.stringify([...document.querySelectorAll('a[data-modulo]')].map((c) => {
      const r = c.getBoundingClientRect();
      const el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return el ? String(el.className) : 'null';
    }));
  })()`);
  const classesTopo = JSON.parse(topoCartoes);
  teste(
    "Conteúdo ao fundo não recebe cliques (painel/véu cobrem os cartões)",
    classesTopo.length > 0 && classesTopo.every((c) => !c.includes("submenu-cartao")),
    topoCartoes
  );
  teste("X fecha o menu", await (async () => {
    await fecharMenu();
    const e = await estadoMenu();
    return e.aberto === "false" && e.painelVisivel === "hidden" && Number(e.veuOpacidade) < 0.1;
  })());
  teste("Clique fora (véu) fecha o menu", await (async () => {
    await abrirMenu();
    await clicar(".nav-veu");
    await esperarPredicado("document.getElementById('nav-global')?.dataset.menuAberto === 'false'", 5000);
    const e = await estadoMenu();
    return e.aberto === "false";
  })());
  teste("ESC fecha o menu", await (async () => {
    await abrirMenu();
    await tecla("Escape");
    await esperarPredicado("document.getElementById('nav-global')?.dataset.menuAberto === 'false'", 5000);
    const e = await estadoMenu();
    return e.aberto === "false" && (await js("document.body.dataset.tela")) === "controle";
  })());
  teste("Selecionar seção fecha o menu e navega", await (async () => {
    await abrirMenu();
    await clicar('.nav-painel button[data-nav="mensagens"]');
    const navega = await esperarTela("mensagens");
    await prepararPagina();
    const e = await estadoMenu();
    return navega && e.aberto === "false";
  })());
  await js("window.finDesk.navegar('controle')");
  await esperarTela("controle");
  await prepararPagina();
  const ordemPainel = JSON.parse(
    await js("JSON.stringify([...document.querySelectorAll('.nav-painel button[data-nav]')].map(b => b.dataset.nav))")
  );
  teste(
    "Painel: VOLTAR presente e primeiro (ordem preservada)",
    JSON.stringify(ordemPainel) === JSON.stringify(["voltar", "menu", "cadastros", "controle", "mensagens", "graficos"]),
    JSON.stringify(ordemPainel)
  );
  await js("sessionStorage.removeItem('findesk.pilha-navegacao')");
  teste("Painel VOLTAR retorna à tela anterior", await (async () => {
    await navegarPor('a[data-modulo="contas-recorrentes"]', "recorrentes");
    await abrirMenu();
    await clicar('.nav-painel button[data-nav="voltar"]');
    return await esperarTela("controle");
  })());
  await prepararPagina();
  teste("Painel VOLTAR sem histórico: comportamento seguro (vai ao Menu)", await (async () => {
    await js("sessionStorage.removeItem('findesk.pilha-navegacao')");
    await abrirMenu();
    await clicar('.nav-painel button[data-nav="voltar"]');
    return await esperarTela("menu");
  })());
  await prepararPagina();
  teste("Histórico entre módulos via painel", await (async () => {
    await js("window.finDesk.navegar('novo-cadastro')");
    await esperarTela("novo-cadastro");
    await prepararPagina();
    await abrirMenu();
    await clicar('.nav-painel button[data-nav="controle"]');
    if (!(await esperarTela("controle"))) return false;
    await prepararPagina();
    await abrirMenu();
    await clicar('.nav-painel button[data-nav="voltar"]');
    return await esperarTela("novo-cadastro");
  })());
  await prepararPagina();
  await abrirMenu();
  await clicar('.nav-painel button[data-nav="menu"]');
  teste("Painel: MENU PRINCIPAL navega ao Menu", await esperarTela("menu"));
  teste("Menu aprovado sem navbar (repetição)", (await js("!!document.getElementById('nav-global')")) === false);
  await prepararPagina();
  await js("sessionStorage.removeItem('findesk.pilha-navegacao')");
  await js("window.finDesk.navegar('controle')");
  await esperarTela("controle");
  await prepararPagina();
  let cicloMenuOk = true;
  for (let i = 1; i <= 5; i++) {
    await abrirMenu();
    if ((await estadoMenu()).aberto !== "true") cicloMenuOk = false;
    await fecharMenu();
    if ((await estadoMenu()).aberto !== "false") cicloMenuOk = false;
  }
  teste("Abrir/fechar o menu 5x sem erro", cicloMenuOk);
  teste("ESC fechado volta à tela anterior (comportamento preservado)", await (async () => {
    await tecla("Escape");
    return await esperarTela("menu");
  })());
  await prepararPagina();

  // 10. Estabilidade visual dos cartões (480/600/768) em telas de 2 e 3 cartões
  for (const [tela, larguras] of [
    ["controle", [480, 600, 768]],
    ["cadastros", [768]],
  ]) {
    for (const w of larguras) {
      await definirTamanho(w, 800);
      await js(`window.finDesk.navegar('${tela}')`);
      await esperarTela(tela);
      await prepararPagina();
      const antes = await rectsCartoesEstavel();
      await abrirMenu();
      const aberto = await rectsCartoesEstavel();
      await fecharMenu();
      const depois = await rectsCartoesEstavel();
      teste(`Cartões estáveis abrir/fechar menu (${tela} ${w}x800)`, rectsIguais(antes, aberto) && rectsIguais(antes, depois), JSON.stringify({ antes, aberto, depois }));
      teste(`Simetria central dos cartões (${tela} ${w}x800)`, simetriaCentral(aberto, w));
    }
  }

  // 11. Responsividade (medição) + breakpoint da barra + capturas
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
      await definirTamanho(w, h);
      const medido = await medirTelaEstavel();
      const esperado = colunasEsperadas(pagina.numBotoes, w);
      const vwValido =
        colunasEsperadas(pagina.numBotoes, medido.vw) === esperado &&
        w >= BREAKPOINT_BARRA === medido.vw >= BREAKPOINT_BARRA;
      teste(
        `Responsividade ${pagina.tela} ${w}x${h} (${esperado} col)`,
        medido.colunas === esperado && medido.overflow <= 1 && vwValido,
        `colunas=${medido.colunas} overflow=${medido.overflow}px viewport=${medido.vw}`
      );
      if (pagina.tela !== "menu") {
        const barraEsperada = w >= BREAKPOINT_BARRA;
        teste(
          `Navbar ${pagina.tela} ${w}x${h}: ${barraEsperada ? "barra" : "hambúrguer"}`,
          medido.barraVisivel === barraEsperada && medido.hambVisivel === !barraEsperada && (barraEsperada ? medido.barraCabe <= 1 : true),
          `barra=${medido.barraVisivel} hamb=${medido.hambVisivel} barraCabe=${medido.barraCabe}px`
        );
      }
      if (pagina.tela !== "menu" && CAPTURAS.some((c) => c.w === w && c.h === h)) {
        await capturar(`${pagina.tela}-${w}x${h}.png`);
      }
    }
  }
  await js("window.finDesk.navegar('controle')");
  await esperarTela("controle");
  await prepararPagina();
    await definirTamanho(1920, 1080);
    await capturar("nav-barra-desktop-1920x1080.png");
    await definirTamanho(1280, 720);
    await capturar("nav-barra-desktop-1280x720.png");
    await definirTamanho(960, 540);
    await capturar("nav-barra-desktop-960x540.png");
    await definirTamanho(1536, 864);
    await capturar("nav-barra-desktop-1536x864.png");
  await definirTamanho(480, 800);
  await capturar("nav-menu-fechado-480x800.png");
  await abrirMenu();
  await capturar("nav-menu-aberto-480x800.png");
  await fecharMenu();
  await definirTamanho(768, 800);
  await abrirMenu();
  await capturar("nav-menu-aberto-768x800.png");
  await fecharMenu();

  // 12. Ícones (ligaturas do Material Symbols) renderizando
  const largurasIcones = JSON.parse(
    await js(`(() => {
      const glifos = ['arrow_back', 'home', 'badge', 'checklist', 'forum', 'bar_chart', 'zqxwv_'];
      const res = {};
      for (const g of glifos) {
        const s = document.createElement('span');
        s.className = 'material-symbols-outlined';
        s.textContent = g;
        document.body.appendChild(s);
        const range = document.createRange();
        range.selectNodeContents(s);
        res[g] = +range.getBoundingClientRect().width.toFixed(2);
        range.detach();
        s.remove();
      }
      return JSON.stringify(res);
    })()`)
  );
  const usados = ["arrow_back", "home", "badge", "checklist", "forum", "bar_chart"].map((g) => largurasIcones[g]);
  teste(
    "Ícones da navbar renderizam (ligaturas Material Symbols)",
    usados.every((l) => l === usados[0] && l > 0) && largurasIcones["zqxwv_"] !== usados[0],
    JSON.stringify(largurasIcones)
  );

  // 13. Offline + console
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
    if (errosConsole.length) console.error("console do renderer:", errosConsole.slice(0, 8).join(" | "));
    app.exitCode = 1;
    app.quit();
});
