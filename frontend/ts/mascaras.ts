// Mascaras reutilizaveis de digitacao (TypeScript puro, sem bibliotecas).
// Todas funcionam com digitacao, colagem, Backspace/Delete, edicao no meio do
// texto e selecao/substituicao; preservam a posicao do cursor por indice de
// digito e nao recriam elementos DOM (listeners sao registrados uma unica vez).

type Montadora = (digitos: string) => string;

function posicaoPorDigito(texto: string, posCursor: number): number {
  let cont = 0;
  for (let i = 0; i < posCursor && i < texto.length; i++) {
    if (/\d/.test(texto[i])) cont++;
  }
  return cont;
}

function cursorPorDigito(texto: string, alvoDigito: number): number {
  let cont = 0;
  for (let i = 0; i < texto.length; i++) {
    if (cont === alvoDigito) return i;
    if (/\d/.test(texto[i])) cont++;
  }
  return texto.length;
}

function aplicarMascaraDigitos(input: HTMLInputElement, montar: Montadora, maxDigitos: number): void {
  input.addEventListener("input", () => {
    const antes = input.value;
    const cursor = input.selectionStart ?? antes.length;
    const digitosAntes = posicaoPorDigito(antes, cursor);
    const digitos = antes.replace(/\D/g, "").slice(0, maxDigitos);
    const formatado = montar(digitos);
    input.value = formatado;
    input.setSelectionRange(cursorPorDigito(formatado, digitosAntes), cursorPorDigito(formatado, digitosAntes));
  });
}

export function formatarMoedaBR(centavos: number): string {
  const inteiro = Math.floor(centavos / 100);
  const resto = centavos % 100;
  return `R$ ${inteiro.toLocaleString("pt-BR")},${String(resto).padStart(2, "0")}`;
}

/** Digitação por centavos: "123456" -> "R$ 1.234,56". */
export function mascaraMoeda(input: HTMLInputElement): void {
  aplicarMascaraDigitos(input, (digitos) => {
    const centavos = digitos.length ? parseInt(digitos.slice(-11), 10) : 0;
    return formatarMoedaBR(centavos);
  }, 11);
}

/** Converte "R$ 1.234,56" / "1.234,56" / "1234,56" em centavos inteiros. */
export function paraCentavos(entrada: string): number | null {
  const limpo = entrada.replace(/R\$/g, "").trim();
  if (!limpo) return null;
  let normalizado: string;
  if (limpo.includes(",")) {
    if (!/^(\d{1,3}(\.\d{3})*|\d+),\d{1,2}$/.test(limpo)) return null;
    normalizado = limpo.replace(/\./g, "").replace(",", ".");
  } else {
    if (!/^\d{1,12}(\.\d{1,2})?$/.test(limpo)) return null;
    normalizado = limpo;
  }
  const centavos = Math.round(Number(normalizado) * 100);
  return Number.isFinite(centavos) && centavos > 0 ? centavos : null;
}

export function mascaraCPF(input: HTMLInputElement): void {
  aplicarMascaraDigitos(input, (d) =>
    d.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2"), 11);
}

export function mascaraCNPJ(input: HTMLInputElement): void {
  aplicarMascaraDigitos(input, (d) =>
    d.replace(/(\d{2})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1/$2").replace(/(\d{4})(\d{1,2})$/, "$1-$2"), 14);
}

export function mascaraTelefone(input: HTMLInputElement): void {
  aplicarMascaraDigitos(input, (d) => {
    if (d.length <= 10) {
      return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d{1,4})$/, "$1-$2");
    }
    return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d{1,4})$/, "$1-$2");
  }, 11);
}

export function mascaraCEP(input: HTMLInputElement): void {
  aplicarMascaraDigitos(input, (d) => d.replace(/(\d{5})(\d{1,3})$/, "$1-$2"), 8);
}

export function mascaraData(input: HTMLInputElement): void {
  aplicarMascaraDigitos(input, (d) =>
    d.replace(/(\d{2})(\d)/, "$1/$2").replace(/(\d{2}\/\d{2})(\d)/, "$1/$2"), 8);
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
