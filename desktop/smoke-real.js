// Smoke de ENTRADA REAL (cliques e teclado do Windows via SendInput).
// Cobertura exigida pelo usuario: abrir o app, navegar ate o form, clicar no
// primeiro input, digitar, TAB entre campos, apagar/editar, ir a outro form,
// repetir, abrir/fechar navbar, conferir que nada invisivel bloqueia os inputs,
// fechar o app completamente e repetir o ciclo.
const { app, screen, BrowserWindow } = require("electron");
const { execFileSync, spawnSync } = require("child_process");
const path = require("path");
require("./main.js");

let janela = null;
const resultados = [];

function teste(nome, ok, detalhe = "") {
  resultados.push({ nome, ok });
  console.log(`${ok ? "[OK]    " : "[FALHA]"} ${nome}${detalhe ? " — " + detalhe : ""}`);
}

function esperar(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function js(codigo) {
  return janela.webContents.executeJavaScript(codigo);
}

async function esperarPredicado(codigo, timeoutMs = 12000) {
  const inicio = Date.now();
  while (Date.now() - inicio < timeoutMs) {
    try {
      if (await js(codigo)) return true;
    } catch {
      await esperar(150);
    }
  }
  return false;
}

function entradaReal(acao, extra = {}) {
  const args = ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", path.join(__dirname, "entrada-real.ps1"), "-Acao", acao];
  if (extra.x !== undefined) args.push("-X", String(extra.x), "-Y", String(extra.y));
  try {
    return execFileSync("powershell.exe", args, {
      encoding: "utf8",
      windowsHide: true,
      env: { ...process.env, ENTRADA_TEXTO: extra.texto ?? "" },
    }).trim();
  } catch (erro) {
    return `ERRO: ${erro.message}`;
  }
}

async function pontoRealDoSeletor(seletor) {
  const rect = JSON.parse(await js(`(() => {
    const el = document.querySelector(${JSON.stringify(seletor)});
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return JSON.stringify({ x: r.x + r.width / 2, y: r.y + r.height / 2 });
  })()`));
  if (!rect) return null;
  const conteudo = janela.getContentBounds();
  const fisico = screen.dipToScreenPoint({ x: Math.round(conteudo.x + rect.x), y: Math.round(conteudo.y + rect.y) });
  const display = screen.getPrimaryDisplay();
  const origem = screen.dipToScreenPoint({ x: 0, y: 0 });
  const fim = screen.dipToScreenPoint({ x: display.bounds.width, y: display.bounds.height });
  return {
    x: Math.round(((fisico.x - origem.x) / (fim.x - origem.x)) * 65535),
    y: Math.round(((fisico.y - origem.y) / (fim.y - origem.y)) * 65535),
  };
}

async function clicarReal(seletor) {
  // cada loadFile troca o documento: reaplicar o override de confirm
  await js(`window.confirm = () => true; 'ok'`);
  const ponto = await pontoRealDoSeletor(seletor);
  if (!ponto) return false;
  entradaReal("clicar", ponto);
  return true;
}

async function digitarReal(texto) {
  entradaReal("digitar", { texto });
  await esperar(300);
}

async function ciclo() {
  await esperarPredicado("!!document.body && !!document.body.dataset.tela");
  await esperarPredicado(`document.body.dataset.apiStatus !== undefined`);
  await js(`window.confirm = () => true; 'ok'`);

  // 1. nada invisivel bloqueia os inputs do form-banco (verificado no proprio form)
  await js("window.finDesk.navegar('form-banco')");
  await esperarPredicado(`document.body.dataset.tela === 'form-banco'`);
  await esperar(400);
  const bloqueios = JSON.parse(await js(`(() => {
    const ids = ['campo-instituicao', 'campo-chave-pix'];
    const res = {};
    for (const id of ids) {
      const el = document.getElementById(id);
      const r = el.getBoundingClientRect();
      const topo = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      res[id] = topo ? (topo.tagName + '#' + topo.id) : null;
    }
    return JSON.stringify(res);
  })()`));
  teste(
    "Nenhum elemento invisivel bloqueia os inputs",
    Object.values(bloqueios).every((v) => v && v.startsWith("INPUT#campo-")),
    JSON.stringify(bloqueios)
  );

  // 2. fluxo UI real: Menu -> Cadastros -> Novo Cadastro -> Banco
  await js("window.finDesk.navegar('menu')");
  await esperarPredicado(`document.body.dataset.tela === 'menu'`);
  await esperar(400);
  teste("Menu -> Cadastros (clique real)", await clicarReal('a[data-path="cadastros"]') && await esperarPredicado(`document.body.dataset.tela === 'cadastros'`));
  await esperar(300);
  teste("Cadastros -> Novo Cadastro (clique real)", await clicarReal('a[data-modulo="novo-cadastro"]') && await esperarPredicado(`document.body.dataset.tela === 'novo-cadastro'`));
  await esperar(300);
  teste("Novo Cadastro -> Banco (clique real)", await clicarReal('a[data-modulo="banco"]') && await esperarPredicado(`document.body.dataset.tela === 'form-banco'`));
  await esperar(400);

  // 3. clique real no primeiro input + digitacao real
  teste("Clique real no primeiro input foca o campo", await clicarReal("#campo-instituicao") && await esperarPredicado(`document.activeElement && document.activeElement.id === 'campo-instituicao'`));
  await digitarReal("Banco Digitado Real");
  teste("Digitacao real entra no input", await js(`document.getElementById('campo-instituicao').value`) === "Banco Digitado Real");

  // 4. TAB alterna campos
  entradaReal("tab");
  await esperar(300);
  teste("TAB real move o foco ao proximo campo", await js(`document.activeElement && document.activeElement.id`) === "campo-chave-pix", await js(`document.activeElement ? document.activeElement.id : null`));
  await digitarReal("pix@exemplo.com");

  // 5. apagar e editar
  entradaReal("backspace");
  await esperar(200);
  await digitarReal("br");
  teste("Backspace + edicao real funcionam", await js(`document.getElementById('campo-chave-pix').value`) === "pix@exemplo.cobr", await js(`document.getElementById('campo-chave-pix').value`));

  // 6. navegar a outro formulario e repetir
  teste("VOLTAR (clique real) retorna a Novo Cadastro", await clicarReal('.nav-barra button[data-nav="voltar"]') && await esperarPredicado(`document.body.dataset.tela === 'novo-cadastro'`));
  await esperar(300);
  teste("Novo Cadastro -> Pagador (clique real)", await clicarReal('a[data-modulo="pagador"]') && await esperarPredicado(`document.body.dataset.tela === 'form-pagador'`));
  await esperar(400);
  teste("Clique real no input do form-pagador foca o campo", await clicarReal("#campo-nome") && await esperarPredicado(`document.activeElement && document.activeElement.id === 'campo-nome'`));
  await digitarReal("Maria Real");
  teste("Digitacao real funciona no form-pagador", await js(`document.getElementById('campo-nome').value`) === "Maria Real", await js(`document.getElementById('campo-nome').value`));

  // 7. abrir e fechar a navbar (compacto: hamburguer; desktop: barra)
  await janela.setSize(480, 800);
  await esperar(400);
  teste("Compacto: hamburguer real abre o menu", await clicarReal(".nav-hamburguer") && await esperarPredicado(`document.getElementById('nav-global').dataset.menuAberto === 'true'`));
  await esperar(400);
  teste("Painel/veu visiveis com o menu aberto", await js(`(() => {
    const veu = getComputedStyle(document.querySelector('.nav-veu'));
    const painel = getComputedStyle(document.querySelector('.nav-painel'));
    return veu.visibility === 'visible' && painel.visibility === 'visible';
  })()`));
  teste("Clique real no veu fecha o menu", await clicarReal(".nav-veu") && await esperarPredicado(`document.getElementById('nav-global').dataset.menuAberto === 'false'`));
  teste("Hamburguer real reabre o menu", await clicarReal(".nav-hamburguer") && await esperarPredicado(`document.getElementById('nav-global').dataset.menuAberto === 'true'`));
  entradaReal("esc");
  await esperar(300);
  teste("ESC real fecha o menu", await js(`document.getElementById('nav-global').dataset.menuAberto`) === "false");
  await janela.setSize(1500, 950);
  await esperar(300);

  // 8. campos estaveis com o menu aberto (regressao de sobreposicao, mesma janela)
  await js("window.finDesk.navegar('form-banco')");
  await esperarPredicado(`document.body.dataset.tela === 'form-banco'`);
  await esperar(300);
  await janela.setSize(480, 800);
  await esperar(500);
  const antes = await js(`JSON.stringify([...document.querySelectorAll('.form-campo')].map(el => { const r = el.getBoundingClientRect(); return [+r.x.toFixed(1), +r.y.toFixed(1), +r.width.toFixed(1), +r.height.toFixed(1)]; }))`);
  await clicarReal(".nav-hamburguer");
  await esperarPredicado(`document.getElementById('nav-global').dataset.menuAberto === 'true'`);
  await esperar(400);
  const aberto = await js(`JSON.stringify([...document.querySelectorAll('.form-campo')].map(el => { const r = el.getBoundingClientRect(); return [+r.x.toFixed(1), +r.y.toFixed(1), +r.width.toFixed(1), +r.height.toFixed(1)]; }))`);
  teste("Campos dos forms nao se movem com o menu aberto (480x800)", antes === aberto, `${antes} vs ${aberto}`);
  await janela.setSize(1500, 950);
}

async function main() {
  const cicloAtual = process.env.SMOKE_REAL_CICLO || "1";
  console.log(`\n=== SMOKE ENTRADA REAL — ciclo ${cicloAtual} ===`);
  await ciclo();

  if (cicloAtual === "1") {
    // fecha o app COMPLETAMENTE e repete o ciclo inteiro (checklist do usuario)
    console.log("--- fechando o aplicativo e repetindo o ciclo ---");
    app.removeAllListeners("window-all-closed");
    app.releaseSingleInstanceLock();
    janela.close();
    await esperar(1000);
    const relancamento = spawnSync(
      process.execPath,
      [__filename],
      { env: { ...process.env, SMOKE_REAL_CICLO: "2" }, encoding: "utf8", windowsHide: true }
    );
    process.stdout.write(relancamento.stdout || "");
    process.stderr.write(relancamento.stderr || "");
    const falhas2 = (relancamento.stdout || "").includes("[FALHA]");
    const falhas1 = resultados.filter((r) => !r.ok);
    console.log(`\n=== RESULTADO FINAL (2 ciclos): ${falhas1.length === 0 && !falhas2 && relancamento.status === 0 ? "APROVADO" : "REPROVADO"} ===`);
    app.exitCode = falhas1.length === 0 && !falhas2 && relancamento.status === 0 ? 0 : 1;
    app.quit();
    return;
  }

  const falhas = resultados.filter((r) => !r.ok);
  console.log(`\n=== RESULTADO ciclo ${cicloAtual}: ${resultados.length - falhas.length}/${resultados.length} verificacoes passaram ===`);
  if (falhas.length) {
    app.exitCode = 1;
  }
  app.quit();
}

app.on("browser-window-created", (_evento, win) => {
  janela = win;
  win.webContents.on("console-message", (_e, nivel, mensagem) => {
    if (nivel >= 2) console.log("[console.error]", mensagem);
  });
  setTimeout(() => {
    main().catch((erro) => {
      console.error("ERRO FATAL:", erro);
      app.exitCode = 1;
      app.quit();
    });
  }, 1500);
});
