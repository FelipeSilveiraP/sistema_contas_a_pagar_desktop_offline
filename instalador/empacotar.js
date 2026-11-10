// Gera o instalador Windows (.exe) do Sistema de Contas a Pagar — Chaveiro Universal.
// Passos: frontend (typecheck + Tailwind + esbuild) -> backend (Maven, COM testes)
// -> Java minimo (jlink) -> instalador NSIS (electron-builder).
// Saida: release/Contas a Pagar - Chaveiro Universal - Instalador <versao>.exe
// Uso: node instalador/empacotar.js   (ou: npm run instalador)
const { execFileSync, execSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const RAIZ = path.join(__dirname, "..");
const pkg = require(path.join(RAIZ, "package.json"));

function etapa(nome, fn) {
  const inicio = Date.now();
  console.log(`\n=== ${nome} ===`);
  fn();
  console.log(`=== ${nome}: ok (${((Date.now() - inicio) / 1000).toFixed(0)}s) ===`);
}

function acharMaven() {
  try {
    execSync("mvn -v", { stdio: "ignore" });
    return "mvn";
  } catch {
    const local = path.join(os.homedir(), "apache-maven-3.9.6", "bin", "mvn.cmd");
    if (fs.existsSync(local)) return `"${local}"`;
    throw new Error("Maven nao encontrado (instale o Maven 3.9+ ou coloque-o no PATH)");
  }
}

async function main() {
await etapa("Frontend", () => execSync("npm run build", { cwd: RAIZ, stdio: "inherit" }));
await etapa("Backend (testes + jar)", () => execSync(`${acharMaven()} -q -f backend/pom.xml package`, { cwd: RAIZ, stdio: "inherit" }));
await etapa("Java minimo (jlink)", () => execFileSync(process.execPath, [path.join(__dirname, "gerar-jre.js")], { cwd: RAIZ, stdio: "inherit" }));

await etapa("Instalador (electron-builder / NSIS)", () => {
  const builder = require("electron-builder");
  const jar = path.join(RAIZ, "backend", "target", "findesk-backend-0.1.0.jar");
  if (!fs.existsSync(jar)) throw new Error(`jar nao encontrado: ${jar}`);
  return builder.build({
    targets: builder.Platform.WINDOWS.createTarget("nsis", builder.Arch.x64),
    config: {
      appId: "br.com.chaveirouniversal.contasapagar",
      productName: "Contas a Pagar - Chaveiro Universal",
      copyright: "Copyright (c) 2026 Chaveiro Universal",
      directories: { output: "release", buildResources: "instalador" },
      // usa o Electron ja instalado em node_modules (nao baixa outro)
      electronDist: path.join(RAIZ, "node_modules", "electron", "dist"),
      electronVersion: require(path.join(RAIZ, "node_modules", "electron", "package.json")).version,
      files: [
        "package.json",
        "desktop/main.js",
        "desktop/preload.js",
        "frontend/html/**",
        "frontend/css/fonts.css",
        "frontend/dist/**",
        "frontend/assets/**",
      ],
      extraResources: [
        { from: jar, to: "backend/findesk-backend.jar" },
        { from: path.join(RAIZ, "build", "jre"), to: "jre" },
      ],
      asar: true,
      // sem certificado de assinatura: nao assina nem edita o .exe (evita o winCodeSign,
      // que exige permissao de links simbolicos no Windows)
      win: { target: "nsis", signAndEditExecutable: false, artifactName: "Contas a Pagar - Chaveiro Universal - Instalador ${version}.${ext}" },
      nsis: {
        oneClick: true,
        perMachine: false,
        runAfterFinish: true,
        createDesktopShortcut: true,
        createStartMenuShortcut: true,
        shortcutName: "Contas a Pagar",
        // os DADOS ficam em %LOCALAPPDATA%\ChaveiroUniversal\ContasAPagar e NUNCA sao apagados
        deleteAppDataOnUninstall: false,
      },
    },
  }).then((arquivos) => {
    for (const a of arquivos) console.log(`[instalador] ${a} (${(fs.statSync(a).size / 1024 / 1024).toFixed(1)} MB)`);
  });
});

console.log(`\nVersao ${pkg.version} pronta em ${path.join(RAIZ, "release")}`);
}

main().catch((erro) => {
  console.error(`\n[instalador] FALHOU: ${erro.message}`);
  process.exit(1);
});
