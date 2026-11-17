// ENSAIO COMPLETO DO ATUALIZAR, PELA TELA, num Windows de verdade (GitHub Actions).
// Faz exatamente o que a pessoa da loja faz e confere cada passo, com fotos:
//  1. instala a versao ANTERIOR (a ultima publicada) e abre o programa instalado;
//  2. o pop-up "Nova versao" aparece NO CENTRO da tela;
//  3. clica em ATUALIZAR: pop-up de carregamento no centro, barra e porcentagem AVANCANDO;
//  4. o programa FECHA sozinho depois do download;
//  5. o instalador troca a versao e o programa ABRE DE NOVO sozinho;
//  6. aberto de novo, o rodape mostra a VERSAO NOVA e nao oferece atualizar de novo
//     (nao ficou preso na versao antiga).
// A versao nova vem de um "GitHub" local (FINDESK_API_ATUALIZACOES) que entrega o
// instalador recem-gerado, com o SHA-256 dele, como o GitHub de verdade.
// Uso: node desktop/ensaio-atualizacao-tela.js <instalador-anterior.exe> <instalador-novo.exe> <versao-nova>
// Precisa de: playwright-core (so para conversar com a janela do programa pelo DevTools).
const { execFileSync, spawn } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");
const asar = require("@electron/asar");
const { chromium } = require("playwright-core");

const [anteriorArg, novoArg, versaoNova] = process.argv.slice(2);
const anterior = path.resolve(anteriorArg);
const novo = path.resolve(novoArg);
const EXE = "Contas a Pagar - Chaveiro Universal.exe";
const PASTA = path.join(process.env.LOCALAPPDATA, "Programs", require("../package.json").name);
const DADOS = fs.mkdtempSync(path.join(os.tmpdir(), "ensaio-tela-"));
const FOTOS = path.resolve(process.env.ENSAIO_FOTOS || "ensaio-fotos");
const PORTA_DEPURACAO = 9333;
const PIN = "2468";
fs.mkdirSync(FOTOS, { recursive: true });

const resultados = [];
function teste(nome, ok, detalhe = "") {
  resultados.push({ nome, ok });
  console.log(`${ok ? "[OK]    " : "[FALHA] "} ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
}
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
async function ate(condicao, ms) {
  const inicio = Date.now();
  while (Date.now() - inicio < ms) {
    try {
      if (await condicao()) return true;
    } catch {
      // pagina trocando
    }
    await esperar(250);
  }
  return false;
}

function versaoInstalada() {
  try {
    asar.uncacheAll();
    return JSON.parse(asar.extractFile(path.join(PASTA, "resources", "app.asar"), "package.json").toString()).version;
  } catch {
    return null;
  }
}

function pidsDoPrograma() {
  try {
    const saida = execFileSync("tasklist", ["/FI", `IMAGENAME eq ${EXE}`, "/FO", "CSV", "/NH"], { encoding: "utf8" });
    return saida.split(/\r?\n/).filter((l) => l.startsWith(`"${EXE}"`)).map((l) => Number(l.split('","')[1]));
  } catch {
    return [];
  }
}

function fecharPrograma() {
  try {
    execFileSync("taskkill", ["/IM", EXE, "/T", "/F"], { stdio: "ignore" });
  } catch {
    // ja fechado
  }
}

// ---------- "GitHub" local com a versao nova ----------
function servidorGithub() {
  const bytes = fs.readFileSync(novo);
  const sha = crypto.createHash("sha256").update(bytes).digest("hex");
  const nome = `Contas a Pagar - Chaveiro Universal - Instalador ${versaoNova}.exe`;
  const servidor = http.createServer((req, res) => {
    const base = `http://127.0.0.1:${servidor.address().port}`;
    if (req.url.includes("/releases/latest")) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        tag_name: `v${versaoNova}`,
        name: `Contas a Pagar ${versaoNova}`,
        body: "",
        assets: [{ name: nome, size: bytes.length, digest: `sha256:${sha}`, browser_download_url: `${base}/download/instalador.exe` }],
      }));
      return;
    }
    if (req.url.startsWith("/download/")) {
      // ~8 s de download, como numa internet comum: da tempo de ver a barra andar
      res.writeHead(200, { "Content-Type": "application/octet-stream", "Content-Length": bytes.length });
      const passo = Math.ceil(bytes.length / 40);
      let i = 0;
      const enviar = () => {
        if (i >= bytes.length) return res.end();
        res.write(bytes.subarray(i, i + passo));
        i += passo;
        setTimeout(enviar, 200);
      };
      enviar();
      return;
    }
    res.writeHead(404);
    res.end();
  });
  return new Promise((r) => servidor.listen(0, "127.0.0.1", () => r(servidor)));
}

// ---------- abrir o programa instalado e falar com a janela ----------
let navegador = null;
async function abrirPrograma(api) {
  const proc = spawn(path.join(PASTA, EXE), [`--remote-debugging-port=${PORTA_DEPURACAO}`], {
    detached: true,
    stdio: "ignore",
    env: { ...process.env, FINDESK_API_ATUALIZACOES: api, FINDESK_DB_PATH: path.join(DADOS, "contas_a_pagar.db") },
  });
  proc.unref();
  const saida = { fechou: false };
  proc.on("exit", () => { saida.fechou = true; });
  await ate(async () => {
    navegador = await chromium.connectOverCDP(`http://127.0.0.1:${PORTA_DEPURACAO}`);
    return true;
  }, 60000);
  if (!navegador) throw new Error("nao consegui falar com a janela do programa");
  return { proc, saida };
}

function pagina() {
  for (const contexto of navegador.contexts()) {
    for (const p of contexto.pages()) {
      if (p.url().includes("/frontend/html/")) return p;
    }
  }
  return null;
}

async function noJs(codigo) {
  const p = pagina();
  if (!p) throw new Error("janela ainda carregando");
  return p.evaluate(codigo);
}

async function foto(nome) {
  try {
    await pagina().screenshot({ path: path.join(FOTOS, nome) });
    console.log(`         foto: ${nome}`);
  } catch (erro) {
    console.log(`         (sem foto ${nome}: ${erro.message.split("\n")[0]})`);
  }
}

/** Centro do pop-up a no maximo 6% do centro da janela (na horizontal e na vertical). */
const CENTRO = `(() => {
  const caixa = document.querySelector("[data-dialogo]");
  if (!caixa) return null;
  const r = caixa.getBoundingClientRect();
  const dx = Math.abs(r.left + r.width / 2 - innerWidth / 2) / innerWidth;
  const dy = Math.abs(r.top + r.height / 2 - innerHeight / 2) / innerHeight;
  return { dx: Math.round(dx * 1000) / 10, dy: Math.round(dy * 1000) / 10, ok: dx <= 0.06 && dy <= 0.06 };
})()`;

async function entrarNoMenu(primeiraVez) {
  if (primeiraVez) {
    await ate(() => noJs("document.body.dataset.tela === 'perfis' && document.body.dataset.primeiroAcesso === 'true'"), 90000);
    const p = pagina();
    for (const [id, valor] of [["adm_nome", "LOJA"], ["adm_email", "teste@exemplo.com"], ["adm_email_loja", "loja@exemplo.com"],
      ["adm_pin", PIN], ["adm_pin2", PIN]]) {
      await p.fill(`#${id}`, valor);
    }
    await p.click("#form-admin button[type=submit]");
  } else {
    await ate(() => noJs("document.body.dataset.tela === 'perfis' && Number(document.body.dataset.perfisCarregados) >= 1"), 90000);
    await noJs("document.querySelector('.perfil-cartao').click()");
    await ate(() => noJs("document.body.dataset.pinAberto === 'true'"), 10000);
    // como a pessoa: digita o PIN e aperta Enter
    await pagina().fill("#pin-campo", PIN);
    await pagina().press("#pin-campo", "Enter");
  }
  return ate(() => noJs("document.body.dataset.tela === 'menu' && document.body.dataset.pronto === 'true'"), 30000);
}

async function principal() {
  console.log(`=== ENSAIO DO ATUALIZAR PELA TELA: versao anterior -> ${versaoNova} ===\n`);
  fecharPrograma();
  const r = require("child_process").spawnSync(anterior, ["/S"], { stdio: "inherit", timeout: 180000 });
  const versaoAnterior = versaoInstalada();
  teste("Versao anterior instalada", r.status === 0 && Boolean(versaoAnterior), `versao ${versaoAnterior}`);
  if (!versaoAnterior) return;
  fecharPrograma();

  const github = await servidorGithub();
  const api = `http://127.0.0.1:${github.address().port}`;

  // ---- programa antigo aberto, como na loja ----
  const { saida } = await abrirPrograma(api);
  teste("Programa antigo abre e chega ao Menu", await entrarNoMenu(true));
  const rodapeAntigo = await noJs("document.getElementById('versao-sistema').textContent").catch(() => "");
  teste("Rodape do Menu mostra a versao antiga", rodapeAntigo.includes(versaoAnterior), rodapeAntigo);

  // ---- pop-up "Nova versao" ----
  const apareceu = await ate(() => noJs(`document.body.dataset.atualizacao === '${versaoNova}' && Boolean(document.querySelector('[data-dialogo-acao="confirmar"]'))`), 60000);
  teste(`Pop-up "Nova versao ${versaoNova}" aparece sozinho no Menu`, apareceu);
  await esperar(800);
  await foto("1-pop-up-nova-versao.png");
  const centro1 = await noJs(CENTRO).catch(() => null);
  teste("Pop-up \"Nova versao\" no centro da tela", Boolean(centro1 && centro1.ok), JSON.stringify(centro1));
  const textos = await noJs(`[...document.querySelectorAll('[data-dialogo] button')].map((b) => b.textContent.trim())`).catch(() => []);
  teste("Pop-up tem ATUALIZAR e AGORA NAO", textos.some((t) => t.includes("ATUALIZAR")) && textos.some((t) => t.includes("AGORA")), JSON.stringify(textos));

  // ---- ATUALIZAR: barra de carregamento ----
  // clique de verdade no botao ATUALIZAR
  await pagina().click('[data-dialogo-acao="confirmar"]');
  const amostras = [];
  let fotosBarra = 0;
  let centroBarra = null;
  const inicioBarra = Date.now();
  while (!saida.fechou && Date.now() - inicioBarra < 180000) {
    const a = await noJs(`(() => {
      const caixa = document.querySelector('[data-dialogo="progresso"]');
      if (!caixa) return null;
      const barra = document.getElementById('barra-progresso');
      const cheio = barra.querySelector('.barra-progresso__preenchido');
      const largura = barra.getBoundingClientRect().width;
      return { pct: largura ? Math.round(cheio.getBoundingClientRect().width / largura * 100) : 0,
        texto: document.getElementById('progresso-texto').textContent };
    })()`).catch(() => null);
    if (a) {
      amostras.push(a);
      if (!centroBarra) centroBarra = await noJs(CENTRO).catch(() => null);
      if ((fotosBarra === 0 && a.pct > 5) || (fotosBarra === 1 && a.pct >= 50) || (fotosBarra === 2 && /Instalando|Conferindo/.test(a.texto))) {
        fotosBarra++;
        await foto(`${fotosBarra + 1}-barra-${a.pct}.png`);
      }
    }
    await esperar(200);
  }
  const pcts = amostras.map((a) => a.pct);
  const distintos = [...new Set(pcts)];
  console.log(`         barra: ${distintos.join("% → ")}%`);
  teste("Pop-up de carregamento no centro da tela", Boolean(centroBarra && centroBarra.ok), JSON.stringify(centroBarra));
  teste("Barra de carregamento avanca (varios passos, nunca volta)",
    distintos.length >= 4 && pcts.every((p, i) => i === 0 || p >= pcts[i - 1]), `${distintos.length} passos`);
  teste("Texto mostra a porcentagem e os MB", amostras.some((a) => /Baixando\.\.\. \d+% \(\d+ de \d+ MB\)/.test(a.texto)),
    (amostras.find((a) => /Baixando/.test(a.texto)) || {}).texto);
  teste("Barra chega ao fim e avisa que vai instalar", amostras.some((a) => a.pct >= 99 && /Instalando|Conferindo/.test(a.texto)),
    (amostras[amostras.length - 1] || {}).texto);

  // ---- fecha e abre de novo sozinho, ja na versao nova ----
  const pidsAntes = new Set(pidsDoPrograma());
  teste("Programa antigo fecha sozinho depois do download", await ate(() => saida.fechou, 60000));
  try { await navegador.close(); } catch { /* ja desconectou */ }
  const instalou = await ate(() => versaoInstalada() === versaoNova, 180000);
  teste(`Versao nova instalada (${versaoNova})`, instalou, `instalada: ${versaoInstalada()}`);
  const reabriu = await ate(() => pidsDoPrograma().some((pid) => !pidsAntes.has(pid)), 90000);
  teste("Programa abre de novo sozinho", reabriu);

  // ---- o programa novo: versao certa e sem oferecer atualizar de novo ----
  await esperar(5000);
  fecharPrograma();
  await esperar(2000);
  await abrirPrograma(api);
  teste("Programa novo chega ao Menu", await entrarNoMenu(false));
  const rodapeNovo = await noJs("document.getElementById('versao-sistema').textContent").catch(() => "");
  teste("Rodape do Menu mostra a versao nova", rodapeNovo.includes(versaoNova), rodapeNovo);
  await esperar(15000);
  const ofereceDeNovo = await noJs("Boolean(document.body.dataset.atualizacao) || Boolean(document.querySelector('[data-dialogo-acao=\"confirmar\"]'))").catch(() => true);
  teste("Nao oferece atualizar de novo (nao ficou na versao antiga)", !ofereceDeNovo);
  await foto("5-programa-novo.png");
  try { await navegador.close(); } catch { /* ok */ }
  fecharPrograma();
  github.close();
}

principal()
  .catch((erro) => teste("Ensaio sem erro inesperado", false, erro && erro.stack))
  .finally(() => {
    fecharPrograma();
    const falhas = resultados.filter((r) => !r.ok).length;
    console.log(`\n=== ENSAIO DO ATUALIZAR PELA TELA: ${resultados.length - falhas}/${resultados.length} verificacoes passaram ===`);
    console.log(`Fotos em ${FOTOS}`);
    process.exit(falhas ? 1 : 0);
  });
