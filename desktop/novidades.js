// O QUE MUDOU (pedido do usuario, 2026-11-23): depois de uma atualizacao, o Menu mostra um
// pop-up com o que foi feito desde a ultima vez que a pessoa viu. A lista sai dos commits
// "feat:" (NOVO), "fix:" (CORRIGIDO) e "perf:" (MAIS RAPIDO) e e gravada em
// desktop/novidades.json na hora de gerar o instalador (no `npm run dev` sai do git na hora).
// O "ja visto" fica ao lado do banco (novidades-vistas.json). Instalacao nova (sem banco
// ainda) nao mostra nada: so quem ja usava o sistema e foi atualizado.
// Arquivo IGUAL nos dois sistemas (Contas a Pagar e Garantias). Sem Electron (teste-novidades.js).
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ARQUIVO_HISTORICO = path.join(__dirname, "novidades.json");
const TIPOS = { feat: "NOVO", fix: "CORRIGIDO", perf: "MAIS RÁPIDO" };
// mudancas so de bastidor (testes, CI, analise de seguranca): nao interessam a loja
const BASTIDOR = /\b(testes?|smoke|ensaio|spotbugs|typecheck|ci|workflow)\b/i;
const MAXIMO = 60;
const PRIMEIRA_VEZ_DIAS = 30;

/** Linhas "data<TAB>assunto" do git log -> [{ data, tipo, texto }], mais novo primeiro. */
function converter(saidaGit) {
  const itens = [];
  for (const linha of String(saidaGit || "").split(/\r?\n/)) {
    const [data, ...resto] = linha.split("\t");
    const assunto = resto.join("\t").trim();
    const m = /^(feat|fix|perf)(\([^)]*\))?!?:\s*(.+)$/i.exec(assunto);
    if (!m || !data || Number.isNaN(Date.parse(data)) || BASTIDOR.test(m[3])) continue;
    const texto = m[3].charAt(0).toUpperCase() + m[3].slice(1);
    itens.push({ data: new Date(data).toISOString(), tipo: TIPOS[m[1].toLowerCase()], texto });
  }
  return itens.sort((a, b) => b.data.localeCompare(a.data));
}

/** Historico dos ultimos 6 meses direto do git (gerar o instalador / npm run dev). */
function gerarHistorico(raiz) {
  const saida = execFileSync("git", ["log", "--since=180.days", "--no-merges", "--format=%cI%x09%s"], {
    cwd: raiz,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  return converter(saida).slice(0, 400);
}

function gravarHistorico(raiz, arquivo = ARQUIVO_HISTORICO) {
  const itens = gerarHistorico(raiz);
  fs.writeFileSync(arquivo, JSON.stringify(itens, null, 1));
  return itens;
}

function carregarHistorico(raiz, arquivo = ARQUIVO_HISTORICO) {
  try {
    if (fs.existsSync(arquivo)) return JSON.parse(fs.readFileSync(arquivo, "utf8"));
    return gerarHistorico(raiz);
  } catch {
    return [];
  }
}

function lerVisto(arquivoVisto) {
  try {
    return JSON.parse(fs.readFileSync(arquivoVisto, "utf8"));
  } catch {
    return null;
  }
}

/** Marca como visto ate a mudanca mais nova desta versao. */
function marcarVisto(arquivoVisto, versao, historico) {
  try {
    fs.mkdirSync(path.dirname(arquivoVisto), { recursive: true });
    const ate = historico[0]?.data ?? new Date().toISOString();
    fs.writeFileSync(arquivoVisto, JSON.stringify({ versao, ate }));
    return true;
  } catch {
    return false;
  }
}

/**
 * O que mostrar ao abrir o Menu: { versao, itens, restantes } ou null.
 * `usadoAntes` = o banco ja existia antes desta abertura (instalacao nova nao mostra nada e
 * ja marca como visto). Primeira vez com este recurso: as mudancas dos ultimos 30 dias.
 */
function novidadesPendentes({ arquivoVisto, historico, versao, usadoAntes, agora = Date.now() }) {
  const visto = lerVisto(arquivoVisto);
  if (visto && visto.versao === versao) return null;
  if (!visto && !usadoAntes) {
    marcarVisto(arquivoVisto, versao, historico);
    return null;
  }
  const desde = visto?.ate ?? new Date(agora - PRIMEIRA_VEZ_DIAS * 86400000).toISOString();
  const novas = historico.filter((n) => n.data > desde);
  if (!novas.length) {
    marcarVisto(arquivoVisto, versao, historico);
    return null;
  }
  return { versao, itens: novas.slice(0, MAXIMO), restantes: Math.max(0, novas.length - MAXIMO) };
}

module.exports = { converter, gerarHistorico, gravarHistorico, carregarHistorico, novidadesPendentes, marcarVisto, ARQUIVO_HISTORICO };
