// Automacoes do sistema instalado (pedido do usuario, 2026-11-12):
// 1) abrir sozinho quando o Windows liga (login do usuario);
// 2) nesse inicio automatico, abrir o Chrome no e-mail da firma;
// 3) atualizacao pelo Google Drive: o instalador novo e colocado na pasta
//    "Meu Drive\Chaveiro Universal - Atualizacoes" (npm run publicar) e o
//    sistema da loja oferece ATUALIZAR quando ve uma versao maior.
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
async function procurarAtualizacao(app, registrarLog, versaoAtual = app.getVersion()) {
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
    return { versao: String(info.versao), instalador, novidades: String(info.novidades || "") };
  } catch {
    return null; // sem pasta/versao.json: nada a atualizar
  }
}

/** Copia o instalador para a pasta temporaria, executa e fecha o sistema. */
function instalarAtualizacao(app, atualizacao, registrarLog, iniciar = spawn) {
  const destino = path.join(os.tmpdir(), path.basename(atualizacao.instalador));
  fs.copyFileSync(atualizacao.instalador, destino);
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
  abrirEmailSeInicioAutomatico,
  enderecoSeguro,
  pastaDrive,
  procurarAtualizacao,
  instalarAtualizacao,
  versaoMaior,
  sha256Arquivo,
};
