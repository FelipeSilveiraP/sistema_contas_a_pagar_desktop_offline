const { spawn } = require("child_process");
const crypto = require("crypto");
const path = require("path");
const net = require("net");
const fs = require("fs");

const JAR = path.join(__dirname, "..", "backend", "target", "findesk-backend-0.1.0.jar");
const resultados = [];

function teste(nome, ok, detalhe = "") {
  resultados.push({ nome, ok, detalhe });
  console.log(`${ok ? "[OK]    " : "[FALHA]"} ${nome}${detalhe ? " — " + detalhe : ""}`);
}

function portaLivre() {
  return new Promise((resolver, rejeitar) => {
    const servidor = net.createServer();
    servidor.listen(0, "127.0.0.1", () => {
      const p = servidor.address().port;
      servidor.close(() => resolver(p));
    });
    servidor.on("error", rejeitar);
  });
}

function esperar(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function subirBackend() {
  const porta = await portaLivre();
  const token = crypto.randomBytes(24).toString("hex");
  const logs = [];
  const proc = spawn("java", ["-jar", JAR], {
    env: { ...process.env, SERVER_PORT: String(porta), FINDESK_API_TOKEN: token },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  proc.stdout.on("data", (d) => logs.push(d.toString()));
  proc.stderr.on("data", (d) => logs.push(d.toString()));
  const inicio = Date.now();
  while (Date.now() - inicio < 60000) {
    try {
      const resposta = await fetch(`http://127.0.0.1:${porta}/api/status`, {
        headers: { "X-FinDesk-Token": token },
      });
      if (resposta.ok) return { proc, porta, token, logs };
    } catch {
      await esperar(400);
    }
  }
  proc.kill();
  throw new Error("backend nao respondeu em 60s");
}

function encerrarBackend({ proc }) {
  return new Promise((resolver) => {
    if (proc.exitCode !== null) return resolver();
    proc.once("exit", () => resolver());
    proc.kill();
  });
}

async function api(porta, token, caminho, opcoes = {}) {
  return fetch(`http://127.0.0.1:${porta}${caminho}`, {
    ...opcoes,
    headers: { "X-FinDesk-Token": token, "Content-Type": "application/json", ...(opcoes.headers || {}) },
  });
}

async function main() {
  if (!fs.existsSync(JAR)) {
    console.error("Backend nao compilado. Execute: mvn -f backend/pom.xml package");
    process.exit(1);
  }

  console.log("=== Teste de persistencia: fechar e reabrir o aplicativo ===\n");
  const nome = `BANCO TESTE PERSISTENCIA ${Date.now()}`;
  const dados = { instituicao: nome, codigoBanco: "001", agencia: "1234-5", conta: "98765-4", chavePix: "pix@exemplo.com" };

  console.log("1. Abrindo o aplicativo (backend)...");
  const primeira = await subirBackend();

  console.log("2. Cadastrando banco ficticio...");
  const criado = await api(primeira.porta, primeira.token, "/api/bancos", {
    method: "POST",
    body: JSON.stringify(dados),
  });
  const registro = await criado.json();
  teste("Cadastro retorna 201 com id", criado.status === 201 && registro.id > 0, `id=${registro.id}`);
  const consulta1 = await (await api(primeira.porta, primeira.token, `/api/bancos/${registro.id}`)).json();
  teste("Cadastro confirmado antes de fechar", consulta1.instituicao === nome, consulta1.instituicao);

  console.log("3. Fechando o aplicativo (processo encerrado)...");
  await encerrarBackend(primeira);
  teste("Processo do backend encerrado", primeira.proc.exitCode !== null || primeira.proc.killed);

  console.log("4. Reabrindo o aplicativo...");
  const segunda = await subirBackend();

  console.log("5. Consultando o banco cadastrado...");
  const resposta2 = await api(segunda.porta, segunda.token, `/api/bancos/${registro.id}`);
  const consulta2 = await resposta2.json();
  teste(
    "Dados preservados apos reinicializacao",
    resposta2.status === 200 &&
      consulta2.instituicao === nome &&
      consulta2.codigoBanco === dados.codigoBanco &&
      consulta2.agencia === dados.agencia &&
      consulta2.conta === dados.conta,
    JSON.stringify(consulta2)
  );

  console.log("6. Limpando o registro ficticio...");
  const exclusao = await api(segunda.porta, segunda.token, `/api/bancos/${registro.id}`, { method: "DELETE" });
  teste("Exclusao de limpeza retorna 204", exclusao.status === 204, String(exclusao.status));
  const aposExclusao = await api(segunda.porta, segunda.token, `/api/bancos/${registro.id}`);
  teste("Registro ficticio removido (404)", aposExclusao.status === 404, String(aposExclusao.status));

  await encerrarBackend(segunda);
  teste("Backend encerrado ao final do teste", true);

  const todosLogs = primeira.logs.join("") + segunda.logs.join("");
  teste("Token NAO aparece nos logs do backend", !todosLogs.includes(primeira.token) && !todosLogs.includes(segunda.token));

  const falhas = resultados.filter((r) => !r.ok);
  console.log(`\n=== RESULTADO: ${resultados.length - falhas.length}/${resultados.length} verificacoes passaram ===`);
  for (const f of falhas) console.log(` - [FALHA] ${f.nome} ${f.detalhe}`);
  process.exit(falhas.length ? 1 : 0);
}

main().catch((erro) => {
  console.error("ERRO FATAL:", erro);
  process.exit(1);
});
