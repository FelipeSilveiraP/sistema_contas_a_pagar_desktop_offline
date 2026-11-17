// ENSAIO DA ATUALIZACAO num Windows de verdade (GitHub Actions, antes de publicar).
// Faz o que acontece na loja quando alguem clica em ATUALIZAR:
//  1. instala a versao ANTERIOR (a ultima publicada) e abre o programa;
//  2. abre o instalador NOVO pelo mesmo codigo do botao ATUALIZAR
//     (automacoes.instalarAtualizacao) e fecha o programa como ele fecha;
//  3. confere que a versao nova ficou instalada E que o programa abriu de novo sozinho.
// Se nao der certo, o workflow nao publica a versao.
// Uso: node desktop/ensaio-atualizacao.js <instalador-anterior.exe> <instalador-novo.exe> <versao-nova>
const { execFileSync, spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const asar = require("@electron/asar");
const automacoes = require("./automacoes");

const [anteriorArg, novoArg, versaoNova] = process.argv.slice(2);
// caminho completo: o instalador e aberto a partir de outra pasta
const anterior = path.resolve(anteriorArg);
const novo = path.resolve(novoArg);
const NOME = "Contas a Pagar - Chaveiro Universal";
const EXE = `${NOME}.exe`;
// o instalador (oneClick, por usuario) instala em Programs\<name do package.json>
const PASTA = path.join(process.env.LOCALAPPDATA, "Programs", require("../package.json").name);
const DADOS = fs.mkdtempSync(path.join(os.tmpdir(), "ensaio-atualizacao-"));

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (nivel, msg) => console.log(`  [${nivel}] ${msg}`);

function versaoInstalada() {
  try {
    return JSON.parse(asar.extractFile(path.join(PASTA, "resources", "app.asar"), "package.json").toString()).version;
  } catch {
    return null;
  }
}

function processosDoPrograma() {
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

async function ate(condicao, ms) {
  const inicio = Date.now();
  while (Date.now() - inicio < ms) {
    if (condicao()) return true;
    await esperar(1000);
  }
  return false;
}

async function principal() {
  console.log(`1. Instalando a versao anterior (${path.basename(anterior)})...`);
  const r = require("child_process").spawnSync(path.resolve(anterior), ["/S"], { stdio: "inherit", timeout: 180000 });
  console.log(`   instalador terminou: codigo ${r.status}${r.error ? ` erro ${r.error.code || r.error.message}` : ""}`);
  const versaoAnterior = versaoInstalada();
  if (!versaoAnterior) throw new Error(`a versao anterior nao ficou instalada em ${PASTA}`);
  console.log(`   versao anterior instalada: ${versaoAnterior}`);
  fecharPrograma();

  console.log("2. Abrindo o programa antigo (como na loja)...");
  const antigo = spawn(path.join(PASTA, EXE), [], {
    detached: true,
    stdio: "ignore",
    env: { ...process.env, FINDESK_DB_PATH: path.join(DADOS, "contas_a_pagar.db") },
  });
  antigo.unref();
  if (!(await ate(() => processosDoPrograma().length > 0, 30000))) throw new Error("o programa antigo nao abriu");
  await esperar(8000);

  console.log(`3. ATUALIZAR para ${versaoNova} (mesmo codigo do botao)...`);
  const appFalso = {
    // como o sistema fecha de verdade (o instalador tambem fecharia sozinho)
    quit() {
      console.log("   o programa antigo foi fechado pelo ATUALIZAR");
      fecharPrograma();
    },
  };
  await automacoes.instalarAtualizacao(appFalso, { versao: versaoNova, instalador: novo }, log);
  const pidsAntigos = new Set(processosDoPrograma());
  await esperar(2000);

  console.log("4. Esperando o instalador trocar a versao e abrir o programa de novo...");
  const instalou = await ate(() => versaoInstalada() === versaoNova, 240000);
  console.log(`   versao instalada agora: ${versaoInstalada()}`);
  const reabriu = await ate(() => processosDoPrograma().some((pid) => !pidsAntigos.has(pid)), 60000);
  console.log(`   programa aberto de novo sozinho: ${reabriu ? "sim" : "NAO"}`);
  fecharPrograma();

  if (!instalou) throw new Error(`a atualizacao nao instalou (esperado ${versaoNova}, ficou ${versaoInstalada()})`);
  if (!reabriu) throw new Error("a versao nova instalou, mas o programa nao abriu de novo sozinho");
  console.log(`\n=== ENSAIO DA ATUALIZACAO: OK (${versaoAnterior} -> ${versaoNova}, reabriu sozinho) ===`);
}

principal()
  .then(() => process.exit(0))
  .catch((erro) => {
    fecharPrograma();
    console.error(`\n=== ENSAIO DA ATUALIZACAO: FALHOU — ${erro && erro.message} ===`);
    process.exit(1);
  });
