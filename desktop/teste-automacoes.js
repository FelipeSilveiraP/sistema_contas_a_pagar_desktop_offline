// Testes das automacoes (desktop/automacoes.js) sem tocar no Windows de verdade:
// app, spawn e shell sao falsos; pastas em %TEMP%. Uso: npm run test:automacoes
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const a = require("./automacoes");

let ok = 0;
let total = 0;
function teste(nome, condicao, detalhe = "") {
  total++;
  if (condicao) ok++;
  console.log(`${condicao ? "[OK]    " : "[FALHA] "} ${nome}${condicao || !detalhe ? "" : ` — ${detalhe}`}`);
}

const PASTA = fs.mkdtempSync(path.join(os.tmpdir(), "findesk-automacoes-"));
const logs = [];
const log = (nivel, msg) => logs.push(`${nivel} ${msg}`);

function appFalso(empacotado, versao = "1.2.0") {
  return {
    isPackaged: empacotado,
    getVersion: () => versao,
    fechou: false,
    quit() { this.fechou = true; },
  };
}

function spawnFalso() {
  const chamadas = [];
  const fn = (cmd, args, opcoes) => {
    chamadas.push({ cmd, args, opcoes });
    return { unref() {} };
  };
  fn.chamadas = chamadas;
  return fn;
}

(async () => {
  console.log("=== Configuracoes ===");
  const dados = path.join(PASTA, "dados");
  const cfg = a.lerConfiguracoes(dados, log);
  teste("Padrao: abre com o Windows e abre o e-mail (Gmail)", cfg.abrirAoLigarComputador && cfg.abrirEmailAoLigar && cfg.enderecoEmail.startsWith("https://mail.google.com"));
  teste("configuracoes.json criado ao lado do banco para o usuario editar", fs.existsSync(path.join(dados, "configuracoes.json")));
  fs.writeFileSync(path.join(dados, "configuracoes.json"), JSON.stringify({ abrirEmailAoLigar: false }));
  const cfg2 = a.lerConfiguracoes(dados, log);
  teste("Valor editado pelo usuario e respeitado e o resto vem do padrao", cfg2.abrirEmailAoLigar === false && cfg2.abrirAoLigarComputador === true);
  fs.writeFileSync(path.join(dados, "configuracoes.json"), "﻿" + JSON.stringify({ abrirAoLigarComputador: false }));
  teste("Arquivo salvo com BOM (Bloco de Notas) e lido corretamente", a.lerConfiguracoes(dados, log).abrirAoLigarComputador === false);
  fs.writeFileSync(path.join(dados, "configuracoes.json"), "{ quebrado");
  teste("Arquivo invalido nao derruba o sistema (usa o padrao)", a.lerConfiguracoes(dados, log).abrirAoLigarComputador === true);
  teste("Arquivo invalido NAO e sobrescrito (o texto do usuario fica)", fs.readFileSync(path.join(dados, "configuracoes.json"), "utf8") === "{ quebrado");

  console.log("\n=== Abrir com o Windows ===");
  // registro do Windows simulado (o de verdade e lido/gravado com reg.exe)
  function registroFalso(perderGravacoes = 0) {
    return {
      valor: null, gravacoes: [], perder: perderGravacoes,
      ler() { return this.valor; },
      gravar(v) { this.gravacoes.push(v); if (this.perder > 0) { this.perder--; return; } this.valor = v; },
      apagar() { this.valor = null; },
    };
  }
  const esperado = `"${process.execPath}" ${a.ARG_INICIO}`;
  const regDev = registroFalso();
  teste("Em desenvolvimento/testes NAO registra nada no Windows", a.configurarInicioComWindows(appFalso(false), cfg, log, regDev) === false && regDev.gravacoes.length === 0);
  const reg = registroFalso();
  teste("Instalado: grava o caminho ENTRE ASPAS com o marcador de inicio automatico",
    a.configurarInicioComWindows(appFalso(true), cfg, log, reg) === true && reg.valor === esperado);
  reg.valor = esperado.replace(/"/g, "");
  a.configurarInicioComWindows(appFalso(true), cfg, log, reg);
  teste("Cadastro antigo sem aspas (gravado pelo Electron) e corrigido", reg.valor === esperado);
  teste("Desligado no configuracoes.json: remove do inicio do Windows",
    a.configurarInicioComWindows(appFalso(true), { ...cfg, abrirAoLigarComputador: false }, log, reg) === true && reg.valor === null);
  teste("Cadastro que nao fica gravado: avisa no log (WARN) com 'ausente'",
    a.configurarInicioComWindows(appFalso(true), cfg, log, registroFalso(9)) === false && logs.some((l) => l.startsWith("WARN") && l.includes("ausente")));

  console.log("\n=== Inicio automatico: espera o computador ficar folgado ===");
  // relogio e processador simulados: cada espera avanca o relogio
  function simulado(uptimes, cpus) {
    let t = 0;
    let i = 0;
    return {
      esperas: 0,
      opcoes: {
        uptime: () => uptimes[Math.min(i, uptimes.length - 1)],
        medirCpu: async () => cpus[Math.min(i, cpus.length - 1)],
        esperar: async (ms) => { t += ms; i++; },
        agora: () => t,
      },
    };
  }
  let sim = simulado([60, 120, 200, 260], [0.9, 0.9, 0.8, 0.2]);
  let esperou = await a.esperarComputadorFolgado(log, sim.opcoes);
  teste("Recem-ligado e processador ocupado: espera; abre quando o Windows ja ligou ha 3 min e a CPU folgou", esperou === 45000, String(esperou));
  sim = simulado([3600], [0.1]);
  teste("Computador ja ligado e folgado: abre sem esperar", (await a.esperarComputadorFolgado(log, sim.opcoes)) === 0);
  sim = simulado([3600], [0.95]);
  esperou = await a.esperarComputadorFolgado(log, sim.opcoes);
  teste("Processador sempre ocupado: abre mesmo assim depois de 10 min (nao fica para sempre esperando)", esperou >= 600000 && esperou < 620000, String(esperou));
  const cpuReal = await a.medirUsoCpu(200);
  teste("Medicao real do processador da um numero entre 0 e 1", cpuReal >= 0 && cpuReal <= 1, String(cpuReal));

  console.log("\n=== Chrome com o e-mail ===");
  const shell = { abertos: [], openExternal(u) { this.abertos.push(u); return Promise.resolve(); } };
  let sp = spawnFalso();
  teste("Aberto a mao (sem o marcador): NAO abre o e-mail", a.abrirEmailSeInicioAutomatico(["app.exe"], cfg, shell, log, sp) === null && sp.chamadas.length === 0);
  const r = a.abrirEmailSeInicioAutomatico(["app.exe", a.ARG_INICIO], cfg, shell, log, sp);
  const abriu = r && (r.navegador === "chrome" ? sp.chamadas[0]?.cmd.toLowerCase().endsWith("chrome.exe") && sp.chamadas[0].args[0] === cfg.enderecoEmail
    : shell.abertos[0] === cfg.enderecoEmail);
  teste(`Ligou o computador: abre o e-mail no ${r?.navegador === "chrome" ? "Chrome" : "navegador padrao"}`, Boolean(abriu), JSON.stringify(r));
  sp = spawnFalso();
  teste("Endereco perigoso no arquivo (javascript:) e recusado",
    a.abrirEmailSeInicioAutomatico([a.ARG_INICIO], { ...cfg, enderecoEmail: "javascript:alert(1)" }, shell, log, sp) === null && sp.chamadas.length === 0);
  teste("Opcao abrirEmailAoLigar=false respeitada", a.abrirEmailSeInicioAutomatico([a.ARG_INICIO], { ...cfg, abrirEmailAoLigar: false }, shell, log, sp) === null);

  console.log("\n=== Atualizacao pelo Google Drive ===");
  teste("Comparacao de versoes (1.10.0 > 1.9.3; 1.2.0 nao e maior que 1.2.0)",
    a.versaoMaior("1.10.0", "1.9.3") && !a.versaoMaior("1.2.0", "1.2.0") && a.versaoMaior("1.3.0", "1.2.9") && !a.versaoMaior("1.1.9", "1.2.0"));
  const pastaAtt = path.join(PASTA, "Meu Drive", a.SUBPASTA_ATUALIZACOES);
  fs.mkdirSync(pastaAtt, { recursive: true });
  process.env.FINDESK_PASTA_ATUALIZACOES = pastaAtt;
  const nome = "Contas a Pagar - Chaveiro Universal - Instalador 1.3.0.exe";
  const conteudo = Buffer.from("instalador de teste");
  fs.writeFileSync(path.join(pastaAtt, nome), conteudo);
  const hash = crypto.createHash("sha256").update(conteudo).digest("hex");
  teste("SHA-256 lido em pedacos (sem travar) bate com o calculado", (await a.sha256Arquivo(path.join(pastaAtt, nome))) === hash);
  const escrever = (info) => fs.writeFileSync(path.join(pastaAtt, "versao.json"), JSON.stringify(info));
  const app12 = appFalso(true, "1.2.0");

  teste("Sem versao.json: nada a atualizar", await a.procurarAtualizacao(app12, log) === null);
  escrever({ versao: "1.3.0", arquivo: nome, sha256: hash, novidades: "Teste" });
  const achou = await a.procurarAtualizacao(app12, log);
  teste("Versao maior com instalador completo: oferece atualizar", achou && achou.versao === "1.3.0" && achou.novidades === "Teste", JSON.stringify(achou));
  teste("Mesma versao instalada: nao oferece", await a.procurarAtualizacao(appFalso(true, "1.3.0"), log) === null);
  escrever({ versao: "1.3.0", arquivo: nome, sha256: "0".repeat(64) });
  teste("Instalador incompleto/diferente (SHA-256 nao confere): nao oferece", await a.procurarAtualizacao(app12, log) === null);
  escrever({ versao: "1.3.0", arquivo: "..\\..\\Windows\\virus.exe", sha256: hash });
  teste("Nome de arquivo fora do padrao (ex.: ..\\virus.exe): recusado", await a.procurarAtualizacao(app12, log) === null);

  escrever({ versao: "1.3.0", arquivo: nome, sha256: hash });
  const att = await a.procurarAtualizacao(app12, log);
  sp = spawnFalso();
  const copia = await a.instalarAtualizacao(app12, att, log, sp, 50);
  await new Promise((ok) => setTimeout(ok, 500));
  teste("ATUALIZAR: copia o instalador para a pasta temporaria", fs.existsSync(copia) && fs.readFileSync(copia).equals(conteudo));
  const chamada = sp.chamadas[0] || {};
  teste("ATUALIZAR: abre o INSTALADOR direto (sem PowerShell escondido) no modo atualizacao",
    sp.chamadas.length === 1 && chamada.cmd === copia && chamada.args.join(" ") === "--updated" && chamada.opcoes.detached === true);
  teste("ATUALIZAR: fecha o sistema para o instalador trocar os arquivos", app12.fechou === true);
  // Windows/antivirus barrou o instalador: o sistema NAO fecha e o erro volta para a tela
  const appBarrado = appFalso(true, "1.2.0");
  const barrado = (cmd, args, opcoes) => {
    const ouvintes = {};
    setTimeout(() => ouvintes.error && ouvintes.error(Object.assign(new Error("spawn UNKNOWN"), { code: "UNKNOWN" })), 10);
    return { once(evento, f) { ouvintes[evento] = f; }, unref() {} };
  };
  let erroBarrado = null;
  try { await a.instalarAtualizacao(appBarrado, att, log, barrado, 300); } catch (e) { erroBarrado = e; }
  await new Promise((ok) => setTimeout(ok, 500));
  teste("ATUALIZAR barrado pelo Windows: avisa o motivo e o sistema continua aberto",
    erroBarrado && /UNKNOWN/.test(erroBarrado.message) && appBarrado.fechou === false, String(erroBarrado));
  const appFechou = appFalso(true, "1.2.0");
  const fechaLogo = () => {
    const ouvintes = {};
    setTimeout(() => ouvintes.exit && ouvintes.exit(2), 10);
    return { once(evento, f) { ouvintes[evento] = f; }, unref() {} };
  };
  let erroFechou = null;
  try { await a.instalarAtualizacao(appFechou, att, log, fechaLogo, 300); } catch (e) { erroFechou = e; }
  await new Promise((ok) => setTimeout(ok, 500));
  teste("ATUALIZAR: instalador que fecha logo com erro nao derruba o sistema", erroFechou && appFechou.fechou === false, String(erroFechou));
  fs.rmSync(copia, { force: true });
  delete process.env.FINDESK_PASTA_ATUALIZACOES;
  teste("Sem pasta configurada e nao instalado: nao procura no Drive real", await a.procurarAtualizacao(appFalso(false), log) === null);

  console.log("\n=== Atualizacao pelo GitHub (Releases) ===");
  // "GitHub de mentira" local: API de releases + download do instalador
  const http = require("http");
  const instalador = Buffer.alloc(300 * 1024, 7);
  const shaInst = crypto.createHash("sha256").update(instalador).digest("hex");
  const nomeGh = "Contas a Pagar - Chaveiro Universal - Instalador 1.5.0.exe";
  let release = null;
  let corpoDownload = instalador;
  const servidor = http.createServer((req, res) => {
    if (req.url === `/repos/${a.REPO_GITHUB}/releases/latest`) {
      if (!release) { res.writeHead(404); return res.end("{}"); }
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify(release));
    }
    if (req.url.startsWith("/download/")) {
      res.writeHead(200, { "Content-Length": corpoDownload.length });
      return res.end(corpoDownload);
    }
    res.writeHead(404); res.end();
  });
  await new Promise((ok) => servidor.listen(0, "127.0.0.1", ok));
  const base = `http://127.0.0.1:${servidor.address().port}`;
  process.env.FINDESK_API_ATUALIZACOES = base;
  const ativo = (extra = {}) => ({ name: nomeGh, size: instalador.length, digest: `sha256:${shaInst}`,
    browser_download_url: `${base}/download/${encodeURIComponent(nomeGh)}`, ...extra });
  const app14 = appFalso(true, "1.4.0");

  teste("Sem release no GitHub: nada a atualizar", await a.procurarAtualizacao(app14, log) === null);
  release = { tag_name: "v1.5.0", name: "Garantias 1.5.0", body: "", assets: [ativo()] };
  const gh = await a.procurarAtualizacao(app14, log);
  teste("Versao maior no GitHub: oferece atualizar", gh && gh.versao === "1.5.0" && gh.origem === "github" && gh.sha256 === shaInst, JSON.stringify(gh));
  teste("Mesma versao do GitHub ja instalada: nao oferece", await a.procurarAtualizacao(appFalso(true, "1.5.0"), log) === null);
  teste("Versao MENOR no GitHub: nao oferece (nunca volta versao)", await a.procurarAtualizacao(appFalso(true, "1.6.0"), log) === null);
  const nomePontos = nomeGh.replace(/ /g, ".");
  release = { tag_name: "v1.5.0", body: "", assets: [ativo({ name: nomePontos, browser_download_url: `${base}/download/${nomePontos}` })] };
  const comPontos = await a.procurarAtualizacao(app14, log);
  teste("Nome como o GitHub publica (espacos viram pontos: 'Contas a Pagar.-.Chaveiro...'): oferece atualizar",
    comPontos && comPontos.versao === "1.5.0" && comPontos.nome === nomePontos, JSON.stringify(comPontos));
  release = { tag_name: "v1.5.0", body: "", assets: [ativo({ name: "virus.exe" })] };
  teste("Arquivo com outro nome no release: recusado", await a.procurarAtualizacao(app14, log) === null);
  release = { tag_name: "v1.5.0", body: "", assets: [ativo({ browser_download_url: "https://site-estranho.com/x.exe" })] };
  teste("Download fora do repositorio do sistema: recusado", await a.procurarAtualizacao(app14, log) === null);
  release = { tag_name: "v1.5.0", body: "sem impressao digital", assets: [ativo({ digest: undefined })] };
  teste("Release sem SHA-256: nao oferece", await a.procurarAtualizacao(app14, log) === null);
  release = { tag_name: "v1.5.0", body: `SHA-256 do instalador: ${shaInst}`, assets: [ativo({ digest: undefined })] };
  teste("SHA-256 lido das notas do release (quando a API nao manda o digest)", (await a.procurarAtualizacao(app14, log))?.sha256 === shaInst);

  release = { tag_name: "v1.5.0", body: "", assets: [ativo()] };
  const paraInstalar = await a.procurarAtualizacao(app14, log);
  corpoDownload = Buffer.concat([instalador.subarray(0, 1000), Buffer.from("adulterado")]);
  let recusou = false;
  try { await a.aplicarAtualizacao(app14, paraInstalar, log, spawnFalso()); } catch { recusou = true; }
  const pastaBaixa = path.join(os.tmpdir(), "contas-atualizacao");
  teste("Instalador baixado diferente (SHA-256 nao confere): NAO instala e apaga o arquivo",
    recusou && app14.fechou === false && !fs.existsSync(path.join(pastaBaixa, nomeGh)) && !fs.existsSync(path.join(pastaBaixa, `${nomeGh}.parcial`)));
  corpoDownload = instalador;
  sp = spawnFalso();
  const passos = [];
  const instalado = await a.aplicarAtualizacao(app14, paraInstalar, log, sp, (recebidos, total) => passos.push([recebidos, total]));
  await new Promise((ok) => setTimeout(ok, 700));
  teste("Barra de carregamento: avisa o andamento do download do 0 ao total (tamanho do Release)",
    passos.length >= 2 && passos[0][0] === 0 && passos.at(-1)[0] === instalador.length && passos.every(([, t]) => t === instalador.length)
      && passos.every((p, i) => i === 0 || p[0] >= passos[i - 1][0]), JSON.stringify(passos.slice(0, 3)));
  teste("ATUALIZAR pelo GitHub: baixa, confere o SHA-256 e roda o instalador",
    fs.existsSync(instalado) && fs.readFileSync(instalado).equals(instalador) && sp.chamadas.length === 1 && app14.fechou === true);
  fs.rmSync(instalado, { force: true });
  fs.rmSync(path.join(pastaBaixa, nomeGh), { force: true });
  servidor.close();
  const appSemNet = appFalso(true, "1.4.0");
  process.env.FINDESK_API_ATUALIZACOES = "http://127.0.0.1:9"; // ninguem escuta: "sem internet"
  teste("Sem internet: nao trava nem quebra (tenta o Drive e segue)", await a.procurarAtualizacao(appSemNet, log) === null);
  delete process.env.FINDESK_API_ATUALIZACOES;

  fs.rmSync(PASTA, { recursive: true, force: true });
  console.log(`\n=== RESULTADO AUTOMACOES: ${ok}/${total} verificacoes passaram ===`);
  process.exit(ok === total ? 0 : 1);
})();
