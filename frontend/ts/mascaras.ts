// Mascaras reutilizaveis de digitacao (TypeScript puro, sem bibliotecas).
//
// Cada mascara e um par de funcoes PURAS (testadas em desktop/teste-mascaras.js):
//   limpar(texto) -> caracteres aceitos, ja no limite de tamanho
//   montar(limpo) -> texto exibido no campo
// A ligacao com o <input> (aplicarMascara) cuida de digitacao, colagem,
// Backspace/Delete — inclusive sobre separadores como ".", "/", "-" —,
// edicao no meio do texto e posicao do cursor. Listeners sao registrados uma
// unica vez por campo; para campos cujo tipo muda (editores das tabelas) use
// mascaraDinamica.

export interface Mascara {
  limpar(texto: string): string;
  montar(limpo: string): string;
  /** moeda: o cursor fica sempre no fim (digitacao da direita para a esquerda) */
  cursorNoFim?: boolean;
}

/** Letras e digitos contam como conteudo; o resto e formatacao. */
function ehConteudo(c: string): boolean {
  return /[0-9A-Za-z]/.test(c);
}

function soDigitos(texto: string, max: number): string {
  return texto.replace(/\D/g, "").slice(0, max);
}

/** Aplica um padrao como "###.###.###-##": separadores so aparecem quando ha conteudo depois deles. */
function aplicarPadrao(limpo: string, padrao: string): string {
  let saida = "";
  let i = 0;
  for (const p of padrao) {
    if (i >= limpo.length) break;
    if (p === "#") saida += limpo[i++];
    else saida += p;
  }
  return saida;
}

// ---------- formatadores puros (tambem servem para EXIBIR dados vindos da API) ----------

export function formatarCPF(texto: string): string {
  return aplicarPadrao(soDigitos(texto, 11), "###.###.###-##");
}

/**
 * CNPJ numerico ou alfanumerico (Receita Federal, a partir de 07/2026):
 * 12 primeiros caracteres A-Z/0-9 (maiusculos) + 2 digitos verificadores numericos.
 */
export function limparCNPJ(texto: string): string {
  let saida = "";
  for (const c of texto.toUpperCase()) {
    if (saida.length >= 14) break;
    if (!/[0-9A-Z]/.test(c)) continue;
    if (saida.length >= 12 && !/\d/.test(c)) continue;
    saida += c;
  }
  return saida;
}

export function formatarCNPJ(texto: string): string {
  return aplicarPadrao(limparCNPJ(texto), "##.###.###/####-##");
}

export function formatarTelefone(texto: string): string {
  const d = soDigitos(texto, 11);
  return aplicarPadrao(d, d.length <= 10 ? "(##) ####-####" : "(##) #####-####");
}

export function formatarCEP(texto: string): string {
  return aplicarPadrao(soDigitos(texto, 8), "#####-###");
}

export function formatarDataDigitada(texto: string): string {
  return aplicarPadrao(soDigitos(texto, 8), "##/##/####");
}

/** Centavos -> "1.234,56" (sem prefixo; o campo ja exibe "R$" ao lado). Zero -> "". */
export function formatarMoedaCampo(centavos: number): string {
  if (!Number.isFinite(centavos) || centavos <= 0) return "";
  const inteiro = Math.floor(centavos / 100);
  const resto = centavos % 100;
  return `${inteiro.toLocaleString("pt-BR")},${String(resto).padStart(2, "0")}`;
}

/** Centavos -> "R$ 1.234,56" (para tabelas, totais e textos). */
export function formatarMoedaBR(centavos: number): string {
  const inteiro = Math.floor(centavos / 100);
  const resto = centavos % 100;
  return `R$ ${inteiro.toLocaleString("pt-BR")},${String(resto).padStart(2, "0")}`;
}

// ---------- definicoes das mascaras ----------

export const MASCARAS = {
  cpf: { limpar: (t: string) => soDigitos(t, 11), montar: formatarCPF } as Mascara,
  cnpj: { limpar: limparCNPJ, montar: formatarCNPJ } as Mascara,
  telefone: { limpar: (t: string) => soDigitos(t, 11), montar: formatarTelefone } as Mascara,
  cep: { limpar: (t: string) => soDigitos(t, 8), montar: formatarCEP } as Mascara,
  data: { limpar: (t: string) => soDigitos(t, 8), montar: formatarDataDigitada } as Mascara,
  /** Digitacao por centavos: "123456" -> "1.234,56"; zeros a esquerda descartados; ate R$ 999.999.999,99. */
  moeda: {
    limpar: (t: string) => soDigitos(t, 30).replace(/^0+/, "").slice(0, 11),
    montar: (d: string) => (d ? formatarMoedaCampo(parseInt(d, 10)) : ""),
    cursorNoFim: true,
  } as Mascara,
  /** Dia do mes (1 a 31): so digitos, no maximo 2. A faixa e validada no envio. */
  dia: { limpar: (t: string) => soDigitos(t, 2), montar: (d: string) => d } as Mascara,
};

// ---------- nucleo puro: reformatar texto + cursor ----------

function contarConteudo(texto: string, ate: number): number {
  let n = 0;
  for (let i = 0; i < ate && i < texto.length; i++) if (ehConteudo(texto[i])) n++;
  return n;
}

function posicaoDoConteudo(texto: string, alvo: number): number {
  if (alvo <= 0) return 0;
  let n = 0;
  for (let i = 0; i < texto.length; i++) {
    if (ehConteudo(texto[i])) n++;
    if (n === alvo) return i + 1;
  }
  return texto.length;
}

/**
 * Reformata um texto bruto mantendo o cursor apos o mesmo caractere de conteudo.
 * Ex.: CPF "123.4567" com cursor no fim -> { valor: "123.456.7", cursor: 9 }.
 */
export function reformatar(mascara: Mascara, bruto: string, cursorBruto: number): { valor: string; cursor: number } {
  const limpo = mascara.limpar(bruto);
  const valor = mascara.montar(limpo);
  if (mascara.cursorNoFim) return { valor, cursor: valor.length };
  const antes = Math.min(contarConteudo(bruto, cursorBruto), limpo.length);
  return { valor, cursor: posicaoDoConteudo(valor, antes) };
}

/**
 * Backspace/Delete com o cursor encostado num separador: apaga o caractere de
 * conteudo vizinho (em vez de "travar" no separador, que a mascara recolocaria).
 * Retorna null quando a tecla deve seguir o comportamento normal do navegador.
 */
export function apagarSobreSeparador(
  mascara: Mascara,
  valor: string,
  cursor: number,
  direcao: "tras" | "frente",
): { valor: string; cursor: number } | null {
  if (direcao === "tras") {
    if (cursor <= 0 || ehConteudo(valor[cursor - 1])) return null;
    let j = cursor - 1;
    while (j >= 0 && !ehConteudo(valor[j])) j--;
    if (j < 0) return null;
    return reformatar(mascara, valor.slice(0, j) + valor.slice(j + 1), j);
  }
  if (cursor >= valor.length || ehConteudo(valor[cursor])) return null;
  let j = cursor;
  while (j < valor.length && !ehConteudo(valor[j])) j++;
  if (j >= valor.length) return null;
  return reformatar(mascara, valor.slice(0, j) + valor.slice(j + 1), j);
}

// ---------- ligacao com o DOM ----------

function aplicarMascara(input: HTMLInputElement, obterMascara: () => Mascara | null): void {
  const escrever = (r: { valor: string; cursor: number }): void => {
    input.value = r.valor;
    if (document.activeElement === input) input.setSelectionRange(r.cursor, r.cursor);
  };
  input.addEventListener("beforeinput", (evento) => {
    const mascara = obterMascara();
    const tipo = (evento as InputEvent).inputType;
    if (!mascara || (tipo !== "deleteContentBackward" && tipo !== "deleteContentForward")) return;
    const ini = input.selectionStart;
    if (ini === null || ini !== input.selectionEnd) return;
    const r = apagarSobreSeparador(mascara, input.value, ini, tipo === "deleteContentBackward" ? "tras" : "frente");
    if (!r) return;
    evento.preventDefault();
    escrever(r);
    // mantem o fluxo de "input" (form sujo, validacao ao digitar)
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  input.addEventListener("input", () => {
    const mascara = obterMascara();
    if (!mascara) return;
    const r = reformatar(mascara, input.value, input.selectionStart ?? input.value.length);
    if (r.valor !== input.value) escrever(r);
  });
}

export function mascaraMoeda(input: HTMLInputElement): void {
  aplicarMascara(input, () => MASCARAS.moeda);
}

export function mascaraCPF(input: HTMLInputElement): void {
  aplicarMascara(input, () => MASCARAS.cpf);
}

export function mascaraCNPJ(input: HTMLInputElement): void {
  aplicarMascara(input, () => MASCARAS.cnpj);
}

export function mascaraTelefone(input: HTMLInputElement): void {
  aplicarMascara(input, () => MASCARAS.telefone);
}

export function mascaraCEP(input: HTMLInputElement): void {
  aplicarMascara(input, () => MASCARAS.cep);
}

export function mascaraData(input: HTMLInputElement): void {
  aplicarMascara(input, () => MASCARAS.data);
}

export function mascaraDia(input: HTMLInputElement): void {
  aplicarMascara(input, () => MASCARAS.dia);
}

/**
 * Mascara que depende de outro controle (ex.: editor das tabelas, em que o
 * select escolhe se o novo valor e data, moeda ou texto livre).
 */
export function mascaraDinamica(input: HTMLInputElement, escolher: () => keyof typeof MASCARAS | null): void {
  aplicarMascara(input, () => {
    const chave = escolher();
    return chave ? MASCARAS[chave] : null;
  });
}

// ---------- conversoes de entrada ----------

/** Converte "R$ 1.234,56" / "1.234,56" / "1234,56" / "1.234" (milhar) / "1234.5" em centavos (> 0). */
export function paraCentavos(entrada: string): number | null {
  const limpo = entrada.replace(/R\$/g, "").replace(/\s/g, "");
  if (!limpo) return null;
  let normalizado: string;
  if (limpo.includes(",")) {
    if (!/^(\d{1,3}(\.\d{3})*|\d+),\d{1,2}$/.test(limpo)) return null;
    normalizado = limpo.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(limpo)) {
    // "1.234" em portugues e mil duzentos e trinta e quatro reais
    normalizado = limpo.replace(/\./g, "");
  } else {
    if (!/^\d{1,12}(\.\d{1,2})?$/.test(limpo)) return null;
    normalizado = limpo;
  }
  const centavos = Math.round(Number(normalizado) * 100);
  return Number.isFinite(centavos) && centavos > 0 ? centavos : null;
}

/** Converte "dd/mm/aaaa" em ISO (yyyy-mm-dd); valida datas reais e bissextos. */
export function parseDataBR(entrada: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(entrada.trim());
  if (!m) return null;
  const dia = Number(m[1]);
  const mes = Number(m[2]);
  const ano = Number(m[3]);
  if (ano < 1900 || ano > 2999 || mes < 1 || mes > 12) return null;
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  if (data.getUTCFullYear() !== ano || data.getUTCMonth() !== mes - 1 || data.getUTCDate() !== dia) {
    return null;
  }
  return `${m[3]}-${m[2]}-${m[1]}`;
}

export function formatarDataBR(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

// ---------- validacoes de documento (frontend espelha o backend) ----------

function todosIguais(texto: string): boolean {
  return texto.split("").every((c) => c === texto[0]);
}

export function cpfValido(entrada: string): boolean {
  const cpf = entrada.replace(/\D/g, "");
  if (cpf.length !== 11 || todosIguais(cpf)) return false;
  const d = cpf.split("").map(Number);
  let soma = 0;
  for (let i = 0; i < 9; i++) soma += d[i] * (10 - i);
  const dig1 = soma % 11 < 2 ? 0 : 11 - (soma % 11);
  if (dig1 !== d[9]) return false;
  soma = 0;
  for (let i = 0; i < 10; i++) soma += d[i] * (11 - i);
  const dig2 = soma % 11 < 2 ? 0 : 11 - (soma % 11);
  return dig2 === d[10];
}

/** CNPJ numerico ou alfanumerico: modulo 11 com valor = codigo ASCII - 48. */
export function cnpjValido(entrada: string): boolean {
  const cnpj = entrada.toUpperCase().replace(/[^0-9A-Z]/g, "");
  if (!/^[0-9A-Z]{12}\d{2}$/.test(cnpj) || todosIguais(cnpj)) return false;
  const v = cnpj.split("").map((c) => c.charCodeAt(0) - 48);
  const digito = (pesos: number[]): number => {
    const soma = pesos.reduce((acc, p, i) => acc + v[i] * p, 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  return digito([5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === v[12] && digito([6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === v[13];
}
