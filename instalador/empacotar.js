// Gera o instalador Windows (.exe) do Sistema de Contas a Pagar — Chaveiro Universal.
// Passos: frontend (typecheck + Tailwind + esbuild) -> backend (Maven, COM testes)
// -> Java minimo (jlink) -> instalador NSIS (electron-builder).
// Saida: release/Contas a Pagar - Chaveiro Universal - Instalador <versao>.exe
// (so o instalador atual fica em release/; o resto do empacotamento vai para
// build/empacotamento/, que e apagado e refeito a cada execucao)
// Uso: node instalador/empacotar.js   (ou: npm run instalador)
const { execFileSync, execSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const RAIZ = path.join(__dirname, "..");
const pkg = require(path.join(RAIZ, "package.json"));

async function etapa(nome, fn) {
  const inicio = Date.now();
  console.log(`\n=== ${nome} ===`);
  await fn();
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

const SAIDA = path.join(RAIZ, "build", "empacotamento");
const RELEASE = path.join(RAIZ, "release");
const ICONE = path.join(__dirname, "icone.ico");

/**
 * Poe o emblema e o nome/versao no .exe do sistema. O electron-builder esta com
 * signAndEditExecutable=false (o rcedit/winCodeSign exige links simbolicos no
 * Windows), entao a edicao e feita aqui com o resedit, que ja vem com ele.
 */
function marcarExecutavel(exe) {
  const ResEdit = require("resedit");
  const binario = ResEdit.NtExecutable.from(fs.readFileSync(exe));
  const recursos = ResEdit.NtExecutableResource.from(binario);
  const icone = ResEdit.Data.IconFile.from(fs.readFileSync(ICONE));
  const grupos = ResEdit.Resource.IconGroupEntry.fromEntries(recursos.entries);
  const idGrupo = grupos.length ? grupos[0].id : 1;
  const idioma = grupos.length ? grupos[0].lang : 1033;
  ResEdit.Resource.IconGroupEntry.replaceIconsForResource(recursos.entries, idGrupo, idioma, icone.icons.map((i) => i.data));
  const versoes = ResEdit.Resource.VersionInfo.fromEntries(recursos.entries);
  const info = versoes[0] || ResEdit.Resource.VersionInfo.createEmpty();
  const [a, b, c] = pkg.version.split(".").map(Number);
  info.setFileVersion(a, b, c, 0, 1033);
  info.setProductVersion(a, b, c, 0, 1033);
  info.setStringValues({ lang: 1033, codepage: 1200 }, {
    FileDescription: "Sistema de Contas a Pagar - Chaveiro Universal",
    ProductName: "Contas a Pagar - Chaveiro Universal",
    CompanyName: "Chaveiro Universal",
    LegalCopyright: "Copyright (c) 2026 Chaveiro Universal",
    OriginalFilename: path.basename(exe),
    FileVersion: pkg.version,
    ProductVersion: pkg.version,
  });
  info.outputToResourceEntries(recursos.entries);
  recursos.outputResource(binario);
  fs.writeFileSync(exe, Buffer.from(binario.generate()));
}

async function main() {
await etapa("Frontend", () => execSync("npm run build", { cwd: RAIZ, stdio: "inherit" }));
await etapa("Backend (testes + jar)", () => execSync(`${acharMaven()} -q -f backend/pom.xml package`, { cwd: RAIZ, stdio: "inherit" }));
await etapa("Java minimo (jlink)", () => execFileSync(process.execPath, [path.join(__dirname, "gerar-jre.js")], { cwd: RAIZ, stdio: "inherit" }));

await etapa("Instalador (electron-builder / NSIS)", () => {
  fs.rmSync(SAIDA, { recursive: true, force: true });
  const builder = require("electron-builder");
  const jar = path.join(RAIZ, "backend", "target", "findesk-backend-0.1.0.jar");
  if (!fs.existsSync(jar)) throw new Error(`jar nao encontrado: ${jar}`);
  return builder.build({
    targets: builder.Platform.WINDOWS.createTarget("nsis", builder.Arch.x64),
    config: {
      appId: "br.com.chaveirouniversal.contasapagar",
      productName: "Contas a Pagar - Chaveiro Universal",
      copyright: "Copyright (c) 2026 Chaveiro Universal",
      directories: { output: SAIDA, buildResources: "instalador" },
      // usa o Electron ja instalado em node_modules (nao baixa outro)
      electronDist: path.join(RAIZ, "node_modules", "electron", "dist"),
      electronVersion: require(path.join(RAIZ, "node_modules", "electron", "package.json")).version,
      files: [
        "package.json",
        "desktop/main.js",
        "desktop/preload.js",
        "desktop/automacoes.js",
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
      win: { target: "nsis", icon: ICONE, signAndEditExecutable: false, artifactName: "Contas a Pagar - Chaveiro Universal - Instalador ${version}.${ext}" },
      afterPack: async (contexto) => {
        marcarExecutavel(path.join(contexto.appOutDir, `${contexto.packager.appInfo.productFilename}.exe`));
      },
      nsis: {
        installerIcon: ICONE,
        uninstallerIcon: ICONE,
        installerHeaderIcon: ICONE,
        oneClick: true,
        perMachine: false,
        runAfterFinish: true,
        createDesktopShortcut: true,
        createStartMenuShortcut: true,
        shortcutName: "Contas a Pagar",
        // os DADOS ficam em %LOCALAPPDATA%\ChaveiroUniversal\ContasAPagar e NUNCA sao apagados
        deleteAppDataOnUninstall: false,
        // cadastra o sistema na inicializacao do Windows ja na instalacao
        include: path.join(__dirname, "instalador.nsh"),
      },
    },
  });
});

await etapa("Release enxuto (so o instalador atual)", () => {
  const nome = `Contas a Pagar - Chaveiro Universal - Instalador ${pkg.version}.exe`;
  fs.mkdirSync(RELEASE, { recursive: true });
  // release/ e pasta gerada (ignorada no Git): fica so o instalador desta versao
  for (const item of fs.readdirSync(RELEASE)) {
    if (item !== nome) fs.rmSync(path.join(RELEASE, item), { recursive: true, force: true });
  }
  fs.copyFileSync(path.join(SAIDA, nome), path.join(RELEASE, nome));
  console.log(`[instalador] ${path.join(RELEASE, nome)} (${(fs.statSync(path.join(RELEASE, nome)).size / 1024 / 1024).toFixed(1)} MB)`);
});

console.log(`\nVersao ${pkg.version} pronta em ${RELEASE}`);
}

main().catch((erro) => {
  console.error(`\n[instalador] FALHOU: ${erro.message}`);
  process.exit(1);
});
