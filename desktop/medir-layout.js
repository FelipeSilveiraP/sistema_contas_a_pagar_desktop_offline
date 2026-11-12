// Medicao de layout: rolagem e centralizacao de todas as telas em resolucoes comuns.
// Uso: npx electron desktop/medir-layout.js [--capturas]
// Banco isolado em tmp (nunca toca o banco operacional).
const { app } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");

const BANCO = path.join(os.tmpdir(), "contas-a-pagar-layout.db");
for (const s of ["", "-wal", "-shm"]) { try { fs.unlinkSync(BANCO + s); } catch { /* nao existia */ } }
process.env.FINDESK_DB_PATH = BANCO;

const CAPTURAS = process.argv.includes("--capturas");
const SAIDA = path.join(os.tmpdir(), "findesk-layout");
fs.mkdirSync(SAIDA, { recursive: true });

const TELAS = ["menu", "controle", "cadastros", "mensagens", "recorrentes", "novo-cadastro",
  "form-banco", "form-pagador", "form-empresa", "todos-cadastros", "inserir-conta",
  "todas-as-contas", "pagos", "recorrentes-tabela", "form-recorrente", "todas-as-mensagens",
  "criar-mensagem", "graficos"];
const TAMANHOS = [[1366, 768], [1536, 864], [1920, 1080]];

let janela = null;
app.on("browser-window-created", (_e, w) => { if (!janela) janela = w; });
require("./main.js");

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const js = (c) => janela.webContents.executeJavaScript(c);

async function esperarTela(tela) {
  for (let i = 0; i < 100; i++) {
    try { if (await js(`document.body?.dataset.tela === ${JSON.stringify(tela)} && document.body.dataset.pronto === 'true'`)) return true; } catch { /* carregando */ }
    await esperar(150);
  }
  return false;
}

async function tamanho(w, h) {
  for (let i = 0; i < 20; i++) {
    janela.setContentSize(w, h);
    await esperar(300);
    const d = JSON.parse(await js("JSON.stringify([innerWidth, innerHeight])"));
    if (Math.abs(d[0] - w) <= 2 && Math.abs(d[1] - h) <= 2) return;
  }
}

const MEDIR = `(() => {
  const d = document.documentElement;
  const nav = document.querySelector('.nav-barra');
  const r = (el) => { const b = el.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom }; };
  // conteudo = uniao dos filhos visiveis do body, exceto navbar, dialogos e overlays fixos
  let c = null;
  for (const el of document.body.querySelectorAll('body > *')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.position === 'fixed' || el.tagName === 'SCRIPT') continue;
    if (el.contains(nav) && nav) {
      for (const f of el.children) { const fs = getComputedStyle(f); if (!f.contains(nav) && fs.display !== 'none' && fs.position !== 'fixed') { const b = r(f); c = c ? { l: Math.min(c.l,b.l), r: Math.max(c.r,b.r), t: Math.min(c.t,b.t), b: Math.max(c.b,b.b) } : b; } }
      continue;
    }
    const b = r(el); if (b.r - b.l < 2) continue;
    c = c ? { l: Math.min(c.l,b.l), r: Math.max(c.r,b.r), t: Math.min(c.t,b.t), b: Math.max(c.b,b.b) } : b;
  }
  const n = nav && getComputedStyle(nav).display !== 'none' ? r(nav) : null;
  return JSON.stringify({
    rolagemV: Math.max(d.scrollHeight - d.clientHeight, document.body.scrollHeight - document.body.clientHeight),
    rolagemH: Math.max(d.scrollWidth - d.clientWidth, document.body.scrollWidth - document.body.clientWidth),
    tabelaH: Math.max(0, ...[...document.querySelectorAll('table')].map((tb) => { const p = tb.parentElement; return p ? p.scrollWidth - p.clientWidth : 0; })),
    navDesvio: n ? Math.round(((n.l + n.r) / 2) - innerWidth / 2) : null,
    conteudoDesvioH: c ? Math.round(((c.l + c.r) / 2) - innerWidth / 2) : null,
    navTopo: n ? Math.round(n.t) : null,
    espacoAcima: c ? Math.round(c.t - (n ? n.b : 0)) : null,
    espacoAbaixo: c ? Math.round(innerHeight - c.b) : null,
    alturaConteudo: c ? Math.round(c.b - c.t) : null,
  });
})()`;

(async () => {
  while (!janela) await esperar(100);
  janela.setIgnoreMouseEvents(true);
  for (let i = 0; i < 200 && !(await js("document.body?.dataset.tela === 'menu'").catch(() => false)); i++) await esperar(150);
  const linhas = [];
  for (const tela of TELAS) {
    await js(`window.finDesk.navegar(${JSON.stringify(tela)})`);
    await esperarTela(tela);
    for (const [w, h] of TAMANHOS) {
      await tamanho(w, h);
      await esperar(250);
      const m = JSON.parse(await js(MEDIR));
      linhas.push({ tela, res: `${w}x${h}`, ...m });
      if (CAPTURAS) fs.writeFileSync(path.join(SAIDA, `${tela}-${w}x${h}.png`), (await janela.webContents.capturePage()).toPNG());
    }
  }
  console.log("RESULTADO " + JSON.stringify(linhas));
  if (CAPTURAS) console.log("capturas em " + SAIDA);
  app.quit();
})();
