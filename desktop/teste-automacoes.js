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
  const copia = a.instalarAtualizacao(app12, att, log, sp);
  await new Promise((ok) => setTimeout(ok, 700));
  teste("ATUALIZAR: copia o instalador para a pasta temporaria", fs.existsSync(copia) && fs.readFileSync(copia).equals(conteudo));
  teste("ATUALIZAR: dispara o instalador depois de 3 s (PowerShell oculto)",
    sp.chamadas.length === 1 && sp.chamadas[0].cmd === "powershell.exe" && sp.chamadas[0].args.join(" ").includes("Start-Sleep -Seconds 3") && sp.chamadas[0].args.join(" ").includes(nome));
  teste("ATUALIZAR: fecha o sistema para o instalador trocar os arquivos", app12.fechou === true);
  fs.rmSync(copia, { force: true });
  delete process.env.FINDESK_PASTA_ATUALIZACOES;
  teste("Sem pasta configurada e nao instalado: nao procura no Drive real", await a.procurarAtualizacao(appFalso(false), log) === null);

  fs.rmSync(PASTA, { recursive: true, force: true });
  console.log(`\n=== RESULTADO AUTOMACOES: ${ok}/${total} verificacoes passaram ===`);
  process.exit(ok === total ? 0 : 1);
})();
