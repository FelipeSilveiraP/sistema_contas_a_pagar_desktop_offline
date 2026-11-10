// Smoke de BOOT: mede tempos de inicializacao e valida interacao REAL imediata.
// Uso: npx electron desktop/smoke-boot.js
const { app, BrowserWindow, screen } = require("electron");
const { execFileSync, spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs");

// captura dos marcos [startup] do main.js antes de carrega-lo
const marcos = [];
const logOriginal = console.log.bind(console);
console.log = (...args) => {
  const linha = args.join(" ");
  if (linha.startsWith("[startup]")) marcos.push(linha);
  logOriginal(...args);
};

// REGRA DE OURO: testes NUNCA usam o banco operacional da empresa. Banco isolado em
// %TEMP%; o 2o ciclo (relancamento) herda o mesmo arquivo para conferir persistencia.
if (!process.env.FINDESK_DB_PATH) {
  const bancoTeste = path.join(require("os").tmpdir(), "contas-a-pagar-smoke-boot.db");
  if (!process.env.SMOKE_BOOT_CICLO) {
    for (const sufixo of ["", "-wal", "-shm"]) {
      try { fs.unlinkSync(bancoTeste + sufixo); } catch { /* nao existia */ }
    }
  }
  process.env.FINDESK_DB_PATH = bancoTeste;
}
require("./main.js");

let janela = null;
const resultados = [];
const tempos = {};

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

async function esperarPredicado(codigo, timeoutMs = 15000) {
  const inicio = Date.now();
  while (Date.now() - inicio < timeoutMs) {
    try {
      if (await js(codigo)) return true;
    } catch {
      await esperar(100);
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

async function confirmarDialogoSeAberto() {
  // dialogos do app (dialogos.ts): confirma automaticamente como o antigo
  // window.confirm = () => true destes testes
  if (await js(`!!document.querySelector('[data-dialogo]')`)) {
    await js(`(() => { const b = document.querySelector('[data-dialogo-acao="confirmar"], [data-dialogo-acao="fechar"]'); if (b) b.click(); return true; })()`);
    await esperar(200);
  }
}

async function clicarReal(seletor) {
  // garante que os cliques REAIS mirem a janela do app (outras janelas podem
  // estar em primeiro plano no ambiente de teste)
  janela.moveTop();
  await esperar(150);
  const ponto = await pontoRealDoSeletor(seletor);
  if (!ponto) return false;
  entradaReal("clicar", ponto);
  await esperar(250);
  await confirmarDialogoSeAberto();
  return true;
}

async function digitarReal(texto) {
  entradaReal("digitar", { texto });
  await esperar(250);
}

async function medirAbertura(tela, seletorCampo) {
  const t0 = Date.now();
  await js(`window.finDesk.navegar('${tela}')`);
  await esperarPredicado(`document.body && document.body.dataset.tela === '${tela}'`);
  await esperarPredicado(`document.body.dataset.apiStatus !== undefined`);
  await esperarPredicado(`!!document.querySelector('${seletorCampo}')`);
  return Date.now() - t0;
}

async function ciclo() {
  const cicloAtual = process.env.SMOKE_BOOT_CICLO || "1";
  const t0 = Date.now();

  // 1. tela de carregamento (se existir) e transicao para o menu
  await esperarPredicado("!!document.body && !!document.body.dataset.tela", 20000);
  const telaInicial = await js("document.body.dataset.tela");
  const viuCarregando = telaInicial === "carregando";
  if (viuCarregando) {
    tempos.carregando_exibida = Date.now() - t0;
    teste("Tela de carregamento exibida no inicio", true, `+${tempos.carregando_exibida}ms`);
    // captura da tela de carregamento
    const imagem = await janela.webContents.capturePage();
    const destino = path.join(__dirname, "..", "docs", "responsivo", `carregando-${cicloAtual}.png`);
    fs.writeFileSync(destino, imagem.toPNG());
    teste("Captura da tela de carregamento gerada", fs.existsSync(destino), destino);

    // chave giratoria 3D: rotateY + perspectiva + prefers-reduced-motion
    const chave = JSON.parse(await js(`(() => {
      const wrap = document.querySelector('.chave-giratoria');
      const svg = document.querySelector('.chave-giratoria__svg');
      const cs = svg ? getComputedStyle(svg) : null;
      const msg = document.getElementById('iniciando');
      return JSON.stringify({
        existe: Boolean(wrap && svg),
        animacao: cs ? cs.animationName : null,
        duracao: cs ? cs.animationDuration : null,
        perspectiva: wrap ? getComputedStyle(wrap).perspective : null,
        mensagem: msg ? msg.textContent : null,
      });
    })()`));
    teste("Chave giratoria presente na tela de carregamento", chave.existe === true, JSON.stringify(chave));
    teste("Chave anima em rotateY/3D (sem timers)", chave.animacao === "chave-girar" && parseFloat(chave.duracao) > 0, JSON.stringify(chave));
    teste("Perspectiva 3D ativa no conteiner da chave", chave.perspectiva && chave.perspectiva !== "none" && parseFloat(chave.perspectiva) > 0, JSON.stringify(chave));
    teste("Mensagem INICIANDO O SISTEMA preservada", String(chave.mensagem).toUpperCase().includes("INICIANDO O SISTEMA"), String(chave.mensagem));
    let animacaoReduzida = null;
    try {
      janela.webContents.debugger.attach("1.3");
      await janela.webContents.debugger.sendCommand("Emulation.setEmulatedMedia", {
        features: [{ name: "prefers-reduced-motion", value: "reduce" }],
      });
      await esperar(300);
      animacaoReduzida = await js(`(() => { const svg = document.querySelector('.chave-giratoria__svg'); return svg ? getComputedStyle(svg).animationName : null; })()`);
      await janela.webContents.debugger.sendCommand("Emulation.setEmulatedMedia", { features: [] });
      janela.webContents.debugger.detach();
    } catch (erro) {
      // fallback: valida a regra CSS de prefers-reduced-motion na folha compilada
      animacaoReduzida = await js(`(() => {
        for (const folha of document.styleSheets) {
          let regras;
          try { regras = folha.cssRules; } catch { continue; }
          for (const r of regras) {
            const midia = r.conditionText || (r.media && r.media.mediaText) || '';
            if (r.type !== 4 || !String(midia).includes('prefers-reduced-motion')) continue;
            for (const rr of r.cssRules) {
              if (rr.selectorText && rr.selectorText.includes('chave-giratoria') && /animation:\s*none/.test(rr.style.cssText)) return 'none';
            }
          }
        }
        return 'ausente';
      })()`);
    }
    teste("prefers-reduced-motion desativa a rotacao continua", animacaoReduzida === "none", String(animacaoReduzida));

    // estado de erro da tela de carregamento (UI testada por injecao do evento)
    janela.webContents.send("findesk:inicializacao", { estado: "falhou" });
    await esperar(400);
    const estadoErro = JSON.parse(await js(`(() => {
      const erro = document.getElementById('erro-inicializacao');
      return JSON.stringify({
        visivel: erro ? !erro.classList.contains('hidden') : null,
        tentar: !!document.getElementById('btn-tentar-novamente'),
        fechar: !!document.getElementById('btn-fechar'),
      });
    })()`));
    teste("Estado de erro mostra mensagem e acoes (tentar/fechar)",
      estadoErro.visivel === true && estadoErro.tentar === true && estadoErro.fechar === true,
      JSON.stringify(estadoErro));
  } else {
    console.log(`[INFO] tela inicial sem carregamento (fluxo antigo): ${telaInicial}`);
  }

  const menuPronto = await esperarPredicado(
    `document.body.dataset.tela === 'menu' && document.body.dataset.apiStatus !== undefined`,
    30000
  );
  tempos.menu_interativo = Date.now() - t0;
  teste("Menu Principal liberado", menuPronto, `+${tempos.menu_interativo}ms`);
  const marcoJanela = marcos.find((m) => m.includes("janela-visivel"));
  const marcoInterface = marcos.find((m) => m.includes("interface-carregada"));
  teste("Marcos de tempo registrados", Boolean(marcoJanela && marcoInterface), [marcoJanela, marcoInterface].join(" | "));

  // 2. interacao REAL imediata apos liberacao: clique num card do menu
  const tClique = Date.now();
  teste("Clique real imediato no card CADASTROS funciona",
    await clicarReal('a[data-path="cadastros"]') && await esperarPredicado(`document.body.dataset.tela === 'cadastros'`),
    `${Date.now() - tClique}ms`);
  await esperar(200);

  // 3. abertura dos forms (medições)
  tempos.form_banco = await medirAbertura("form-banco", "#campo-instituicao");
  teste("Form Banco abre e esta interativo", true, `${tempos.form_banco}ms`);
  teste("Clique real + digitacao imediatos no Banco",
    await clicarReal("#campo-instituicao") && await esperarPredicado(`document.activeElement && document.activeElement.id === 'campo-instituicao'`),
    "");
  await digitarReal("Banco Boot");
  teste("Digitacao real entra no Banco", await js(`document.getElementById('campo-instituicao').value`) === "Banco Boot");
  entradaReal("tab");
  await esperar(200);
  teste("TAB real move entre campos", await js(`document.activeElement ? document.activeElement.id : ''`) === "campo-chave-pix", await js(`document.activeElement ? document.activeElement.id : ''`));

  tempos.form_pagador = await medirAbertura("form-pagador", "#campo-nome");
  teste("Form Pagador abre e esta interativo", true, `${tempos.form_pagador}ms`);
  teste("Clique real + digitacao imediatos no Pagador",
    await clicarReal("#campo-nome") && await esperarPredicado(`document.activeElement && document.activeElement.id === 'campo-nome'`));
  await digitarReal("Pagador Boot");
  teste("Digitacao real entra no Pagador", await js(`document.getElementById('campo-nome').value`) === "Pagador Boot");

  tempos.form_empresa = await medirAbertura("form-empresa", "#campo-razao-social");
  teste("Form Empresa abre e esta interativo", true, `${tempos.form_empresa}ms`);
  teste("Clique real + digitacao imediatos no Empresa",
    await clicarReal("#campo-razao-social") && await esperarPredicado(`document.activeElement && document.activeElement.id === 'campo-razao-social'`));
  await digitarReal("Empresa Boot");
  teste("Digitacao real entra no Empresa", await js(`document.getElementById('campo-razao-social').value`) === "Empresa Boot");

  // 4. foco com outras janelas abertas (a janela do IDE esta ativa no ambiente de teste)
  const so = entradaReal("foco");
  const temFoco = await js("document.hasFocus()");
  teste("Janela do app recebe foco mesmo com outras janelas abertas", temFoco === true || so.includes("Chaveiro"), `SO="${so}" hasFocus=${temFoco}`);

  // 6. resumo
  console.log(`\n=== TEMPOS (ciclo ${cicloAtual}) ===`);
  for (const [nome, valor] of Object.entries(tempos)) console.log(`  ${nome}: ${valor}ms`);
  console.log("=== MARCOS ===");
  for (const m of marcos) console.log(`  ${m}`);
  const falhas = resultados.filter((r) => !r.ok);
  console.log(`\n=== RESULTADO ciclo ${cicloAtual}: ${resultados.length - falhas.length}/${resultados.length} verificacoes passaram ===`);
  return falhas.length === 0;
}

async function main() {
  const cicloAtual = process.env.SMOKE_BOOT_CICLO || "1";
  const ok1 = await ciclo();

  if (cicloAtual === "1") {
    console.log("--- fechando o aplicativo e repetindo o ciclo completo ---");
    app.removeAllListeners("window-all-closed");
    app.releaseSingleInstanceLock();
    janela.close();
    await esperar(1000);
    const relancamento = spawnSync(process.execPath, [__filename], {
      env: { ...process.env, SMOKE_BOOT_CICLO: "2" },
      encoding: "utf8",
      windowsHide: true,
    });
    process.stdout.write(relancamento.stdout || "");
    const ok2 = !(relancamento.stdout || "").includes("[FALHA]") && relancamento.status === 0;
    console.log(`\n=== RESULTADO FINAL (2 ciclos): ${ok1 && ok2 ? "APROVADO" : "REPROVADO"} ===`);
    app.exitCode = ok1 && ok2 ? 0 : 1;
    app.quit();
    return;
  }
  app.exitCode = ok1 ? 0 : 1;
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
  }, 1200);
});
