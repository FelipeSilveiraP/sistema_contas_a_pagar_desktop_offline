// Publica o instalador ja gerado na pasta de atualizacoes do Google Drive:
//   <Meu Drive>\Chaveiro Universal - Atualizacoes\
//     Contas a Pagar - Chaveiro Universal - Instalador <versao>.exe
//     versao.json  { versao, arquivo, sha256, novidades, publicadoEm }
// O Drive sincroniza; o sistema da loja ve a versao maior ao abrir e oferece
// ATUALIZAR (so instala se o SHA-256 conferir = arquivo completo).
//
// Uso:  npm run publicar -- "o que mudou nesta versao"
//       npm run publicar -- --pasta "D:\outra pasta" "novidades"
// Fluxo completo de uma atualizacao:  (subir a versao no package.json)
//       npm run instalador  ->  npm run publicar -- "novidades"
const fs = require("fs");
const path = require("path");
const automacoes = require("../desktop/automacoes");

const RAIZ = path.join(__dirname, "..");
const versao = require(path.join(RAIZ, "package.json")).version;
const nome = `Contas a Pagar - Chaveiro Universal - Instalador ${versao}.exe`;
const instalador = path.join(RAIZ, "release", nome);

const args = process.argv.slice(2);
let pasta = null;
const iPasta = args.indexOf("--pasta");
if (iPasta >= 0) {
  pasta = args[iPasta + 1];
  args.splice(iPasta, 2);
}
const novidades = args.join(" ").trim();

if (!fs.existsSync(instalador)) {
  console.error(`Instalador da versao ${versao} nao encontrado: ${instalador}\nRode antes: npm run instalador`);
  process.exit(1);
}
if (!pasta) {
  const drive = automacoes.pastaDrive();
  if (!drive) {
    console.error('Pasta do Google Drive ("Meu Drive") nao encontrada. Use: npm run publicar -- --pasta "<pasta>"');
    process.exit(1);
  }
  pasta = path.join(drive, automacoes.SUBPASTA_ATUALIZACOES);
}
fs.mkdirSync(pasta, { recursive: true });

// remove instaladores antigos da pasta (so os deste sistema)
for (const arq of fs.readdirSync(pasta)) {
  if (/^Contas a Pagar - Chaveiro Universal - Instalador [\d.]+\.exe$/.test(arq) && arq !== nome) {
    fs.unlinkSync(path.join(pasta, arq));
  }
}
fs.copyFileSync(instalador, path.join(pasta, nome));
(async () => {
  const info = {
    versao,
    arquivo: nome,
    sha256: await automacoes.sha256Arquivo(instalador),
    novidades,
    publicadoEm: new Date().toISOString(),
  };
  // versao.json por ultimo: quem le so ve a versao nova depois do .exe copiado
  fs.writeFileSync(path.join(pasta, "versao.json"), `${JSON.stringify(info, null, 2)}\n`);
  console.log(`Versao ${versao} publicada em: ${pasta}`);
  console.log("Quando o Google Drive terminar de sincronizar, o sistema da loja vai oferecer ATUALIZAR ao abrir.");
})();
