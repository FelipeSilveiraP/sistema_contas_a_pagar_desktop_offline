// Automacoes do sistema instalado (pedido do usuario, 2026-11-12):
// 1) abrir sozinho quando o Windows liga (login do usuario);
// 2) nesse inicio automatico, abrir o Chrome no e-mail da firma;
// 3) atualizacao: o sistema da loja oferece ATUALIZAR quando ve uma versao maior
//    a) no GitHub (Releases do repositorio; o GitHub gera o instalador a cada envio
//       para a main - .github/workflows/instalador.yml). E o caminho principal;
//    b) no Google Drive ("Meu Drive\Chaveiro Universal - Atualizacoes",
//       npm run publicar), quando o GitHub nao responde (sem internet).
//    Em todos os casos o instalador so roda se o SHA-256 conferir, e a atualizacao
//    NUNCA toca nos dados (%LOCALAPPDATA%\ChaveiroUniversal\ContasAPagar).
// Tudo isso so vale para o app INSTALADO (app.isPackaged). Em desenvolvimento e
// nos testes nada e registrado no Windows nem lido do Drive real.
const { execFileSync, spawn } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

const ARG_INICIO = "--inicio-automatico";
const NOME_INICIO = "Contas a Pagar - Chaveiro Universal";
const SUBPASTA_ATUALIZACOES = "Chaveiro Universal - Atualizacoes";
// repositorio de onde vem as versoes novas (Releases)
const REPO_GITHUB = "FelipeSilveiraP/sistema_contas_a_pagar_desktop_offline";
const API_GITHUB = "https://api.github.com";
// O GitHub troca os espacos do nome do arquivo por pontos ao publicar em Releases
// ("Contas a Pagar.-.Chaveiro.Universal.-.Instalador.1.4.11.exe"): aceita os dois jeitos.
const NOME_INSTALADOR = /^Contas[ .]a[ .]Pagar[ .]-[ .]Chaveiro[ .]Universal[ .]-[ .]Instalador[ .](\d+\.\d+\.\d+)\.exe$/;
const LIMITE_INSTALADOR = 400 * 1024 * 1024;

const PADRAO = {
  abrirAoLigarComputador: true,
  abrirEmailAoLigar: true,
  enderecoEmail: "https://mail.google.com/",
};

/** configuracoes.json ao lado do banco: o usuario pode mudar sem reinstalar. */
function lerConfiguracoes(pastaDados, registrarLog) {
  const arquivo = path.join(pastaDados, "configuracoes.json");
  let atual = {};
  let legivel = true;
  try {
    // o Bloco de Notas antigo salva com BOM (marca invisivel no inicio): ignora
    if (fs.existsSync(arquivo)) atual = JSON.parse(fs.readFileSync(arquivo, "utf8").replace(/^﻿/, ""));
  } catch (erro) {
    legivel = false;
    registrarLog("WARN", `configuracoes.json invalido, usando o padrao (o arquivo NAO foi alterado): ${erro.message}`);
  }
  const final = { ...PADRAO, ...atual };
  if (!legivel) return final; // nunca sobrescreve o que o usuario escreveu
  try {
    // grava o arquivo completo (com as chaves novas) para o usuario ver/editar
    fs.mkdirSync(pastaDados, { recursive: true });
    if (JSON.stringify(atual) !== JSON.stringify(final)) {
      fs.writeFileSync(arquivo, `${JSON.stringify(final, null, 2)}\n`);
    }
  } catch {
    // sem permissao de escrita: segue com o padrao em memoria
  }
  return final;
}

const CHAVE_RUN = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run";

/**
 * Cadastro na inicializacao do Windows, lido e gravado direto no registro com
 * reg.exe. NAO usa app.setLoginItemSettings: no Electron 33 ele grava o caminho
 * SEM aspas (o caminho tem espacos) e o getLoginItemSettings ignora o `name`,
 * respondendo sempre "ausente". Mesmo nome/valor do instalador (instalador.nsh).
 */
const registroWindows = {
  ler() {
    try {
      const saida = execFileSync("reg", ["query", CHAVE_RUN, "/v", NOME_INICIO], { encoding: "utf8", windowsHide: true });
      const linha = saida.split(/\r?\n/).find((l) => l.includes("REG_SZ"));
      return linha ? linha.slice(linha.indexOf("REG_SZ") + "REG_SZ".length).trim() : null;
    } catch {
      return null; // valor inexistente: reg.exe sai com erro
    }
  },
  gravar(valor) {
    execFileSync("reg", ["add", CHAVE_RUN, "/v", NOME_INICIO, "/t", "REG_SZ", "/d", valor, "/f"], { windowsHide: true, stdio: "ignore" });
  },
  apagar() {
    try {
      execFileSync("reg", ["delete", CHAVE_RUN, "/v", NOME_INICIO, "/f"], { windowsHide: true, stdio: "ignore" });
    } catch {
      // ja nao existia
    }
  },
};

/** Uso do processador (0 a 1) medido em `ms` milissegundos, somando todos os nucleos. */
function medirUsoCpu(ms = 3000) {
  const somar = () => os.cpus().reduce((t, c) => {
    const total = Object.values(c.times).reduce((a, b) => a + b, 0);
    return { ocupado: t.ocupado + total - c.times.idle, total: t.total + total };
  }, { ocupado: 0, total: 0 });
  const antes = somar();
  return new Promise((ok) => setTimeout(() => {
    const depois = somar();
    const total = depois.total - antes.total;
    ok(total > 0 ? (depois.ocupado - antes.ocupado) / total : 0);
  }, ms));
}

/**
 * Inicio automatico com o Windows (pedido do usuario, 2026-11-16): o sistema ESPERA o
 * computador terminar de ligar e os outros programas abrirem antes de subir. Sai da
 * espera quando o Windows ja esta ligado ha `uptimeMinimo` segundos E o processador
 * esta abaixo de `cpuMaxima` (35%); confere a cada `intervalo` e desiste de esperar
 * depois de `limite` (abre mesmo assim). Devolve quantos ms esperou.
 */
async function esperarComputadorFolgado(registrarLog, opcoes = {}) {
  const {
    uptimeMinimo = 180, cpuMaxima = 0.35, intervalo = 15000, limite = 10 * 60 * 1000,
    uptime = os.uptime, medirCpu = medirUsoCpu, esperar = (ms) => new Promise((ok) => setTimeout(ok, ms)), agora = Date.now,
  } = opcoes;
  const inicio = agora();
  for (;;) {
    const ligadoHa = uptime();
    const cpu = ligadoHa >= uptimeMinimo ? await medirCpu() : 1;
    if (ligadoHa >= uptimeMinimo && cpu <= cpuMaxima) {
      registrarLog("INFO", `inicio automatico: computador folgado (ligado ha ${Math.round(ligadoHa)} s, CPU ${Math.round(cpu * 100)}%) apos ${Math.round((agora() - inicio) / 1000)} s de espera`);
      return agora() - inicio;
    }
    if (agora() - inicio >= limite) {
      registrarLog("INFO", `inicio automatico: abrindo depois de ${Math.round(limite / 60000)} min de espera (CPU ${Math.round(cpu * 100)}%)`);
      return agora() - inicio;
    }
    await esperar(intervalo);
  }
}

/** Registra (ou remove) o sistema na inicializacao do Windows e confere se ficou gravado. */
function configurarInicioComWindows(app, config, registrarLog, registro = registroWindows) {
  if (!app.isPackaged) return false;
  const ligar = Boolean(config.abrirAoLigarComputador);
  const esperado = `"${process.execPath}" ${ARG_INICIO}`;
  try {
    if (ligar && registro.ler() !== esperado) registro.gravar(esperado);
    if (!ligar && registro.ler() !== null) registro.apagar();
  } catch (erro) {
    registrarLog("WARN", `inicio com o Windows: falha ao gravar o cadastro: ${erro && erro.message}`);
  }
  const atual = registro.ler();
  const ok = ligar ? atual === esperado : atual === null;
  registrarLog(ok ? "INFO" : "WARN",
    `inicio com o Windows: pedido ${ligar ? "ligado" : "desligado"}, cadastro no Windows ${atual ? "presente" : "ausente"}`);
  return ok;
}

function caminhoChrome() {
  const candidatos = [
    path.join(process.env.PROGRAMFILES || "C:\\Program Files", "Google", "Chrome", "Application", "chrome.exe"),
    path.join(process.env["PROGRAMFILES(X86)"] || "C:\\Program Files (x86)", "Google", "Chrome", "Application", "chrome.exe"),
    path.join(process.env.LOCALAPPDATA || "", "Google", "Chrome", "Application", "chrome.exe"),
  ];
  return candidatos.find((c) => c && fs.existsSync(c)) || null;
}

/** Endereco aceito: so http(s) (o arquivo de configuracao pode ter sido editado a mao). */
function enderecoSeguro(url) {
  try {
    const u = new URL(String(url));
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/** No inicio automatico, abre o Chrome no e-mail (ou o navegador padrao se nao houver Chrome). */
function abrirEmailSeInicioAutomatico(argv, config, shell, registrarLog, iniciar = spawn) {
  if (!argv.includes(ARG_INICIO) || !config.abrirEmailAoLigar) return null;
  const url = enderecoSeguro(config.enderecoEmail);
  if (!url) {
    registrarLog("WARN", "enderecoEmail invalido em configuracoes.json; e-mail nao aberto");
    return null;
  }
  const chrome = caminhoChrome();
  if (chrome) {
    const proc = iniciar(chrome, [url], { detached: true, stdio: "ignore" });
    proc.unref?.();
    registrarLog("INFO", "inicio automatico: Chrome aberto no e-mail");
    return { navegador: "chrome", url };
  }
  void shell.openExternal(url);
  registrarLog("INFO", "inicio automatico: Chrome nao encontrado, e-mail aberto no navegador padrao");
  return { navegador: "padrao", url };
}

// ---------- atualizacao pelo Google Drive ----------

function pastaDrive() {
  const raizes = [];
  for (let c = 67; c <= 90; c++) raizes.push(`${String.fromCharCode(c)}:\\`); // C: ate Z:
  const candidatos = [];
  for (const r of raizes) candidatos.push(path.join(r, "Meu Drive"), path.join(r, "My Drive"));
  const casa = os.homedir();
  candidatos.push(path.join(casa, "Meu Drive"), path.join(casa, "My Drive"),
    path.join(casa, "Google Drive", "Meu Drive"), path.join(casa, "Google Drive", "My Drive"));
  return candidatos.find((p) => {
    try {
      return fs.statSync(p).isDirectory();
    } catch {
      return false;
    }
  }) || null;
}

function pastaAtualizacoes(app) {
  if (process.env.FINDESK_PASTA_ATUALIZACOES) return process.env.FINDESK_PASTA_ATUALIZACOES;
  if (!app.isPackaged) return null;
  const drive = pastaDrive();
  return drive ? path.join(drive, SUBPASTA_ATUALIZACOES) : null;
}

/** "1.10.0" > "1.9.3" */
function versaoMaior(a, b) {
  const pa = String(a).split(".").map((n) => parseInt(n, 10) || 0);
  const pb = String(b).split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0);
  }
  return false;
}

/**
 * SHA-256 lido em pedacos e SEM bloquear: com o Google Drive em modo "streaming"
 * o arquivo so e baixado quando lido, e uma leitura de uma vez so travaria a tela
 * ate os ~145 MB chegarem.
 */
function sha256Arquivo(arquivo) {
  return new Promise((resolver, rejeitar) => {
    const hash = crypto.createHash("sha256");
    fs.createReadStream(arquivo)
      .on("data", (pedaco) => hash.update(pedaco))
      .on("end", () => resolver(hash.digest("hex")))
      .on("error", rejeitar);
  });
}

/**
 * Le versao.json na pasta de atualizacoes. So devolve a atualizacao se a versao
 * for maior que a instalada E o instalador ja estiver completo (SHA-256 confere:
 * protege contra arquivo pela metade durante a sincronizacao do Drive).
 */
async function procurarAtualizacaoDrive(app, registrarLog, versaoAtual = app.getVersion()) {
  const pasta = pastaAtualizacoes(app);
  if (!pasta) return null;
  try {
    const info = JSON.parse((await fs.promises.readFile(path.join(pasta, "versao.json"), "utf8")).replace(/^\uFEFF/, ""));
    if (!versaoMaior(info.versao, versaoAtual)) return null;
    const nome = path.basename(String(info.arquivo || ""));
    if (!/^Contas a Pagar - Chaveiro Universal - Instalador [\d.]+\.exe$/.test(nome)) return null;
    const instalador = path.join(pasta, nome);
    if (!fs.existsSync(instalador) || (await sha256Arquivo(instalador)) !== String(info.sha256).toLowerCase()) {
      registrarLog("WARN", `atualizacao ${info.versao} encontrada, mas o instalador ainda nao esta completo no Drive`);
      return null;
    }
    return { versao: String(info.versao), origem: "drive", instalador, novidades: String(info.novidades || "") };
  } catch {
    return null; // sem pasta/versao.json: nada a atualizar
  }
}

/**
 * Versao nova nos Releases do GitHub. So devolve se: a versao for maior que a
 * instalada, o instalador tiver o nome exato do sistema, o endereco de download
 * for do proprio repositorio e houver a impressao digital SHA-256 (conferida
 * depois do download, antes de instalar). Sem internet: null (tenta o Drive).
 * FINDESK_API_ATUALIZACOES troca o endereco da API (testes).
 */
async function procurarAtualizacaoGithub(app, registrarLog, versaoAtual = app.getVersion()) {
  const api = process.env.FINDESK_API_ATUALIZACOES || (app.isPackaged ? API_GITHUB : null);
  if (!api) return null;
  try {
    const resposta = await fetch(`${api}/repos/${REPO_GITHUB}/releases/latest`, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "ContasAPagar-Chaveiro-Universal" },
      signal: AbortSignal.timeout(15000),
    });
    if (!resposta.ok) return null;
    const release = await resposta.json();
    const versao = String(release.tag_name || "").replace(/^v/, "");
    if (!/^\d+\.\d+\.\d+$/.test(versao) || !versaoMaior(versao, versaoAtual)) return null;
    const ativo = (release.assets || []).find((a) => {
      const m = NOME_INSTALADOR.exec(String(a.name || ""));
      return m && m[1] === versao;
    });
    if (!ativo) return null;
    const url = String(ativo.browser_download_url || "");
    const origemEsperada = process.env.FINDESK_API_ATUALIZACOES
      ? `${api}/download/` : `https://github.com/${REPO_GITHUB}/releases/download/`;
    if (!url.startsWith(origemEsperada) || !(ativo.size > 0 && ativo.size <= LIMITE_INSTALADOR)) return null;
    const corpo = String(release.body || "");
    const sha256 = (String(ativo.digest || "").match(/^sha256:([0-9a-f]{64})$/i) || corpo.match(/SHA-256 do instalador: ([0-9a-f]{64})/i) || [])[1];
    if (!sha256) {
      registrarLog("WARN", `versao ${versao} no GitHub sem SHA-256: nao oferecida`);
      return null;
    }
    return {
      versao, origem: "github", url, sha256: sha256.toLowerCase(), nome: ativo.name, tamanho: ativo.size,
      novidades: String(release.name || "").replace(/^Contas a Pagar\s*/i, "").trim() === versao ? "" : String(release.name || ""),
    };
  } catch (erro) {
    registrarLog("INFO", `GitHub sem resposta ao procurar atualizacao (${erro && erro.name}); tentando o Google Drive`);
    return null;
  }
}

/**
 * Baixa o instalador do GitHub para a pasta temporaria, calculando o SHA-256
 * enquanto grava. So devolve o caminho se o SHA-256 conferir; senao apaga o
 * arquivo baixado e lanca erro (nada e instalado).
 */
async function baixarInstalador(atualizacao, registrarLog) {
  const pasta = path.join(os.tmpdir(), "contas-atualizacao");
  fs.mkdirSync(pasta, { recursive: true });
  const destino = path.join(pasta, path.basename(atualizacao.nome));
  const parcial = `${destino}.parcial`;
  const resposta = await fetch(atualizacao.url, {
    headers: { "User-Agent": "ContasAPagar-Chaveiro-Universal" },
    signal: AbortSignal.timeout(20 * 60 * 1000),
  });
  if (!resposta.ok || !resposta.body) throw new Error(`download recusado (HTTP ${resposta.status})`);
  const hash = crypto.createHash("sha256");
  const saida = fs.createWriteStream(parcial);
  let total = 0;
  try {
    for await (const pedaco of resposta.body) {
      total += pedaco.length;
      if (total > LIMITE_INSTALADOR) throw new Error("instalador maior que o limite");
      hash.update(pedaco);
      if (!saida.write(pedaco)) await new Promise((ok) => saida.once("drain", ok));
    }
    await new Promise((ok, erro) => saida.end((e) => (e ? erro(e) : ok())));
  } catch (erro) {
    saida.destroy();
    fs.rmSync(parcial, { force: true });
    throw erro;
  }
  const calculado = hash.digest("hex");
  if (calculado !== atualizacao.sha256) {
    fs.rmSync(parcial, { force: true });
    throw new Error("SHA-256 do instalador baixado nao confere");
  }
  fs.renameSync(parcial, destino);
  registrarLog("INFO", `instalador ${atualizacao.versao} baixado do GitHub e conferido (SHA-256)`);
  return destino;
}

/** GitHub primeiro; sem resposta de la, a pasta do Google Drive. */
async function procurarAtualizacao(app, registrarLog, versaoAtual = app.getVersion()) {
  // com a pasta do Drive forcada (testes/manutencao), so ela vale
  if (!process.env.FINDESK_PASTA_ATUALIZACOES) {
    const doGithub = await procurarAtualizacaoGithub(app, registrarLog, versaoAtual);
    if (doGithub) return doGithub;
  }
  return procurarAtualizacaoDrive(app, registrarLog, versaoAtual);
}

/** ATUALIZAR: baixa do GitHub (se for de la), confere, executa e fecha o sistema. */
async function aplicarAtualizacao(app, atualizacao, registrarLog, iniciar = spawn) {
  const pronta = atualizacao.origem === "github"
    ? { ...atualizacao, instalador: await baixarInstalador(atualizacao, registrarLog) }
    : atualizacao;
  return instalarAtualizacao(app, pronta, registrarLog, iniciar);
}

/** Copia o instalador para a pasta temporaria, executa e fecha o sistema. */
function instalarAtualizacao(app, atualizacao, registrarLog, iniciar = spawn) {
  const destino = path.join(os.tmpdir(), path.basename(atualizacao.instalador));
  // o baixado do GitHub ja esta na pasta temporaria (subpasta propria): copiar so do Drive
  if (path.resolve(destino) !== path.resolve(atualizacao.instalador)) {
    fs.copyFileSync(atualizacao.instalador, destino);
  }
  // espera o sistema (e o Java) fecharem antes de o instalador substituir os arquivos
  const comando = `Start-Sleep -Seconds 3; Start-Process -FilePath '${destino.replace(/'/g, "''")}'`;
  const proc = iniciar("powershell.exe", ["-NoProfile", "-WindowStyle", "Hidden", "-Command", comando],
    { detached: true, stdio: "ignore", windowsHide: true });
  proc.unref?.();
  registrarLog("INFO", `instalando a atualizacao ${atualizacao.versao}`);
  setTimeout(() => app.quit(), 500);
  return destino;
}

module.exports = {
  ARG_INICIO,
  SUBPASTA_ATUALIZACOES,
  PADRAO,
  lerConfiguracoes,
  configurarInicioComWindows,
  esperarComputadorFolgado,
  medirUsoCpu,
  abrirEmailSeInicioAutomatico,
  enderecoSeguro,
  pastaDrive,
  REPO_GITHUB,
  procurarAtualizacao,
  procurarAtualizacaoGithub,
  procurarAtualizacaoDrive,
  baixarInstalador,
  aplicarAtualizacao,
  instalarAtualizacao,
  versaoMaior,
  sha256Arquivo,
};
