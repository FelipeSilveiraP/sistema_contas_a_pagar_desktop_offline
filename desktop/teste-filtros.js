// Testes unitarios dos filtros avancados (frontend/ts/filtros.ts): periodo,
// ordenacao, busca por texto/valor e datas no horario local.
// Uso: node desktop/teste-filtros.js   (ou: npm run test:filtros)
const path = require("path");
const esbuild = require("esbuild");

const saida = esbuild.buildSync({
  entryPoints: [path.join(__dirname, "..", "frontend", "ts", "filtros.ts")],
  bundle: true,
  format: "cjs",
  platform: "node",
  write: false,
});
const modulo = { exports: {} };
new Function("module", "exports", saida.outputFiles[0].text)(modulo, modulo.exports);
const f = modulo.exports;

const resultados = [];
function igual(nome, obtido, esperado) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  resultados.push(ok);
  console.log(`${ok ? "[OK]    " : "[FALHA]"} ${nome}${ok ? "" : ` — obtido ${JSON.stringify(obtido)}, esperado ${JSON.stringify(esperado)}`}`);
}

console.log("\n=== Datas no horario local ===");
// 09/11/2026 as 22h no Brasil = 10/11 01h em UTC: o dia correto e 09/11
igual("isoLocal usa o dia local (22h nao vira o dia seguinte)", f.isoLocal(new Date(2026, 10, 9, 22, 30)), "2026-11-09");
igual("diasAte: vence hoje = 0", f.diasAte("2026-11-09", "2026-11-09"), 0);
igual("diasAte: amanha = 1", f.diasAte("2026-11-10", "2026-11-09"), 1);
igual("diasAte: atrasada 3 dias = -3", f.diasAte("2026-11-06", "2026-11-09"), -3);
igual("diasAte atravessa o ano", f.diasAte("2027-01-01", "2026-12-31"), 1);

console.log("\n=== Ordenacao ===");
const itens = [
  { nome: "Enel", data: "2026-11-20", valor: 320.5 },
  { nome: "aluguel", data: "2026-11-05", valor: 1500 },
  { nome: "Água", data: "2026-11-12", valor: 89.9 },
];
const chaves = { data: (x) => x.data, valor: (x) => x.valor, nome: (x) => x.nome };
igual("Data crescente", f.ordenar(itens, "DATA_ASC", chaves).map((x) => x.nome), ["aluguel", "Água", "Enel"]);
igual("Data decrescente", f.ordenar(itens, "DATA_DESC", chaves).map((x) => x.nome), ["Enel", "Água", "aluguel"]);
igual("Valor maior primeiro", f.ordenar(itens, "VALOR_DESC", chaves).map((x) => x.valor), [1500, 320.5, 89.9]);
igual("Valor menor primeiro", f.ordenar(itens, "VALOR_ASC", chaves).map((x) => x.valor), [89.9, 320.5, 1500]);
igual("Nome A-Z ignora maiusculas e acentos", f.ordenar(itens, "NOME", chaves).map((x) => x.nome), ["Água", "aluguel", "Enel"]);
igual("Ordenar nao altera a lista original", itens.map((x) => x.nome), ["Enel", "aluguel", "Água"]);

console.log("\n=== Busca por texto ou valor (RealizarBusca do VBA) ===");
igual("Busca vazia aceita tudo", f.correspondeBusca("", ["Enel"], 10), true);
igual("Texto sem acento acha nome com acento", f.correspondeBusca("agua", ["Água e Esgoto"], 10), true);
igual("Texto em maiusculas", f.correspondeBusca("ENEL", ["Enel Distribuição"], 10), true);
igual("Texto inexistente", f.correspondeBusca("silca", ["Enel"], 10), false);
igual("Numero acha valor R$ 150,00", f.correspondeBusca("150", ["Enel"], 150), true);
igual("Numero acha valor R$ 1.150,00", f.correspondeBusca("150", ["Enel"], 1150), true);
igual("Valor exato com virgula", f.correspondeBusca("150,00", ["Enel"], 150), true);
igual("Valor exato com R$", f.correspondeBusca("R$ 320,50", ["Enel"], 320.5), true);
igual("Valor diferente nao acha", f.correspondeBusca("150,00", ["Enel"], 151), false);
igual("Documento com numeros acha por texto", f.correspondeBusca("NF-e 148", ["NF-e 14892"], 10), true);
igual("Texto misto com numero nao vira busca por valor", f.correspondeBusca("Balcao 2", ["Balcao 01"], 2), false);

const falhas = resultados.filter((ok) => !ok).length;
console.log(`\n=== RESULTADO FILTROS: ${resultados.length - falhas}/${resultados.length} verificacoes passaram ===`);
process.exit(falhas ? 1 : 0);
