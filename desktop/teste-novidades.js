// Teste do O QUE MUDOU (desktop/novidades.js), sem Electron: node desktop/teste-novidades.js
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const n = require("./novidades");

let ok = 0;
function caso(nome, fn) {
  fn();
  ok++;
  console.log(`ok - ${nome}`);
}

const pasta = fs.mkdtempSync(path.join(os.tmpdir(), "novidades-"));
const visto = path.join(pasta, "novidades-vistas.json");
const agora = Date.parse("2026-11-23T12:00:00Z");
const historico = n.converter([
  "2026-11-23T10:00:00-03:00\tfix: RM fora do ar diz o motivo",
  "2026-11-19T10:00:00-03:00\tfeat(cupom): pop-up da automacao com CANCELAR",
  "2026-11-19T09:00:00-03:00\tdocs: regra fiscal",
  "2026-11-18T09:00:00-03:00\tfix: SQL fixo (alerta do SpotBugs)",
  "2026-11-18T08:00:00-03:00\ttest: teste novo",
  "2026-09-01T08:00:00-03:00\tperf: menu abre mais rapido",
  "lixo sem tab",
].join("\n"));

caso("converte feat/fix/perf e ignora docs, testes e bastidor", () => {
  assert.deepStrictEqual(historico.map((h) => h.tipo), ["CORRIGIDO", "NOVO", "MAIS RÁPIDO"]);
  assert.strictEqual(historico[1].texto, "Pop-up da automacao com CANCELAR");
  assert.strictEqual(historico[0].data, "2026-11-23T13:00:00.000Z");
});

caso("instalacao nova (sem banco antes) nao mostra e marca como visto", () => {
  assert.strictEqual(n.novidadesPendentes({ arquivoVisto: visto, historico, versao: "1.4.50", usadoAntes: false, agora }), null);
  assert.strictEqual(JSON.parse(fs.readFileSync(visto, "utf8")).versao, "1.4.50");
  fs.rmSync(visto);
});

caso("primeira vez com o recurso: mudancas dos ultimos 30 dias", () => {
  const r = n.novidadesPendentes({ arquivoVisto: visto, historico, versao: "1.4.50", usadoAntes: true, agora });
  assert.strictEqual(r.itens.length, 2);
  assert.strictEqual(r.restantes, 0);
});

caso("ENTENDI marca como visto: na mesma versao nao aparece de novo", () => {
  assert.ok(n.marcarVisto(visto, "1.4.50", historico));
  assert.strictEqual(n.novidadesPendentes({ arquivoVisto: visto, historico, versao: "1.4.50", usadoAntes: true, agora }), null);
});

caso("versao nova: so o que veio depois do ultimo visto", () => {
  const maisNovo = n.converter("2026-11-25T10:00:00-03:00\tfeat: O QUE MUDOU depois de atualizar").concat(historico);
  const r = n.novidadesPendentes({ arquivoVisto: visto, historico: maisNovo, versao: "1.4.51", usadoAntes: true, agora });
  assert.deepStrictEqual(r.itens.map((i) => i.texto), ["O QUE MUDOU depois de atualizar"]);
});

caso("versao nova sem mudanca para a loja: nada e ja marca como visto", () => {
  assert.strictEqual(n.novidadesPendentes({ arquivoVisto: visto, historico, versao: "1.4.52", usadoAntes: true, agora }), null);
  assert.strictEqual(JSON.parse(fs.readFileSync(visto, "utf8")).versao, "1.4.52");
});

caso("lista longa: no maximo 60 e conta as restantes", () => {
  fs.rmSync(visto);
  const muitos = Array.from({ length: 75 }, (_, i) => ({ data: new Date(agora - i * 60000).toISOString(), tipo: "NOVO", texto: `item ${i}` }));
  const r = n.novidadesPendentes({ arquivoVisto: visto, historico: muitos, versao: "2.0.0", usadoAntes: true, agora });
  assert.strictEqual(r.itens.length, 60);
  assert.strictEqual(r.restantes, 15);
});

caso("historico do git deste repositorio (o mesmo que vai no instalador)", () => {
  const itens = n.gerarHistorico(path.join(__dirname, ".."));
  assert.ok(Array.isArray(itens));
  itens.forEach((i) => assert.ok(i.data && i.tipo && i.texto));
});

fs.rmSync(pasta, { recursive: true, force: true });
console.log(`\n${ok} testes do O QUE MUDOU passaram`);
