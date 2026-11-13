// Regressao do hamburguer (botao do menu em janela estreita). Decisao 2026-11-13:
// ele fica SEMPRE no mesmo lugar (canto superior esquerdo), numa faixa fixa no topo.
// Cada tela abre LARGA e e estreitada passo a passo, como o usuario faz com o mouse.
// Em toda largura confere: botao a 16 px da esquerda e 12 px do topo; no mesmo
// lugar depois de rolar a pagina; nenhum conteudo escondido atras da faixa; e
// pagina sem ficar mais larga que a janela.
// Uso: npx electron desktop/teste-hamburguer.js   (banco temporario)
const { app } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const PASTA = fs.mkdtempSync(path.join(os.tmpdir(), "findesk-hamburguer-"));
process.env.FINDESK_DB_PATH = path.join(PASTA, "banco.db");
let janela = null;
app.on("browser-window-created", (_e, w) => { if (!janela) janela = w; });
require("./main.js");
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const js = (c) => janela.webContents.executeJavaScript(c);
const TELAS = ["controle", "cadastros", "mensagens", "recorrentes", "novo-cadastro", "form-banco", "form-pagador", "form-empresa",
  "todos-cadastros", "inserir-conta", "todas-as-contas", "pagos", "recorrentes-tabela", "form-recorrente", "todas-as-mensagens", "criar-mensagem", "graficos"];
const LARGURAS = [1000, 900, 820, 768, 700, 640, 600, 560, 520, 480];
const ESQUERDA = 16;
const TOPO = 12;

const MEDIR = `(() => {
  const h = document.querySelector('.nav-hamburguer');
  if (!h || getComputedStyle(h).display === 'none') return JSON.stringify({ visivel: false });
  const faixa = document.getElementById('nav-global').getBoundingClientRect();
  const r = h.getBoundingClientRect();
  // conteudo visivel mais alto da pagina (sem rolar): precisa comecar abaixo da faixa
  let topoConteudo = Infinity;
  const raiz = document.getElementById('nav-global');
  const area = raiz.parentElement === document.body ? raiz.nextElementSibling : raiz.parentElement;
  for (const e of area.querySelectorAll('*')) {
    if (raiz.contains(e)) continue;
    const b = e.getBoundingClientRect();
    if (b.width > 0 && b.height > 0) topoConteudo = Math.min(topoConteudo, b.top);
  }
  return JSON.stringify({ visivel: true, esquerda: Math.round(r.left), topo: Math.round(r.top),
    faixaFim: Math.round(faixa.bottom), faixaLargura: Math.round(faixa.width), janela: innerWidth,
    topoConteudo: Math.round(topoConteudo), rolagemH: document.documentElement.scrollWidth - innerWidth });
})()`;

(async () => {
  while (!janela) await esperar(100);
  for (let i = 0; i < 200 && !(await js("document.body?.dataset.tela === 'menu'").catch(() => false)); i++) await esperar(150);
  let ok = 0;
  let total = 0;
  const conferir = (nome, certo, detalhe) => {
    total++;
    if (certo) ok++;
    console.log(`${certo ? "[OK]    " : "[FALHA] "} ${nome}${certo ? "" : ` — ${detalhe}`}`);
  };
  for (const tela of TELAS) {
    janela.setContentSize(1400, 850);
    await esperar(300);
    await js(`window.finDesk.navegar(${JSON.stringify(tela)})`);
    for (let i = 0; i < 60 && !(await js(`document.body?.dataset.tela === '${tela}'`).catch(() => false)); i++) await esperar(150);
    await esperar(600);
    for (const w of LARGURAS) {
      janela.setContentSize(w, 700);
      await esperar(400);
      const m = JSON.parse(await js(MEDIR));
      conferir(`${tela} ${w}px: botao no canto (16, 12), faixa inteira, conteudo abaixo da faixa`,
        m.visivel && Math.abs(m.esquerda - ESQUERDA) <= 1 && Math.abs(m.topo - TOPO) <= 1 && m.faixaLargura === m.janela
          && m.topoConteudo >= m.faixaFim && m.rolagemH <= 0, JSON.stringify(m));
    }
    // rolando ate o fim, o botao continua no mesmo lugar
    await js("(document.scrollingElement || document.documentElement).scrollTop = 99999; document.body.scrollTop = 99999; true");
    await esperar(300);
    const rolado = JSON.parse(await js(MEDIR));
    conferir(`${tela}: botao parado no canto mesmo rolando a pagina`,
      rolado.visivel && Math.abs(rolado.esquerda - ESQUERDA) <= 1 && Math.abs(rolado.topo - TOPO) <= 1, JSON.stringify(rolado));
  }
  // 1024 px ou mais: barra completa, sem hamburguer
  janela.setContentSize(1280, 800);
  await esperar(500);
  const largo = JSON.parse(await js(MEDIR));
  conferir("1280px: barra completa (sem hamburguer)", largo.visivel === false, JSON.stringify(largo));
  console.log(`\n=== RESULTADO HAMBURGUER: ${ok}/${total} verificacoes passaram ===`);
  app.exit(ok === total ? 0 : 1);
})();
