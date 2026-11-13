// Regressao do hamburguer (botao do menu em janela estreita): cada tela abre
// LARGA e e estreitada passo a passo, como o usuario faz com o mouse. Em toda
// largura o hamburguer precisa ficar na borda esquerda do conteudo (o painel ou
// cartao mais a esquerda) e a pagina nao pode ficar mais larga que a janela.
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
const LARGURAS = [1000, 940, 880, 820, 768, 700, 640, 600, 590, 560, 520, 480];
const MEDIR = `(() => {
  const h = document.querySelector('.nav-hamburguer');
  if (!h || getComputedStyle(h).display === 'none') return JSON.stringify({ visivel: false });
  const raiz = document.getElementById('nav-global');
  let menor = Infinity;
  for (const e of raiz.nextElementSibling.querySelectorAll('*')) {
    const r = e.getBoundingClientRect(); const cs = getComputedStyle(e);
    if (r.width < 40 || r.height < 30 || r.left < 0) continue;
    if (parseFloat(cs.borderLeftWidth) > 0 || cs.backgroundColor !== 'rgba(0, 0, 0, 0)') menor = Math.min(menor, r.left);
  }
  return JSON.stringify({ visivel: true, ham: Math.round(h.getBoundingClientRect().left), conteudo: Number.isFinite(menor) ? Math.round(menor) : null,
    rolagemH: document.documentElement.scrollWidth - innerWidth });
})()`;
(async () => {
  while (!janela) await esperar(100);
  for (let i = 0; i < 200 && !(await js("document.body?.dataset.tela === 'menu'").catch(() => false)); i++) await esperar(150);
  let ok = 0;
  let total = 0;
  for (const tela of TELAS) {
    janela.setContentSize(1400, 850);
    await esperar(300);
    await js(`window.finDesk.navegar(${JSON.stringify(tela)})`);
    for (let i = 0; i < 60 && !(await js(`document.body?.dataset.tela === '${tela}'`).catch(() => false)); i++) await esperar(150);
    await esperar(600);
    for (const w of LARGURAS) {
      janela.setContentSize(w, 850);
      await esperar(500);
      const m = JSON.parse(await js(MEDIR));
      const certo = !m.visivel || (m.conteudo !== null && Math.abs(m.ham - m.conteudo) <= 2 && m.rolagemH <= 0);
      total++;
      if (certo) ok++;
      console.log(`${certo ? "[OK]    " : "[FALHA] "} ${w}px ${tela.padEnd(20)} ${certo ? "" : JSON.stringify(m)}`);
    }
  }
  console.log(`
=== RESULTADO HAMBURGUER: ${ok}/${total} verificacoes passaram ===`);
  app.exit(ok === total ? 0 : 1);
})();
