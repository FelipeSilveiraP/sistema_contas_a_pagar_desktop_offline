// Gera o Java minimo que vai DENTRO do instalador (o usuario nao instala Java).
// Usa o jlink do JDK 21 desta maquina (sem download): so os modulos que o
// backend Spring Boot + SQLite precisa. Saida: build/jre (~50-70 MB).
// Uso: node instalador/gerar-jre.js   (ou: npm run jre)
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const RAIZ = path.join(__dirname, "..");
const SAIDA = path.join(RAIZ, "build", "jre");

// Modulos usados pelo Spring Boot 3.3 (web/Tomcat, logback, Jackson) e sqlite-jdbc.
const MODULOS = [
  "java.base", "java.desktop", "java.instrument", "java.logging", "java.management",
  "java.naming", "java.net.http", "java.prefs", "java.rmi", "java.scripting",
  "java.security.jgss", "java.sql", "java.transaction.xa", "java.xml",
  "jdk.crypto.ec", "jdk.unsupported", "jdk.zipfs", "jdk.charsets", "jdk.localedata",
];

function acharJlink() {
  const candidatos = [];
  if (process.env.JAVA_HOME) candidatos.push(path.join(process.env.JAVA_HOME, "bin", "jlink.exe"));
  try {
    const java = execFileSync("where", ["java"], { encoding: "utf8" }).split(/\r?\n/).find(Boolean);
    if (java) candidatos.push(path.join(path.dirname(java.trim()), "jlink.exe"));
  } catch {
    // sem java no PATH
  }
  const achado = candidatos.find((c) => fs.existsSync(c));
  if (!achado) throw new Error("jlink nao encontrado: instale o JDK 21 e defina JAVA_HOME");
  return achado;
}

fs.rmSync(SAIDA, { recursive: true, force: true });
fs.mkdirSync(path.dirname(SAIDA), { recursive: true });
const jlink = acharJlink();
console.log(`[jre] ${jlink}`);
execFileSync(jlink, [
  "--add-modules", MODULOS.join(","),
  "--include-locales", "pt-BR,en",
  "--strip-debug", "--no-man-pages", "--no-header-files",
  "--compress", "zip-6",
  "--output", SAIDA,
], { stdio: "inherit" });

let total = 0;
const somar = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
  const p = path.join(d, e.name);
  if (e.isDirectory()) somar(p);
  else total += fs.statSync(p).size;
});
somar(SAIDA);
console.log(`[jre] gerado em ${SAIDA} (${(total / 1024 / 1024).toFixed(1)} MB)`);
