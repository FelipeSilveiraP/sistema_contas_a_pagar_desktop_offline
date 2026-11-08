// REPRODUCAO REAL do bug de interacao (inputs mortos) no ambiente de
// desenvolvimento do usuario: o aplicativo e iniciado por `npm run dev` e
// TODA interacao e feita com entrada REAL do Windows (SendInput). Nenhum
// focus() programatico e usado para mascarar a falha. A verificacao usa a
// sondagem de diagnostico (FINDESK_DIAG_DIR) do proprio aplicativo.
//
// Uso: node desktop/smoke-dev.js
const { spawn, execFileSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");

const RAIZ = path.join(__dirname, "..");
const DIAG_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "findesk-diag-"));
const ARQ_EVENTOS = path.join(DIAG_DIR, "eventos.jsonl");
const ARQ_PEDIDOS = path.join(DIAG_DIR, "requisicoes.jsonl");
const ARQ_RESPOSTAS = path.join(DIAG_DIR, "respostas.jsonl");
const ARQ_APP = path.join(DIAG_DIR, "app-stdout.log");

const resultados = [];

function teste(nome, ok, detalhe = "") {
  resultados.push({ nome, ok });
  console.log(`${ok ? "[OK]    " : "[FALHA]"} ${nome}${detalhe ? " — " + detalhe : ""}`);
}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

function ps(acao, extra = {}) {
  const args = ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", path.join(__dirname, "entrada-real.ps1"), "-Acao", acao];
  if (extra.x !== undefined) args.push("-X", String(extra.x), "-Y", String(extra.y));
  if (extra.texto !== undefined) args.push("-Texto", extra.texto);
  if (extra.titulo) args.push("-Titulo", extra.titulo);
  try {
    return execFileSync("powershell.exe", args, {
      encoding: "utf8",
      windowsHide: true,
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch (erro) {
    return `ERRO: ${erro.message}`;
  }
}

let seqPedido = 1;
async function pedir(obj, timeoutMs = 8000) {
  const id = seqPedido++;
  fs.appendFileSync(ARQ_PEDIDOS, JSON.stringify({ id, ...obj }) + "\n");
  const inicio = Date.now();
  while (Date.now() - inicio < timeoutMs) {
    try {
      const texto = fs.existsSync(ARQ_RESPOSTAS) ? fs.readFileSync(ARQ_RESPOSTAS, "utf8") : "";
      for (const linha of texto.split("\n")) {
        if (!linha.trim()) continue;
        try {
          const r = JSON.parse(linha);
          if (r.id === id) return r;
        } catch {
          // linha parcial
        }
      }
    } catch {
      // arquivo ainda nao criado
    }
    await esperar(200);
  }
  return null;
}

async function estado() {
  const r = await pedir({ acao: "estado" });
  return r && r.ok ? r.estado : null;
}

async function ponto(seletor) {
  const r = await pedir({ acao: "rect", seletor });
  return r && r.ok ? r.ponto : null;
}

async function clicarReal(seletor) {
  const p = await ponto(seletor);
  if (!p) return false;
  ps("clicar-px", { x: p.px, y: p.py });
  await esperar(350);
  return true;
}

function lerEventos() {
  try {
    return fs.readFileSync(ARQ_EVENTOS, "utf8").split("\n").filter((l) => l.trim());
  } catch {
    return [];
  }
}

function evidencia(marca) {
  console.log(`\n===== EVIDENCIA (${marca}) =====`);
  console.log(`janela em primeiro plano: ${ps("foco")}`);
  const eventos = lerEventos();
  console.log(`eventos registrados: ${eventos.length}; ultimos 50:`);
  for (const linha of eventos.slice(-50)) console.log("  " + linha);
  console.log("===== FIM DA EVIDENCIA =====\n");
}

async function esperarTelaEsperada(tela, timeoutMs = 15000) {
  const inicio = Date.now();
  while (Date.now() - inicio < timeoutMs) {
    const e = await estado();
    if (e && e.tela === tela) return true;
    await esperar(300);
  }
  return false;
}

async function janelaExiste() {
  return !ps("rect-janela").startsWith("ERRO");
}

function matarApp() {
  try {
    execFileSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-Command",
        "Get-Process electron -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -like '*Chaveiro*' } | ForEach-Object { taskkill /PID $_.Id /T /F 2>$null }; Get-CimInstance Win32_Process -Filter \"Name='java.exe'\" | Where-Object { $_.CommandLine -like '*findesk-backend*' } | ForEach-Object { taskkill /PID $_.ProcessId /T /F 2>$null }",
      ],
      { encoding: "utf8", windowsHide: true, stdio: ["ignore", "pipe", "ignore"] }
    );
  } catch {
    // nada a matar
  }
}

function iniciarApp() {
  const proc = spawn("cmd.exe", ["/c", "npm", "run", "dev"], {
    cwd: RAIZ,
    env: { ...process.env, FINDESK_DIAG_DIR: DIAG_DIR },
    stdio: ["ignore", "pipe", "pipe"],
  });
  proc.stdout.on("data", (d) => fs.appendFileSync(ARQ_APP, d));
  proc.stderr.on("data", (d) => fs.appendFileSync(ARQ_APP, d));
  return proc;
}

async function aguardarBoot() {
  const inicio = Date.now();
  while (Date.now() - inicio < 120000) {
    if (await janelaExiste()) {
      const e = await estado();
      if (e && e.tela === "menu") return true;
    }
    await esperar(500);
  }
  return false;
}

// Confirmações nativas de dirty-form: o usuário real confirma com ENTER
// (botão padrao do window.confirm do Electron).
function confirmarDialogo() {
  ps("enter");
}

// Navegação saindo de um formulário sujo: o clique dispara o diálogo nativo
// ANTES da troca de tela; confirmar com ENTER e só então verificar o destino.
// O ENTER só e enviado se o renderer estiver bloqueado pelo dialogo (estado
// nao responde) — evita submissao acidental do formulario se nao houver dialogo.
async function sairDeFormulario(seletor, telaEsperada, marca) {
  const clicou = await clicarReal(seletor);
  await esperar(400);
  let dialogoAberto = false;
  if (clicou) {
    dialogoAberto = (await pedir({ acao: "estado" }, 1500)) === null;
    if (dialogoAberto) confirmarDialogo();
  }
  await esperar(500);
  const ok = clicou && (await esperarTelaEsperada(telaEsperada));
  teste(`${marca}: navega com confirmacao de dirty-form -> ${telaEsperada}`, ok, `clicou=${clicou} dialogo=${dialogoAberto}`);
  if (!ok) evidencia(marca);
  return ok;
}

async function clicarEVerificarFoco(seletor, ativoEsperado, marca) {
  const clicou = await clicarReal(seletor);
  if (!clicou) {
    teste(`${marca}: clique real no alvo (${seletor})`, false, "alvo nao encontrado");
    evidencia(marca);
    return false;
  }
  const e = await estado();
  const ok = e && e.ativo === ativoEsperado;
  teste(`${marca}: clique real posiciona o cursor (${ativoEsperado})`, ok, `ativo=${e ? e.ativo : "?"} hasFocus=${e ? e.hasFocus : "?"}`);
  if (!ok) evidencia(marca);
  return ok;
}

// Digitação real com asserção auto-calibrada: o campo pode estar vazio ou
// parcialmente preenchido (recarrega a cada navegação); o que importa e que
// TODOS os caracteres digitados cheguem ao campo.
async function digitarEVerificar(campo, texto, marca) {
  const antes = (await estado())?.comprimentos?.[campo] ?? null;
  ps("digitar", { texto });
  await esperar(400);
  const e = await estado();
  const obtido = e && e.comprimentos ? e.comprimentos[campo] : null;
  const esperado = antes === null ? null : antes + texto.length;
  const ok = antes !== null && obtido === esperado;
  teste(`${marca}: digitacao real entrega ${texto.length} chars em ${campo}`, ok,
    `antes=${antes} depois=${obtido} (esperado=${esperado}) ativo=${e ? e.ativo : "?"} hasFocus=${e ? e.hasFocus : "?"}`);
  if (!ok) evidencia(marca);
  return ok;
}

async function ciclo(tag, proc) {
  console.log(`\n=== CICLO REAL (${tag}) — app via npm run dev, entrada SendInput ===`);

  teste(`${tag}: boot sob npm run dev libera o Menu`, await aguardarBoot());

  // sequencia obrigatoria: banco -> pagador -> empresa -> banco (ordem normal)
  teste(`${tag}: Menu -> Cadastros (clique real)`, await clicarReal('a[data-path="cadastros"]') && (await esperarTelaEsperada("cadastros")));
  teste(`${tag}: Cadastros -> Novo Cadastro (clique real)`, await clicarReal('a[data-modulo="novo-cadastro"]') && (await esperarTelaEsperada("novo-cadastro")));
  teste(`${tag}: Novo Cadastro -> Banco (clique real)`, await clicarReal('a[data-modulo="banco"]') && (await esperarTelaEsperada("form-banco")));

  await clicarEVerificarFoco("#campo-instituicao", "INPUT#campo-instituicao", `${tag}.banco`);
  await digitarEVerificar("campoInstituicao", "TESTE-ALFA-01", `${tag}.banco`);

  await sairDeFormulario('.nav-barra button[data-nav="voltar"]', "novo-cadastro", `${tag}: VOLTAR-1`);

  teste(`${tag}: Novo Cadastro -> Pagador (clique real)`, await clicarReal('a[data-modulo="pagador"]') && (await esperarTelaEsperada("form-pagador")));
  await clicarEVerificarFoco("#campo-nome", "INPUT#campo-nome", `${tag}.pagador`);
  await digitarEVerificar("campoNome", "TESTE-BETA-02", `${tag}.pagador`);

  await sairDeFormulario('.nav-barra button[data-nav="voltar"]', "novo-cadastro", `${tag}: VOLTAR-2`);

  teste(`${tag}: Novo Cadastro -> Empresa (clique real)`, await clicarReal('a[data-modulo="empresa"]') && (await esperarTelaEsperada("form-empresa")));
  await clicarEVerificarFoco("#campo-razao-social", "INPUT#campo-razao-social", `${tag}.empresa`);
  await digitarEVerificar("campoRazao", "TESTE-GAMA-03", `${tag}.empresa`);

  // volta ao Banco e repete digitacao (pagina recarregada: campo vazio)
  await sairDeFormulario('.nav-barra button[data-nav="voltar"]', "novo-cadastro", `${tag}: VOLTAR-3`);
  teste(`${tag}: novo -> Banco de novo (clique real)`, await clicarReal('a[data-modulo="banco"]') && (await esperarTelaEsperada("form-banco")));
  await clicarEVerificarFoco("#campo-instituicao", "INPUT#campo-instituicao", `${tag}.banco2`);
  await digitarEVerificar("campoInstituicao", "-R1", `${tag}.banco2`);

  // ordem alternada: empresa -> banco -> pagador, direto pelo Menu
  await sairDeFormulario('.nav-barra button[data-nav="menu"]', "menu", `${tag}: navbar-MENU`);
  teste(`${tag}: Menu -> Cadastros (ordem alternada)`, await clicarReal('a[data-path="cadastros"]') && (await esperarTelaEsperada("cadastros")));
  teste(`${tag}: -> Novo Cadastro`, await clicarReal('a[data-modulo="novo-cadastro"]') && (await esperarTelaEsperada("novo-cadastro")));
  teste(`${tag}: -> Empresa primeiro`, await clicarReal('a[data-modulo="empresa"]') && (await esperarTelaEsperada("form-empresa")));
  await clicarEVerificarFoco("#campo-razao-social", "INPUT#campo-razao-social", `${tag}.empresa2`);
  await digitarEVerificar("campoRazao", "X", `${tag}.empresa2`);

  await sairDeFormulario('.nav-barra button[data-nav="voltar"]', "novo-cadastro", `${tag}: VOLTAR-4`);
  teste(`${tag}: -> Banco em 2o`, await clicarReal('a[data-modulo="banco"]') && (await esperarTelaEsperada("form-banco")));
  await clicarEVerificarFoco("#campo-instituicao", "INPUT#campo-instituicao", `${tag}.banco3`);
  await digitarEVerificar("campoInstituicao", "Y", `${tag}.banco3`);

  await sairDeFormulario('.nav-barra button[data-nav="voltar"]', "novo-cadastro", `${tag}: VOLTAR-5`);
  teste(`${tag}: -> Pagador em 3o`, await clicarReal('a[data-modulo="pagador"]') && (await esperarTelaEsperada("form-pagador")));
  await clicarEVerificarFoco("#campo-nome", "INPUT#campo-nome", `${tag}.pagador2`);
  await digitarEVerificar("campoNome", "Z", `${tag}.pagador2`);

  // minimizar e restaurar
  ps("minimizar");
  await esperar(800);
  ps("restaurar");
  await esperar(1000);
  await clicarEVerificarFoco("#campo-nome", "INPUT#campo-nome", `${tag}.pos-minimizar`);
  await digitarEVerificar("campoNome", "M", `${tag}.pos-minimizar`);

  // alternancia entre janelas do Windows (notepad) e volta por clique na barra de titulo
  if (proc && !proc.__notepad) {
    const jaAberto = ps("rect-janela", { titulo: "Bloco de notas" }).length > 0 && !ps("rect-janela", { titulo: "Bloco de notas" }).startsWith("ERRO");
    if (!jaAberto) {
      spawn("notepad.exe", [], { detached: true, stdio: "ignore" }).unref();
      await esperar(1500);
    }
    proc.__notepad = true;
  }
  ps("ativar-janela", { titulo: "Bloco de Notas" });
  await esperar(600);
  const janelaApp = ps("rect-janela", { titulo: "Chaveiro Universal" });
  const [esq, topo, dir] = janelaApp.split(",").map((n) => Number(n));
  ps("clicar-px", { x: Math.round((esq + dir) / 2), y: topo + 10 });
  await esperar(600);
  await clicarEVerificarFoco("#campo-nome", "INPUT#campo-nome", `${tag}.pos-alt-tab`);
  await digitarEVerificar("campoNome", "W", `${tag}.pos-alt-tab`);
}

async function main() {
  console.log(`DIAG_DIR=${DIAG_DIR}`);
  matarApp();
  await esperar(1000);

  console.log("--- ciclo 1: npm run dev (a partir do zero) ---");
  let proc = iniciarApp();
  await ciclo("ciclo1", proc);

  console.log("--- fechando COMPLETAMENTE e reabrindo (ciclo 2) ---");
  matarApp();
  await esperar(1500);
  const janelaSumiu = !(await janelaExiste());
  teste("ciclo2: fechamento completo da aplicacao", janelaSumiu);
  proc = iniciarApp();
  await ciclo("ciclo2", proc);

  // ciclo 3 curto: digitacao em ordem invertida na mesma sessao
  console.log("--- ciclo 3: curto, digitacao em ordem invertida ---");
  await sairDeFormulario('.nav-barra button[data-nav="menu"]', "menu", "ciclo3: MENU");
  teste("ciclo3: Menu -> Cadastros", await clicarReal('a[data-path="cadastros"]') && (await esperarTelaEsperada("cadastros")));
  teste("ciclo3: -> Novo Cadastro", await clicarReal('a[data-modulo="novo-cadastro"]') && (await esperarTelaEsperada("novo-cadastro")));
  teste("ciclo3: -> Pagador primeiro", await clicarReal('a[data-modulo="pagador"]') && (await esperarTelaEsperada("form-pagador")));
  await clicarEVerificarFoco("#campo-nome", "INPUT#campo-nome", "ciclo3.pagador");
  await digitarEVerificar("campoNome", "ORDEM-INVERSA", "ciclo3.pagador");
  await sairDeFormulario('.nav-barra button[data-nav="voltar"]', "novo-cadastro", "ciclo3: VOLTAR");
  teste("ciclo3: -> Banco", await clicarReal('a[data-modulo="banco"]') && (await esperarTelaEsperada("form-banco")));
  await clicarEVerificarFoco("#campo-instituicao", "INPUT#campo-instituicao", "ciclo3.banco");
  await digitarEVerificar("campoInstituicao", "ORDEM-INVERSA", "ciclo3.banco");

  // preservar evidencias
  const destino = path.join(RAIZ, "docs", `diagnostico-${new Date().toISOString().replace(/[:.]/g, "-")}`);
  fs.mkdirSync(destino, { recursive: true });
  for (const arq of [ARQ_EVENTOS, ARQ_APP]) {
    if (fs.existsSync(arq)) fs.copyFileSync(arq, path.join(destino, path.basename(arq)));
  }

  const falhas = resultados.filter((r) => !r.ok);
  console.log(`\n=== RESULTADO SMOKE-DEV: ${resultados.length - falhas.length}/${resultados.length} verificacoes passaram ===`);
  if (falhas.length) {
    console.log("Falhas:");
    for (const f of falhas) console.log(` - ${f.nome}`);
  }
  console.log(`Evidencias copiadas para ${destino}`);
  matarApp();
  process.exitCode = falhas.length ? 1 : 0;
}

main().catch((erro) => {
  console.error("ERRO FATAL NO SMOKE-DEV:", erro);
  evidencia("erro-fatal");
  matarApp();
  process.exitCode = 1;
});
