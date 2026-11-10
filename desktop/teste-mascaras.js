// Testes unitarios das mascaras e conversoes (frontend/ts/mascaras.ts).
// Compila o modulo TypeScript em memoria com o esbuild do projeto e testa as
// funcoes puras — sem Electron, sem backend, sem banco.
// Uso: node desktop/teste-mascaras.js   (ou: npm run test:mascaras)
const path = require("path");
const esbuild = require("esbuild");

const saida = esbuild.buildSync({
  entryPoints: [path.join(__dirname, "..", "frontend", "ts", "mascaras.ts")],
  bundle: true,
  format: "cjs",
  platform: "node",
  write: false,
});
const modulo = { exports: {} };
new Function("module", "exports", saida.outputFiles[0].text)(modulo, modulo.exports);
const m = modulo.exports;

const resultados = [];
function igual(nome, obtido, esperado) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  resultados.push(ok);
  console.log(`${ok ? "[OK]    " : "[FALHA]"} ${nome}${ok ? "" : ` — obtido ${JSON.stringify(obtido)}, esperado ${JSON.stringify(esperado)}`}`);
}

// simula a digitacao de um texto, caractere a caractere, sempre no fim do campo
function digitar(mascara, texto) {
  let valor = "";
  for (const c of texto) valor = m.reformatar(mascara, valor + c, valor.length + 1).valor;
  return valor;
}

const { MASCARAS } = m;

console.log("\n=== CPF ===");
igual("CPF completo", digitar(MASCARAS.cpf, "52998224725"), "529.982.247-25");
igual("CPF parcial (3 digitos) sem separador sobrando", digitar(MASCARAS.cpf, "529"), "529");
igual("CPF parcial (4 digitos)", digitar(MASCARAS.cpf, "5299"), "529.9");
igual("CPF parcial (10 digitos)", digitar(MASCARAS.cpf, "5299822472"), "529.982.247-2");
igual("CPF ignora letras e limita a 11 digitos", digitar(MASCARAS.cpf, "5a2998224725999"), "529.982.247-25");
igual("CPF colado com pontuacao", m.reformatar(MASCARAS.cpf, "529.982.247-25", 14).valor, "529.982.247-25");
igual("cpfValido: CPF valido", m.cpfValido("529.982.247-25"), true);
igual("cpfValido: digito errado", m.cpfValido("529.982.247-24"), false);
igual("cpfValido: todos iguais", m.cpfValido("111.111.111-11"), false);
igual("formatarCPF para exibir dado da API", m.formatarCPF("52998224725"), "529.982.247-25");

console.log("\n=== CNPJ (numerico e alfanumerico) ===");
igual("CNPJ numerico completo", digitar(MASCARAS.cnpj, "11222333000181"), "11.222.333/0001-81");
igual("CNPJ parcial (5)", digitar(MASCARAS.cnpj, "11222"), "11.222");
igual("CNPJ parcial (9)", digitar(MASCARAS.cnpj, "112223330"), "11.222.333/0");
igual("CNPJ alfanumerico vira maiusculo", digitar(MASCARAS.cnpj, "12abc34501de35"), "12.ABC.345/01DE-35");
igual("CNPJ: letras recusadas nos digitos verificadores", m.limparCNPJ("12ABC34501DEXY35"), "12ABC34501DE35");
igual("cnpjValido: numerico", m.cnpjValido("11.222.333/0001-81"), true);
igual("cnpjValido: numerico com DV errado", m.cnpjValido("11.222.333/0001-82"), false);
igual("cnpjValido: alfanumerico oficial (12.ABC.345/01DE-35)", m.cnpjValido("12.ABC.345/01DE-35"), true);
igual("cnpjValido: alfanumerico minusculo", m.cnpjValido("12abc34501de35"), true);
igual("cnpjValido: alfanumerico com DV errado", m.cnpjValido("12ABC34501DE36"), false);
igual("cnpjValido: letra no DV", m.cnpjValido("12ABC34501DE3A"), false);
igual("cnpjValido: todos iguais", m.cnpjValido("00000000000000"), false);
igual("cnpjValido: curto", m.cnpjValido("1122233300018"), false);

console.log("\n=== Telefone, CEP, data, dia ===");
igual("Telefone fixo (10)", digitar(MASCARAS.telefone, "1133334444"), "(11) 3333-4444");
igual("Celular (11)", digitar(MASCARAS.telefone, "11987654321"), "(11) 98765-4321");
igual("Telefone parcial (7)", digitar(MASCARAS.telefone, "1133334"), "(11) 3333-4");
igual("Telefone limita a 11 digitos", digitar(MASCARAS.telefone, "119876543219"), "(11) 98765-4321");
igual("formatarTelefone para exibir dado salvo", m.formatarTelefone("11987654321"), "(11) 98765-4321");
igual("CEP completo", digitar(MASCARAS.cep, "01310100"), "01310-100");
igual("Data digitada", digitar(MASCARAS.data, "31122026"), "31/12/2026");
igual("Data parcial (3)", digitar(MASCARAS.data, "311"), "31/1");
igual("Dia: so digitos, maximo 2", digitar(MASCARAS.dia, "3a15"), "31");

console.log("\n=== Moeda (digitacao por centavos, sem 'R$' duplicado) ===");
igual("Moeda 123456 -> 1.234,56", digitar(MASCARAS.moeda, "123456"), "1.234,56");
igual("Moeda 5 -> 0,05", digitar(MASCARAS.moeda, "5"), "0,05");
igual("Moeda: zeros a esquerda descartados", digitar(MASCARAS.moeda, "0005"), "0,05");
igual("Moeda: apagar tudo deixa o campo VAZIO (nao trava em 0,00)", m.reformatar(MASCARAS.moeda, "0,0", 3).valor, "");
igual("Moeda: letras ignoradas", digitar(MASCARAS.moeda, "abc"), "");
igual("Moeda: maximo 999.999.999,99", digitar(MASCARAS.moeda, "9999999999999"), "999.999.999,99");
igual("Moeda: valor antigo com R$ e reeditado", m.reformatar(MASCARAS.moeda, "R$ 1.234,567", 12).valor, "12.345,67");
igual("Moeda: cursor sempre no fim", m.reformatar(MASCARAS.moeda, "1234", 1).cursor, 5);
igual("formatarMoedaBR (exibicao)", m.formatarMoedaBR(123456), "R$ 1.234,56");
igual("formatarMoedaCampo zero vira vazio", m.formatarMoedaCampo(0), "");

console.log("\n=== paraCentavos ===");
igual("paraCentavos 'R$ 1.234,56'", m.paraCentavos("R$ 1.234,56"), 123456);
igual("paraCentavos '1.234,56'", m.paraCentavos("1.234,56"), 123456);
igual("paraCentavos '1234,5'", m.paraCentavos("1234,5"), 123450);
igual("paraCentavos '1.234' e milhar (R$ 1.234,00)", m.paraCentavos("1.234"), 123400);
igual("paraCentavos '1.234.567' e milhar", m.paraCentavos("1.234.567"), 123456700);
igual("paraCentavos '1234.5' (ponto decimal)", m.paraCentavos("1234.5"), 123450);
igual("paraCentavos zero e invalido", m.paraCentavos("R$ 0,00"), null);
igual("paraCentavos vazio e invalido", m.paraCentavos(""), null);
igual("paraCentavos 3 casas e invalido", m.paraCentavos("12,345"), null);
igual("paraCentavos texto e invalido", m.paraCentavos("doze"), null);

console.log("\n=== Datas ===");
igual("parseDataBR valida", m.parseDataBR("31/12/2026"), "2026-12-31");
igual("parseDataBR bissexto 29/02/2028", m.parseDataBR("29/02/2028"), "2028-02-29");
igual("parseDataBR 29/02/2026 inexistente", m.parseDataBR("29/02/2026"), null);
igual("parseDataBR 31/04 inexistente", m.parseDataBR("31/04/2026"), null);
igual("parseDataBR incompleta", m.parseDataBR("31/12/26"), null);
igual("formatarDataBR", m.formatarDataBR("2026-12-31"), "31/12/2026");

console.log("\n=== Cursor e Backspace/Delete sobre separadores ===");
igual("Cursor: inserir no meio do CPF mantem posicao",
  m.reformatar(MASCARAS.cpf, "529.9182.247-2", 6), { valor: "529.918.224-72", cursor: 6 });
igual("Backspace logo apos '-' apaga o digito anterior (nao trava)",
  m.apagarSobreSeparador(MASCARAS.cpf, "529.982.247-25", 12, "tras"), { valor: "529.982.242-5", cursor: 10 });
igual("Backspace logo apos '.' apaga o digito anterior",
  m.apagarSobreSeparador(MASCARAS.cpf, "529.982.247-25", 4, "tras"), { valor: "529.822.472-5", cursor: 2 });
igual("Delete antes de '/' apaga o caractere seguinte",
  m.apagarSobreSeparador(MASCARAS.cnpj, "11.222.333/0001-81", 10, "frente"), { valor: "11.222.333/0018-1", cursor: 10 });
igual("Backspace sobre digito segue o navegador (null)",
  m.apagarSobreSeparador(MASCARAS.cpf, "529.982.247-25", 3, "tras"), null);
igual("Backspace no inicio segue o navegador (null)",
  m.apagarSobreSeparador(MASCARAS.cpf, "529", 0, "tras"), null);
igual("Telefone: Backspace apos ') ' apaga o DDD",
  m.apagarSobreSeparador(MASCARAS.telefone, "(11) 3333-4444", 5, "tras"), { valor: "(13) 3334-444", cursor: 2 });

const falhas = resultados.filter((ok) => !ok).length;
console.log(`\n=== RESULTADO MASCARAS: ${resultados.length - falhas}/${resultados.length} verificacoes passaram ===`);
process.exit(falhas ? 1 : 0);
