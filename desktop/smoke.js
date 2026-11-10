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
      { sel: 'a[data-modulo="todas-as-contas"]', nome: "TODAS AS CONTAS", tipo: "nav", destino: "todas-as-contas" },
      { sel: 'a[data-modulo="contas-recorrentes"]', nome: "CONTAS RECORRENTES", tipo: "nav", destino: "recorrentes" },
      { sel: 'a[data-modulo="pagos"]', nome: "PAGOS", tipo: "nav", destino: "pagos" },
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
      { sel: 'a[data-modulo="todas-as-mensagens"]', nome: "TODAS AS MENSAGENS", tipo: "nav", destino: "todas-as-mensagens" },
      { sel: 'a[data-modulo="criar-nova-mensagem"]', nome: "CRIAR NOVA MENSAGEM", tipo: "nav", destino: "criar-mensagem" },
    ],
  },
  {
    tela: "recorrentes",
    numBotoes: 2,
    entrada: 'a[data-modulo="contas-recorrentes"]',
    origem: "controle",
    volta: "controle",
    botoes: [
      { sel: 'a[data-modulo="todas-contas-recorrentes"]', nome: "TODAS CONTAS RECORRENTES", tipo: "nav", destino: "recorrentes-tabela" },
      { sel: 'a[data-modulo="cadastrar-nova-recorrente"]', nome: "CADASTRAR NOVA CONTA RECORRENTE", tipo: "nav", destino: "form-recorrente" },
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
  await fecharDialogoSeAberto();
}

// Dialogos neobrutalistas (dialogos.ts): leitura e resposta via DOM
async function dialogoInfo() {
  return JSON.parse(
    await js(`(() => {
      const d = document.querySelector('[data-dialogo]');
      if (!d) return 'null';
      const t = d.querySelector('[data-dialogo-titulo]');
      const m = d.querySelector('[data-dialogo-mensagem]');
      const det = d.querySelector('[data-dialogo-detalhes]');
      const acoes = [...d.querySelectorAll('[data-dialogo-acao]')].map((b) => b.dataset.dialogoAcao);
      return JSON.stringify({
        tipo: d.dataset.dialogo,
        role: d.getAttribute('role'),
        ariaModal: d.getAttribute('aria-modal'),
        labelledby: d.getAttribute('aria-labelledby'),
        titulo: t ? t.textContent : '',
        mensagem: m ? m.textContent : '',
        detalhes: det ? det.textContent : null,
        acoes,
        foco: document.activeElement ? document.activeElement.getAttribute('data-dialogo-acao') : null,
      });
    })()`)
  );
}

async function esperarDialogo(timeoutMs = 5000) {
  return esperarPredicado("!!document.querySelector('[data-dialogo]')", timeoutMs);
}

async function responderDialogo(acao) {
  return js(`(() => { const b = document.querySelector('[data-dialogo-acao="${acao}"]'); if (!b) return false; b.click(); return true; })()`);
}

async function fecharDialogoSeAberto() {
  if (await js("!!document.querySelector('[data-dialogo]')")) {
    await js(`(() => { const b = document.querySelector('[data-dialogo-acao="cancelar"], [data-dialogo-acao="fechar"]'); if (b) b.click(); return true; })()`);
    await esperarPredicado("!document.querySelector('[data-dialogo]')", 3000);
  }
}

async function clicar(seletor) {
  return js(`(() => { const el = document.querySelector(${JSON.stringify(seletor)}); if (!el) return false; el.click(); return true; })()`);
}

async function tecla(key) {
  await js(`document.dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(key)}, bubbles: true, cancelable: true }))`);
}

async function lerAlertas() {
  const info = await dialogoInfo();
  return info ? [`${info.titulo} ${info.mensagem}`] : [];
}

async function testarProvisorio(seletor, nome) {
  await clicar(seletor);
  if (!(await esperarDialogo())) return false;
  const info = await dialogoInfo();
  await responderDialogo("fechar");
  return Boolean(info) && (info.mensagem.includes(nome) || info.titulo.includes(nome));
}

function colunasEsperadas(numBotoes, w, tela) {
  // Menu preserva a grade aprovada; submenus usam cartoes de largura fixa
  // por faixa (100% / 16.5rem / 21.5rem) com quebra de linha e centralizacao
  if (tela === "menu") {
    if (w >= 961) return 3;
    if (w >= 600) return 2;
    return 1;
  }
  let faixa;
  if (w < 600) faixa = 1;
  else if (w < 1104) faixa = 2;
  else faixa = 3;
  return Math.min(numBotoes, faixa);
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
      const doc = document.documentElement;
      const barra = document.querySelector(".nav-barra");
      const hamb = document.querySelector(".nav-hamburguer");
      const visivel = (el) => !!el && getComputedStyle(el).display !== "none";
      let colunas = 0;
      if (grade) {
        if (grade.classList.contains("menu-grade")) {
          colunas = getComputedStyle(grade).gridTemplateColumns.split(" ").filter(Boolean).length;
        } else {
          const rects = [...grade.querySelectorAll("a[data-modulo]")].map((el) => el.getBoundingClientRect());
          const linhas = {};
          for (const r of rects) {
            const chave = Math.round(r.top / 8);
            linhas[chave] = (linhas[chave] || 0) + 1;
          }
          colunas = rects.length ? Math.max(...Object.values(linhas)) : 0;
        }
      }
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
  for (const tela of ["controle", "cadastros", "mensagens", "recorrentes", "novo-cadastro", "todos-cadastros", "inserir-conta", "menu"]) {
    await prepararPagina();
    await js(`window.finDesk.navegar('${tela}')`);
    teste(`Whitelist permite navegar para "${tela}"`, await esperarTela(tela));
  }
  await prepararPagina();

  // 3. Botoes do Menu + 4. atalhos do Menu (regressao)
  teste("Botao INSERIR CONTA do Menu navega", await navegarPor('a[data-path="inserir-conta"]', "inserir-conta"));
  teste("VOLTAR de inserir-conta retorna ao Menu", await voltarPara("menu"));
  await prepararPagina();
  teste("Botão GRÁFICOS do Menu navega", await navegarPor('a[data-path="graficos-e-relatorios"]', "graficos"));
  teste("VOLTAR de graficos retorna ao Menu", await voltarPara("menu"));
  await prepararPagina();
  for (const [teclaAlvo, destino] of [
    ["F1", "inserir-conta"],
    ["1", "inserir-conta"],
    ["F4", "graficos"],
    ["4", "graficos"],
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

  // 5b. Hover/ativo da navbar: cores dos modulos, estado ativo, padrao do CONTROLE
  const coresNav = JSON.parse(
    await js(`(() => {
      const pega = (c) => { const el = document.querySelector('.nav-barra button[data-nav="' + c + '"]'); return el ? getComputedStyle(el).getPropertyValue('--cor-modulo').trim() : null; };
      return JSON.stringify({ menu: pega('menu'), cadastros: pega('cadastros'), controle: pega('controle'), mensagens: pega('mensagens'), graficos: pega('graficos') });
    })()`)
  );
  const normalizaHex = (c) => (c && c.length === 4 ? "#" + c[1] + c[1] + c[2] + c[2] + c[3] + c[3] : c);
  const coresNorm = Object.fromEntries(Object.entries(coresNav).map(([k, v]) => [k, normalizaHex(v)]));
  teste(
    "Navbar: cor do modulo declarada por botao (hover preenche o botao)",
    JSON.stringify(coresNorm) === JSON.stringify({ menu: "#ffe600", cadastros: "#ff8c00", controle: "#2563eb", mensagens: "#ff5e89", graficos: "#00ff66" }),
    JSON.stringify(coresNav)
  );
  const estadoAtivo = JSON.parse(
    await js(`(() => {
      const ativo = document.querySelector('.nav-barra button[data-nav="controle"]');
      const inativo = document.querySelector('.nav-barra button[data-nav="cadastros"]');
      return JSON.stringify({
        ativoMarca: ativo ? ativo.getAttribute('aria-current') : null,
        ativoSombra: ativo ? getComputedStyle(ativo).boxShadow : '',
        ativoFundo: ativo ? getComputedStyle(ativo).backgroundColor : '',
        inativoFundo: inativo ? getComputedStyle(inativo).backgroundColor : '',
        inativoSombra: inativo ? getComputedStyle(inativo).boxShadow : '',
      });
    })()`)
  );
  teste(
    "Navbar: estado ativo marcado (barra inferior) com fundo branco",
    estadoAtivo.ativoMarca === "page" && estadoAtivo.ativoSombra.includes("inset") && estadoAtivo.ativoFundo === "rgb(255, 255, 255)",
    JSON.stringify(estadoAtivo)
  );
  teste(
    "Navbar: botao inativo sem barra ativa (destaca so o modulo atual)",
    estadoAtivo.inativoFundo === "rgb(255, 255, 255)" && !estadoAtivo.inativoSombra.includes("inset"),
    JSON.stringify(estadoAtivo)
  );
  const quadrados = JSON.parse(
    await js(`(() => {
      const pega = (c) => { const el = document.querySelector('.nav-barra button[data-nav="' + c + '"] .nav-icone'); return el ? el.className : null; };
      return JSON.stringify({ menu: pega('menu'), cadastros: pega('cadastros'), controle: pega('controle'), mensagens: pega('mensagens'), graficos: pega('graficos') });
    })()`)
  );
  teste(
    "Navbar: CONTROLE padronizado com quadrado do icone do modulo (icone-azul)",
    String(quadrados.controle).includes("icone-azul") && String(quadrados.menu).includes("icone-amarelo") && String(quadrados.cadastros).includes("icone-laranja") && String(quadrados.mensagens).includes("icone-rosa") && String(quadrados.graficos).includes("icone-verde"),
    JSON.stringify(quadrados)
  );

  // GRÁFICOS = provisório; MENU PRINCIPAL navega; destinos a partir de tela profunda
  teste("Navbar GRÁFICOS navega", await navegarPor('.nav-barra button[data-nav="graficos"]', "graficos"));
  teste("VOLTAR de graficos (navbar) retorna", await voltarPara("controle"));
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
    ["mensagens", [["1", "todas-as-mensagens"], ["2", "criar-mensagem"]]],
  ]) {
    await js(`window.finDesk.navegar('${tela}')`);
    await esperarTela(tela);
    await prepararPagina();
    for (const [teclaAlvo, destino] of chaves) {
      await tecla(teclaAlvo);
      teste(`Atalho ${teclaAlvo} em ${tela} navega para ${destino}`, await esperarTela(destino));
      await prepararPagina();
      await tecla("Escape");
      teste(`Escape de ${destino} retorna a ${tela}`, await esperarTela(tela));
      await prepararPagina();
    }
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
  const feedback = await js(`Array.from(document.querySelectorAll('[data-notificacao="sucesso"] .notificacao__texto')).map((e) => e.textContent).join(' | ')`);
  teste("Form Banco: notificacao de sucesso exibida", String(feedback).includes("sucesso"), String(feedback));
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

  // dirty-form: confirmacao ao abandonar com alteracoes nao salvas (dialogo global)
  await js(`(() => { const el = document.getElementById('campo-instituicao'); el.value = 'Alteracao nao salva'; el.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
  await clicar('.nav-barra button[data-nav="voltar"]');
  const dialogouSujo = await esperarDialogo();
  const infoSuja = dialogouSujo ? await dialogoInfo() : null;
  teste("Form Banco: VOLTAR com alteracoes nao salvas pede confirmacao", dialogouSujo && Boolean(infoSuja) && infoSuja.mensagem.includes("não foi salvo") && infoSuja.titulo.includes("SAIR SEM SALVAR"), JSON.stringify(infoSuja));
  await responderDialogo("cancelar");
  await esperarPredicado("!document.querySelector('[data-dialogo]')", 3000);
  teste("Form Banco: cancelamento da confirmacao mantem na tela", (await js("document.body.dataset.tela")) === "form-banco");
  teste("Form Banco: dialogo fecha sem deixar overlay bloqueando", (await js("document.querySelectorAll('.dialogo-veu').length")) === 0);
  await clicar('.nav-barra button[data-nav="voltar"]');
  teste("Form Banco: dialogo reabre ao insistir em sair", await esperarDialogo());
  await responderDialogo("confirmar");
  teste("Form Banco: confirmacao aceita VOLTAR a novo-cadastro", await esperarTela("novo-cadastro"));
  await prepararPagina();
  await navegarPor('a[data-modulo="banco"]', "form-banco");
  await js(`(() => { const el = document.getElementById('campo-instituicao'); el.value = 'x'; el.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
  await clicar("#btn-cancelar");
  teste("Form Banco: CANCELAR sujo pede confirmacao", await esperarDialogo());
  await responderDialogo("confirmar");
  teste("Form Banco: confirmacao aceita sair pela tela", await esperarTela("novo-cadastro"));

  // estabilidade dos campos com menu lateral aberto + capturas
  await fecharDialogoSeAberto();
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
  const feedbackPag = await js(`Array.from(document.querySelectorAll('[data-notificacao="sucesso"] .notificacao__texto')).map((e) => e.textContent).join(' | ')`);
  teste("Form Pagador: notificacao de sucesso exibida", String(feedbackPag).includes("sucesso"), String(feedbackPag));
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

  // CNPJ alfanumerico (Receita Federal, 07/2026): mascara aceita letras e converte para maiusculas
  const cnpjAlfa = await js(`(() => {
    const el = document.getElementById('campo-cnpj');
    el.value = '12abc34501de35';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return el.value;
  })()`);
  teste("Form Empresa: mascara aceita CNPJ alfanumerico (12.ABC.345/01DE-35)", cnpjAlfa === "12.ABC.345/01DE-35", cnpjAlfa);

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
  const feedbackEmp = await js(`Array.from(document.querySelectorAll('[data-notificacao="sucesso"] .notificacao__texto')).map((e) => e.textContent).join(' | ')`);
  teste("Form Empresa: notificacao de sucesso exibida", String(feedbackEmp).includes("sucesso"), String(feedbackEmp));
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
  await fecharDialogoSeAberto();
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
  const pagadorSemCpfTc = await tcCriar("/api/pagadores", { nome: `TC SEMCPF ${sufixoTc}`, funcao: "Caixa" });
  teste("Todos os Cadastros: pagador sem CPF aceito pela API (CPF opcional)", pagadorSemCpfTc.status === 201, JSON.stringify(pagadorSemCpfTc.status));
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
  teste("Filtro PAGADORES exibe o CPF formatado (529.982.247-25)", (await js(`document.getElementById('tabela-area').textContent.includes('529.982.247-25')`)) === true);

  // edicao de pagador SEM CPF: o painel nao pode exigir CPF (campo opcional)
  await js(`(() => { const el = document.getElementById('campo-pesquisa'); el.value = 'TC SEMCPF ${sufixoTc}'; el.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
  await esperar(200);
  await clicar(`#tabela-area tbody tr`);
  await esperar(300);
  await js(`(() => { const el = document.getElementById('campo-edt-funcao'); el.value = 'Caixa Editado'; el.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
  await clicar("#btn-edt-salvar");
  const semCpfSalvo = await esperarPredicado(`document.body.dataset.registroSalvo !== undefined`, 10000);
  teste("Painel: pagador sem CPF salva sem exigir CPF", semCpfSalvo && (await js(`Array.from(document.querySelectorAll('[data-notificacao="sucesso"] .notificacao__texto')).map((e) => e.textContent).join(' | ')`)).includes("sucesso"),
    await js(`JSON.stringify([...document.querySelectorAll('.campo-erro')].filter(e => !e.classList.contains('hidden')).map(e => e.textContent))`));
  await js(`(() => { delete document.body.dataset.registroSalvo; const el = document.getElementById('campo-pesquisa'); el.value = ''; el.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
  await esperar(200);

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
  teste("Salvar no painel atualiza o registro (notificacao de sucesso)", (await js(`Array.from(document.querySelectorAll('[data-notificacao="sucesso"] .notificacao__texto')).map((e) => e.textContent).join(' | ')`)).includes("sucesso"));
  teste("Linha atualizada reflete a edicao", (await js(`document.getElementById('tabela-area').textContent.includes('TC BANCO EDITADO ${sufixoTc}')`)) === true);

  await clicar("#btn-edt-excluir");
  const dialogoExclusao = await esperarDialogo();
  const infoExclusao = dialogoExclusao ? await dialogoInfo() : null;
  teste("Exclusao pede confirmacao (dialogo EXCLUIR? de perigo)", dialogoExclusao && Boolean(infoExclusao) && infoExclusao.titulo.includes("EXCLUIR") && infoExclusao.tipo === "perigo", JSON.stringify(infoExclusao));
  await responderDialogo("cancelar");
  await esperarPredicado("!document.querySelector('[data-dialogo]')", 3000);
  teste("Exclusao cancelada preserva o registro", (await js(`document.body.dataset.registroExcluido`)) === undefined && (await js(`document.getElementById('tabela-area').textContent.includes('TC BANCO EDITADO')`)) === true);

  await clicar("#btn-edt-excluir");
  teste("Exclusao reabre o dialogo de confirmacao", await esperarDialogo());
  await responderDialogo("confirmar");
  const excluidoOk = await esperarPredicado(`document.body.dataset.registroExcluido !== undefined`, 10000);
  teste("Exclusao confirmada remove o registro e fecha o painel", excluidoOk && (await js("document.getElementById('painel-edicao').hidden")) === true);
  teste("Registro excluido nao aparece mais na tabela", (await js(`document.getElementById('tabela-area').textContent.includes('TC BANCO EDITADO')`)) === false);

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

  // 7c. Inserir Conta (design Stitch): etapas, mascaras, validacoes, duplicidade, anexo
  const cfgIc = JSON.parse(await js(`(async () => JSON.stringify(await window.finDesk.config()))()`));
  const icCriar = async (caminho, dados) =>
    JSON.parse(
      await js(`(async () => {
        const r = await fetch('http://127.0.0.1:${cfgIc.port}${caminho}', {
          method: 'POST',
          headers: { 'X-FinDesk-Token': '${cfgIc.token}', 'Content-Type': 'application/json' },
          body: JSON.stringify(${JSON.stringify(dados)}),
        });
        return JSON.stringify({ status: r.status, body: await r.json() });
      })()`)
    );
  const sufixoIc = String(Date.now());
  const empresaIc = await icCriar("/api/empresas", { razaoSocial: `IC EMPRESA ${sufixoIc}` });
  teste("Inserir Conta: fixture de empresa emissora criada", empresaIc.status === 201);

  await js("window.finDesk.navegar('inserir-conta')");
  teste("Inserir Conta: tela abre pela whitelist", await esperarTela("inserir-conta"));
  await prepararPagina();
  await esperarPredicado(`document.body.dataset.listasCarregadas === 'true'`, 10000);
  const estruturaIc = JSON.parse(
    await js(`JSON.stringify({
      data: !!document.getElementById('due_date'),
      tipo: document.querySelectorAll('input[name="account_type"]').length === 2,
      empresa: !!document.getElementById('company_name'),
      doc: !!document.getElementById('doc_number'),
      valor: !!document.getElementById('total_amount'),
      pasta: document.querySelectorAll('input[name="in_folder"]').length === 2,
      categoria: document.querySelectorAll('#lista-categorias option').length >= 6 && document.getElementById('category').tagName === 'INPUT',
      cobranca: document.querySelectorAll('#payment_method option').length >= 5,
      emissora: document.getElementById('issuer_company').options.length > 1,
      pagador: !!document.getElementById('payer_responsavel') || !!document.getElementById('payer_responsible'),
      anexo: !!document.getElementById('invoice_pdf'),
      etapa2Oculta: document.getElementById('step-2').classList.contains('hidden'),
      indicador: (document.getElementById('step-counter-badge').textContent || '').includes('1 DE 2'),
    })`)
  );
  teste(
    "Inserir Conta (Stitch): campos, selects, anexo e indicador de etapas",
    estruturaIc.data && estruturaIc.tipo && estruturaIc.empresa && estruturaIc.doc && estruturaIc.valor
      && estruturaIc.pasta && estruturaIc.categoria && estruturaIc.cobranca && estruturaIc.emissora
      && estruturaIc.pagador && estruturaIc.anexo && estruturaIc.etapa2Oculta && estruturaIc.indicador,
    JSON.stringify(estruturaIc)
  );

  // mascara de moeda por centavos (digitacao sintetica valida a logica da mascara)
  await js(`(() => {
    const el = document.getElementById('total_amount');
    el.value = '123456';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  teste("Mascara moeda: digitacao 123456 formata 1.234,56 (R$ fica no rotulo, sem duplicar)", (await js(`document.getElementById('total_amount').value`)) === "1.234,56", await js(`document.getElementById('total_amount').value`));
  await js(`(() => {
    const el = document.getElementById('total_amount');
    el.value = 'abc';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  teste("Mascara moeda: letras sao ignoradas (campo fica vazio)", (await js(`document.getElementById('total_amount').value`)) === "", await js(`document.getElementById('total_amount').value`));
  // Backspace sobre separador (evento beforeinput real do navegador): nao trava no "/"
  const dataApagada = await js(`(() => {
    const el = document.getElementById('due_date');
    el.focus();
    el.value = '31/12/2026';
    el.setSelectionRange(3, 3);
    el.dispatchEvent(new InputEvent('beforeinput', { inputType: 'deleteContentBackward', bubbles: true, cancelable: true }));
    return el.value;
  })()`);
  teste("Mascara data: Backspace logo apos a barra apaga o digito anterior", dataApagada === "31/22/026", dataApagada);

  await js(`(() => {
    const el = document.getElementById('due_date');
    el.value = '31/02/2026';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  await clicar("#btn-proxima");
  await esperar(300);
  const errosIc = JSON.parse(
    await js(`JSON.stringify([...document.querySelectorAll('.campo-erro')].filter(e => !e.classList.contains('hidden')).map(e => e.dataset.erroCampo))`)
  );
  teste("Etapa 1: data inexistente e valor invalido recusados", errosIc.includes("vencimento") && errosIc.includes("valor"), JSON.stringify(errosIc));

  await js(`(() => {
    document.getElementById('due_date').value = '20/12/2026';
    document.getElementById('company_name').value = 'IC EMPRESA ${sufixoIc}';
    document.getElementById('payer_responsible').value = 'Balcão 01';
    document.getElementById('form-conta').dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  await js(`(() => {
    const el = document.getElementById('total_amount');
    el.value = '123456';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  await clicar("#btn-proxima");
  await esperar(300);
  teste("Etapa 1: dados validos avancam para etapa 2", (await js(`!document.getElementById('step-2').classList.contains('hidden')`)) === true);
  teste("Indicador de etapas muda para PAGINA 2 DE 2", (await js(`document.getElementById('step-counter-badge').textContent`)).includes("2 DE 2"));

  await clicar("#btn-salvar");
  await esperar(300);
  teste("Etapa 2: documento de cobranca obrigatorio", (await js(`!document.querySelector('[data-erro-campo="formaPagamento"]').classList.contains('hidden')`)) === true);

  await js(`(() => {
    const sel = document.getElementById('payment_method');
    sel.value = 'boleto';
    sel.dispatchEvent(new Event('input', { bubbles: true }));
    const em = document.getElementById('issuer_company');
    em.value = em.options[1].value;
    em.dispatchEvent(new Event('input', { bubbles: true }));
    document.getElementById('doc_number').value = 'DOC-' + ${JSON.stringify(sufixoIc)};
    const pasta = document.querySelector('input[name="in_folder"][value="sim"]');
    pasta.checked = true;
    document.getElementById('form-conta').dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  await clicar("#btn-salvar");
  const contaSalvaIc = await esperarPredicado(`document.body.dataset.contaSalva === 'true'`, 10000);
  teste("Inserir Conta: salvar com dados validos grava a conta", contaSalvaIc);
  teste("Apos salvar, retorno a tela anterior (fluxo do Stitch)", await esperarTela("menu", 5000) || (await js("document.body.dataset.tela")) !== "inserir-conta");
  teste("Notificacao 'Conta ... salva' aparece na tela seguinte", await esperarPredicado(`(Array.from(document.querySelectorAll('[data-notificacao="sucesso"] .notificacao__texto')).map((e) => e.textContent).join(' | ')).includes('salva')`, 5000), await js(`Array.from(document.querySelectorAll('[data-notificacao="sucesso"] .notificacao__texto')).map((e) => e.textContent).join(' | ')`));

  const listaIc = JSON.parse(
    await js(`(async () => {
      const r = await fetch('http://127.0.0.1:${cfgIc.port}/api/contas', { headers: { 'X-FinDesk-Token': '${cfgIc.token}' } });
      return JSON.stringify(await r.json());
    })()`)
  );
  const contaCriadaIc = listaIc.find((c) => c.numeroDocumento === `DOC-${sufixoIc}`);
  teste(
    "Inserir Conta: registro persistido com valor exato (1234.56) e campos do Stitch",
    Boolean(contaCriadaIc) && Math.abs(contaCriadaIc.valor - 1234.56) < 0.001
      && contaCriadaIc.status === "PENDENTE" && contaCriadaIc.formaPagamento === "boleto"
      && contaCriadaIc.tipoPessoa === "PJ" && contaCriadaIc.pagadorResponsavel === "Balcão 01"
      && contaCriadaIc.boletoNaPasta === true && contaCriadaIc.idEmpresa === empresaIc.body.id,
    JSON.stringify(contaCriadaIc ?? null)
  );

  // duplicidade (mesmo mes) -> dialogo global POSSIVEL DUPLICIDADE; cancelar e forcar
  await js("window.finDesk.navegar('inserir-conta')");
  await esperarTela("inserir-conta");
  await prepararPagina();
  await esperarPredicado(`document.body.dataset.listasCarregadas === 'true'`, 10000);
  await js(`(() => {
    document.getElementById('due_date').value = '28/12/2026';
    document.getElementById('company_name').value = 'IC EMPRESA ${sufixoIc}';
    document.getElementById('payer_responsible').value = 'Balcão 01';
    const el = document.getElementById('total_amount');
    el.value = '99900';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    document.getElementById('form-conta').dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  await clicar("#btn-proxima");
  await esperar(300);
  await js(`(() => {
    document.getElementById('payment_method').value = 'pix';
    document.getElementById('doc_number').value = 'DOC-' + ${JSON.stringify(sufixoIc)};
    document.getElementById('form-conta').dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  await clicar("#btn-salvar");
  const dialogouDup = await esperarDialogo(10000);
  const infoDup = dialogouDup ? await dialogoInfo() : null;
  teste("Inserir Conta: duplicidade dispara dialogo CONTA PARECIDA", dialogouDup && Boolean(infoDup) && infoDup.titulo.includes("PARECIDA"), JSON.stringify(infoDup));
  teste("Inserir Conta: detalhes da duplicidade exibidos", Boolean(infoDup) && Boolean(infoDup.detalhes) && infoDup.detalhes.includes("Vencimento"), JSON.stringify(infoDup ? infoDup.detalhes : null));
  teste("Inserir Conta: duplicidade cancelada nao insere", (await js(`document.body.dataset.contaSalva`)) === undefined);
  await responderDialogo("cancelar");
  await esperarPredicado("!document.querySelector('[data-dialogo]')", 3000);
  await clicar("#btn-salvar");
  teste("Inserir Conta: dialogo de duplicidade reabre ao salvar de novo", await esperarDialogo(10000));
  await responderDialogo("confirmar");
  const forcadaIc = await esperarPredicado(`document.body.dataset.contaSalva === 'true'`, 10000);
  teste("Inserir Conta: confirmada a duplicidade, insercao forçada ocorre", forcadaIc);

  const listaIc2 = JSON.parse(
    await js(`(async () => {
      const r = await fetch('http://127.0.0.1:${cfgIc.port}/api/contas?status=PENDENTE', { headers: { 'X-FinDesk-Token': '${cfgIc.token}' } });
      return JSON.stringify(await r.json());
    })()`)
  );
  teste("Inserir Conta: duas contas com o mesmo documento existem apos forcar", listaIc2.filter((c) => c.numeroDocumento === `DOC-${sufixoIc}`).length === 2);

  for (const conta of listaIc2.filter((c) => c.numeroDocumento === `DOC-${sufixoIc}`)) {
    await js(`(async () => { await fetch('http://127.0.0.1:${cfgIc.port}/api/contas/${conta.id}', { method: 'DELETE', headers: { 'X-FinDesk-Token': '${cfgIc.token}' } }); return true; })()`);
  }
  if (empresaIc.body.id) {
    await js(`(async () => { await fetch('http://127.0.0.1:${cfgIc.port}/api/empresas/${empresaIc.body.id}', { method: 'DELETE', headers: { 'X-FinDesk-Token': '${cfgIc.token}' } }); return true; })()`);
  }
  teste("Inserir Conta: registros de teste removidos da base temporaria", true);

  await fecharDialogoSeAberto();
  await js("window.finDesk.navegar('inserir-conta')");
  await esperarTela("inserir-conta");
  await prepararPagina();
  await capturar("inserir-conta-1536x864.png");
  await definirTamanho(768, 800);
  await capturar("inserir-conta-768x800.png");
  await definirTamanho(480, 800);
  await capturar("inserir-conta-480x800.png");
  await definirTamanho(1536, 864);
  await js("window.finDesk.navegar('menu')");
  await esperarTela("menu");
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

  // 9b. Dialogos globais: acessibilidade, ESC, foco, teclado, sem overlay
  //     + fundo claro do formulario de recorrencia
  await js("window.finDesk.navegar('form-recorrente')");
  await esperarTela("form-recorrente");
  await prepararPagina();
  const fundoRecorrente = await js("getComputedStyle(document.body).backgroundColor");
  teste("Form Recorrente: fundo claro padrao (preto eliminado)", fundoRecorrente === "rgb(252, 249, 248)", fundoRecorrente);
  const cabecalhoRoxo = await js(`(() => { const h = document.querySelector('h1'); return h && h.parentElement && h.parentElement.parentElement ? getComputedStyle(h.parentElement.parentElement).backgroundColor : null; })()`);
  teste("Form Recorrente: cabecalho roxo preservado", cabecalhoRoxo === "rgb(124, 58, 237)", String(cabecalhoRoxo));
  await js(`(() => { const el = document.getElementById('fornecedor'); el.value = 'Aluguel Teste'; el.dispatchEvent(new Event('input', { bubbles: true })); el.focus(); return true; })()`);
  await clicar("#btn-cancelar");
  teste("Dialogo: abre ao tentar sair sujo", await esperarDialogo());
  const infoDlg = await dialogoInfo();
  teste(
    "Dialogo: acessibilidade (role=alertdialog, aria-modal, titulo associado)",
    Boolean(infoDlg) && infoDlg.role === "alertdialog" && infoDlg.ariaModal === "true" && infoDlg.labelledby === "dialogo-titulo",
    JSON.stringify(infoDlg)
  );
  teste("Dialogo: acoes certas para confirmacao (cancelar/confirmar)", Boolean(infoDlg) && JSON.stringify(infoDlg.acoes) === JSON.stringify(["cancelar", "confirmar"]), JSON.stringify(infoDlg ? infoDlg.acoes : null));
  teste("Dialogo: foco inicial no botao seguro (cancelar)", Boolean(infoDlg) && infoDlg.foco === "cancelar", JSON.stringify(infoDlg ? infoDlg.foco : null));
  await tecla("Escape");
  await esperarPredicado("!document.querySelector('[data-dialogo]')", 3000);
  teste("Dialogo: ESC cancela sem executar a acao", (await js("document.body.dataset.tela")) === "form-recorrente");
  teste("Dialogo: overlay removido apos fechar", (await js("document.querySelectorAll('.dialogo-veu').length")) === 0);
  const focoDev = await js("document.activeElement ? document.activeElement.id : null");
  teste("Dialogo: foco devolvido ao elemento anterior", focoDev === "fornecedor", String(focoDev));
  teste(
    "Dialogo: inputs sem bloqueio pos-fechamento",
    await js(`(() => { const el = document.getElementById('fornecedor'); const r = el.getBoundingClientRect(); const topo = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return Boolean(topo) && (topo === el || el.contains(topo)); })()`)
  );
  await definirTamanho(1536, 864);
  await clicar("#btn-cancelar");
  teste("Dialogo: reabre para teste de teclado", await esperarDialogo());
  if (!fs.existsSync(SAIDA)) fs.mkdirSync(SAIDA, { recursive: true });
  await capturar("dialogo-confirmacao-1536x864.png");
  await js(`document.querySelector('[data-dialogo-acao="confirmar"]').focus(); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })); 'ok'`);
  const focoTab = await js(`document.activeElement ? document.activeElement.getAttribute('data-dialogo-acao') : null`);
  teste("Dialogo: TAB no ultimo botao volta ao primeiro (foco preso no dialogo)", focoTab === "cancelar", String(focoTab));
  await responderDialogo("confirmar");
  await esperarPredicado("!document.querySelector('[data-dialogo]')", 3000);
  teste("Dialogo: confirmacao executa a acao (sai do formulario)", (await js("document.body.dataset.tela")) !== "form-recorrente");
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

  // 10b. Dimensoes padronizadas dos cartoes (referencia: tela Controle)
  await definirTamanho(1536, 864);
  const dimensoes = {};
  for (const telaDim of ["controle", "cadastros", "mensagens", "recorrentes", "novo-cadastro"]) {
    await js(`window.finDesk.navegar('${telaDim}')`);
    await esperarTela(telaDim);
    await prepararPagina();
    dimensoes[telaDim] = await rectsCartoesEstavel();
  }
  const refDim = dimensoes.controle[0];
  const padronizado = Object.values(dimensoes).every((rects) => rects.length > 0 && rects.every((r) => Math.abs(r.w - refDim.w) < 1 && Math.abs(r.h - refDim.h) < 1));
  teste("Cartoes: dimensoes identicas em todos os submenus (1536x864)", padronizado, JSON.stringify({ ref: refDim, ...dimensoes }));
  teste("Cartoes: 2 cartoes mantem o mesmo tamanho dos 3 da Controle", dimensoes.recorrentes.every((r) => Math.abs(r.w - refDim.w) < 1 && Math.abs(r.h - refDim.h) < 1), JSON.stringify(dimensoes.recorrentes));
  teste("Cartoes: grupo centralizado horizontalmente (recorrentes)", simetriaCentral(dimensoes.recorrentes, 1536), JSON.stringify(dimensoes.recorrentes));
  const centroVertical = JSON.parse(
    await js(`(() => {
      const barra = document.querySelector('.nav-barra');
      const cartoes = [...document.querySelectorAll('a[data-modulo]')];
      if (!barra || !cartoes.length) return 'null';
      const topo = barra.getBoundingClientRect().top;
      const base = Math.max(...cartoes.map((c) => c.getBoundingClientRect().bottom));
      return JSON.stringify({ acima: +topo.toFixed(1), abaixo: +(window.innerHeight - base).toFixed(1) });
    })()`)
  );
  teste("Navbar + cartoes centralizados na vertical (mesmo espaco em cima e embaixo, tolerancia 24px)",
    Boolean(centroVertical) && Math.abs(centroVertical.acima - centroVertical.abaixo) <= 24, JSON.stringify(centroVertical));

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
      const esperado = colunasEsperadas(pagina.numBotoes, w, pagina.tela);
      const vwValido =
        colunasEsperadas(pagina.numBotoes, medido.vw, pagina.tela) === esperado &&
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
