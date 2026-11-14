// TESTE DE CRUD REAL — o sistema usado como um funcionario usaria: cliques e
// digitacao REAIS do Windows (SendInput via entrada-real.ps1), dados concretos,
// todos os campos preenchidos, e em cada tela: criar, ler, editar e excluir.
//
// Isolamento (REGRA DE OURO): banco, logs, Downloads e relatorios em %TEMP%;
// nada toca o banco operacional nem a pasta Downloads do usuario. Abrir PDF no
// leitor externo e simulado (shell.openPath) para nao abrir janelas fora do app.
//
// Uso: npx electron desktop/teste-crud-real.js   (NAO use o computador enquanto roda)
const { app, screen, shell } = require("electron");
const { execFileSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");

const PASTA = fs.mkdtempSync(path.join(os.tmpdir(), "findesk-crud-real-"));
process.env.FINDESK_DB_PATH = path.join(PASTA, "contas-crud-real.db");
app.setPath("downloads", path.join(PASTA, "downloads"));
const arquivosAbertos = [];
shell.openPath = async (alvo) => {
  arquivosAbertos.push(alvo);
  return "";
};
const CAPTURAS = path.join(PASTA, "capturas");
fs.mkdirSync(CAPTURAS, { recursive: true });

require("./main.js");

let janela = null;
const resultados = [];

function teste(nome, ok, detalhe = "") {
  resultados.push({ nome, ok: Boolean(ok) });
  console.log(`${ok ? "[OK]    " : "[FALHA]"} ${nome}${detalhe ? " — " + detalhe : ""}`);
}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const js = (codigo) => janela.webContents.executeJavaScript(codigo);
const q = (seletor) => `document.querySelector(${JSON.stringify(seletor)})`;

async function esperarPredicado(codigo, timeoutMs = 12000) {
  const inicio = Date.now();
  while (Date.now() - inicio < timeoutMs) {
    try {
      if (await js(codigo)) return true;
    } catch {
      // pagina trocando
    }
    await esperar(150);
  }
  return false;
}

async function esperarTela(tela) {
  return esperarPredicado(`document.body && document.body.dataset.tela === ${JSON.stringify(tela)} && document.body.dataset.pronto === 'true'`, 15000);
}

function entradaReal(acao, extra = {}) {
  const args = ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", path.join(__dirname, "entrada-real.ps1"), "-Acao", acao];
  if (extra.x !== undefined) args.push("-X", String(extra.x), "-Y", String(extra.y));
  try {
    return execFileSync("powershell.exe", args, {
      encoding: "utf8",
      windowsHide: true,
      env: { ...process.env, ENTRADA_TEXTO: extra.texto ?? "" },
    }).trim();
  } catch (erro) {
    return `ERRO: ${erro.message}`;
  }
}

/** Centro do elemento (expressao JS) em coordenadas absolutas do SendInput. */
async function ponto(expr) {
  const rect = JSON.parse(await js(`(() => {
    const el = ${expr};
    if (!el) return 'null';
    el.scrollIntoView({ block: 'center', inline: 'center' });
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return 'null';
    return JSON.stringify({ x: r.x + r.width / 2, y: r.y + r.height / 2 });
  })()`));
  if (!rect) return null;
  const conteudo = janela.getContentBounds();
  const fisico = screen.dipToScreenPoint({ x: Math.round(conteudo.x + rect.x), y: Math.round(conteudo.y + rect.y) });
  const display = screen.getPrimaryDisplay();
  const origem = screen.dipToScreenPoint({ x: 0, y: 0 });
  const fim = screen.dipToScreenPoint({ x: display.bounds.width, y: display.bounds.height });
  return {
    x: Math.round(((fisico.x - origem.x) / (fim.x - origem.x)) * 65535),
    y: Math.round(((fisico.y - origem.y) / (fim.y - origem.y)) * 65535),
  };
}

async function clicar(expr) {
  await esperar(120);
  const p = await ponto(expr);
  if (!p) return false;
  entradaReal("clicar", p);
  await esperar(350);
  return true;
}

const clicarSel = (seletor) => clicar(q(seletor));

/** Clica no campo, seleciona o conteudo atual e DIGITA (digitacao real substitui). */
async function digitarEm(seletor, texto) {
  if (!(await clicarSel(seletor))) return false;
  await js(`(() => { const el = ${q(seletor)}; if (el && el.select) el.select(); return true; })()`);
  entradaReal("digitar", { texto });
  await esperar(250);
  return true;
}

const valor = (seletor) => js(`(${q(seletor)} || {}).value ?? null`);
const texto = (seletor) => js(`(${q(seletor)} || {}).textContent ?? ''`);

/** <select> nativo: o menu suspenso do Windows nao e confiavel por SendInput; escolhe pelo DOM. */
async function escolher(seletor, valorOpcao) {
  return js(`(() => { const s = ${q(seletor)}; if (!s) return false; s.value = ${JSON.stringify(valorOpcao)};
    s.dispatchEvent(new Event('change', { bubbles: true })); s.dispatchEvent(new Event('input', { bubbles: true })); return s.value === ${JSON.stringify(valorOpcao)}; })()`);
}

async function notificacoes() {
  return js(`Array.from(document.querySelectorAll('.notificacao__texto')).map((e) => e.textContent).join(' | ')`);
}

async function esperarNotificacao(trecho, timeoutMs = 8000) {
  return esperarPredicado(`Array.from(document.querySelectorAll('.notificacao__texto')).some((e) => e.textContent.includes(${JSON.stringify(trecho)}))`, timeoutMs);
}

async function responderDialogo(acao) {
  if (!(await esperarPredicado(`!!document.querySelector('[data-dialogo]')`, 5000))) return false;
  const titulo = await texto("[data-dialogo-titulo]");
  await clicarSel(`[data-dialogo-acao="${acao}"]`);
  await esperarPredicado(`!document.querySelector('[data-dialogo]')`, 4000);
  return titulo;
}

async function ir(tela) {
  await js(`window.finDesk.navegar(${JSON.stringify(tela)})`);
  return esperarTela(tela);
}

async function capturar(nome) {
  const img = await janela.webContents.capturePage();
  fs.writeFileSync(path.join(CAPTURAS, `${nome}.png`), img.toPNG());
}

function dataBR(diasAFrente) {
  const d = new Date();
  d.setDate(d.getDate() + diasAFrente);
  return {
    digitos: `${String(d.getDate()).padStart(2, "0")}${String(d.getMonth() + 1).padStart(2, "0")}${d.getFullYear()}`,
    br: `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`,
  };
}

const linhaCom = (corpo, trecho) => `Array.from(document.querySelectorAll('${corpo} tr')).find((tr) => tr.textContent.toUpperCase().includes(${JSON.stringify(trecho.toUpperCase())}))`;

// =====================================================================
async function executar() {
  while (!janela) await esperar(100);
  janela.setAlwaysOnTop(true);
  if (janela.isMaximized()) janela.unmaximize();
  janela.setContentSize(1366, 768);
  janela.center();
  await esperarTela("menu");
  await esperarPredicado("document.body.dataset.apiStatus === 'ok'", 30000);
  console.log(`\n=== TESTE DE CRUD REAL — pasta isolada: ${PASTA} ===\n`);

  // ---------- MENU: alertas comecam vazios ----------
  await esperarPredicado("document.body.dataset.alertas !== undefined", 8000);
  teste("Menu: 'Mensagens do dia' sem contas mostra 'Tudo em dia'", (await texto("#alertas-corpo")).includes("Tudo em dia"));

  // ---------- 1. BANCO (criar pela UI real) ----------
  teste("Menu → CADASTROS (clique real)", await clicarSel('a[data-path="cadastros"]') && await esperarTela("cadastros"));
  teste("CADASTROS → NOVO CADASTRO (clique real)", await clicarSel('a[data-modulo="novo-cadastro"]') && await esperarTela("novo-cadastro"));
  teste("NOVO CADASTRO → BANCO (clique real)", await clicarSel('a[data-modulo="banco"]') && await esperarTela("form-banco"));
  await digitarEm("#campo-instituicao", "Banco do Brasil");
  await digitarEm("#campo-chave-pix", "financeiro@chaveirouniversal.com.br");
  teste("Banco: campos digitados", (await valor("#campo-instituicao")) === "Banco do Brasil" && (await valor("#campo-chave-pix")) === "financeiro@chaveirouniversal.com.br");
  await capturar("01-form-banco-preenchido");
  await clicarSel("#btn-salvar");
  teste("Banco: SALVAR cria o cadastro (notificação de sucesso)", await esperarPredicado("document.body.dataset.bancoSalvo !== undefined") && await esperarNotificacao("Banco do Brasil"), await notificacoes());

  // ---------- 2. PAGADOR ----------
  await ir("form-pagador");
  await digitarEm("#campo-nome", "Carlos Eduardo Silva");
  await digitarEm("#campo-cpf", "52998224725");
  teste("Pagador: máscara de CPF na digitação real", (await valor("#campo-cpf")) === "529.982.247-25", await valor("#campo-cpf"));
  await digitarEm("#campo-funcao", "Gerente");
  await clicarSel("#btn-salvar");
  teste("Pagador: SALVAR cria o cadastro", await esperarPredicado("document.body.dataset.pagadorSalvo !== undefined") && await esperarNotificacao("Carlos Eduardo Silva"), await notificacoes());

  // ---------- 3. EMPRESA (2 etapas + telefone) ----------
  await ir("form-empresa");
  await digitarEm("#campo-razao-social", "Silca Chaves do Brasil Ltda");
  await digitarEm("#campo-cnpj", "11222333000181");
  teste("Empresa: máscara de CNPJ na digitação real", (await valor("#campo-cnpj")) === "11.222.333/0001-81", await valor("#campo-cnpj"));
  await digitarEm("#campo-representante", "Marcos Pereira");
  await clicarSel("#btn-proxima");
  teste("Empresa: PRÓXIMA ETAPA abre a etapa 2", await esperarPredicado("!document.getElementById('etapa-2').classList.contains('hidden')", 4000));
  await digitarEm("#campo-email", "vendas@silca.com.br");
  await digitarEm("#campo-logradouro", "Av. Paulista, 1000 - Bela Vista, São Paulo/SP");
  await clicarSel("#btn-add-telefone");
  await digitarEm(".linha-telefone .tel-numero", "1133334444");
  teste("Empresa: máscara de telefone na digitação real", (await valor(".linha-telefone .tel-numero")) === "(11) 3333-4444", await valor(".linha-telefone .tel-numero"));
  await digitarEm(".linha-telefone .tel-tipo", "Comercial");
  await capturar("02-form-empresa-etapa2");
  await clicarSel("#btn-salvar");
  teste("Empresa: SALVAR cria o cadastro", await esperarPredicado("document.body.dataset.empresaSalva !== undefined") && await esperarNotificacao("Silca"), await notificacoes());
  const idEmpresa = await js("document.body.dataset.empresaSalva");

  // ---------- 4. TODOS OS CADASTROS: ler, editar, excluir ----------
  await ir("todos-cadastros");
  const linhaEmpresa = linhaCom("#tabela-area", "Silca Chaves do Brasil");
  teste("Cadastros: empresa listada com CNPJ e telefone formatados",
    await js(`(() => { const tr = ${linhaEmpresa}; return !!tr && tr.textContent.includes('11.222.333/0001-81') && tr.textContent.includes('(11) 3333-4444'); })()`));
  await clicar(linhaEmpresa);
  teste("Cadastros: clicar na empresa abre a área de edição padrão", await js("!document.getElementById('editorContainer').classList.contains('hidden')") &&
    (await texto("#editorRecordName")).includes("Silca"));
  await escolher("#fieldSelect", "nomeRepresentante");
  teste("Cadastros: campo Representante carrega o valor gravado", (await valor("#newValueInput")) === "Marcos Pereira", await valor("#newValueInput"));
  await digitarEm("#newValueInput", "Marcos Pereira Junior");
  await clicarSel("#btnApplyChange");
  teste("Cadastros: editar o representante salva", await esperarNotificacao("Alterações salvas") &&
    await esperarPredicado(`(${linhaEmpresa} || {}).textContent?.includes('Marcos Pereira Junior')`, 5000));

  await clicarSel("#btn-filtro-pagadores");
  await esperar(300);
  teste("Cadastros: pagador listado com CPF formatado", await js(`!!(${linhaCom("#tabela-area", "Carlos Eduardo Silva")}) && document.getElementById('tabela-area').textContent.includes('529.982.247-25')`));

  await clicarSel("#btn-filtro-bancos");
  await esperar(300);
  const linhaBanco = linhaCom("#tabela-area", "Banco do Brasil");
  await clicar(linhaBanco);
  teste("Cadastros: banco mostra só campos de banco", await js("[...document.getElementById('fieldSelect').options].map((o) => o.value).join(',') === 'instituicao,chavePix'"));
  await escolher("#fieldSelect", "chavePix");
  await digitarEm("#newValueInput", "pix@chaveirouniversal.com.br");
  await clicarSel("#btnApplyChange");
  teste("Cadastros: editar a chave Pix do banco salva", await esperarPredicado(`(${linhaBanco} || {}).textContent?.includes('pix@chaveirouniversal.com.br')`, 6000));
  await clicar(linhaBanco);
  await clicarSel("#btn-edt-excluir");
  const tituloExcluirBanco = await responderDialogo("confirmar");
  teste("Cadastros: excluir banco pede confirmação 'EXCLUIR?' e remove", String(tituloExcluirBanco).includes("EXCLUIR") &&
    await esperarPredicado(`!(${linhaBanco})`, 6000), String(tituloExcluirBanco));

  // ---------- 5. INSERIR CONTA (2 etapas, todos os campos + PDF) ----------
  await ir("menu");
  teste("Menu → INSERIR CONTA (clique real)", await clicarSel('a[data-path="inserir-conta"]') && await esperarTela("inserir-conta"));
  await esperarPredicado("document.body.dataset.listasCarregadas === 'true'", 8000);
  const venc = dataBR(5);
  await digitarEm("#due_date", venc.digitos);
  teste("Conta: máscara de data na digitação real", (await valor("#due_date")) === venc.br, await valor("#due_date"));
  await digitarEm("#company_name", "Silca Chaves do Brasil");
  await digitarEm("#doc_number", "NF-e 14892");
  await digitarEm("#total_amount", "123456");
  teste("Conta: máscara de moeda sem 'R$' duplicado", (await valor("#total_amount")) === "1.234,56", await valor("#total_amount"));
  await clicar(`document.querySelector('input[name="in_folder"][value="sim"]').closest('label')`);
  teste("Conta: 'Sim, arquivado na pasta' marcado por clique real", await js(`document.querySelector('input[name="in_folder"][value="sim"]').checked`));
  await capturar("03-inserir-conta-etapa1");
  await clicarSel("#btn-proxima");
  teste("Conta: AVANÇAR abre a etapa 2", await esperarPredicado("!document.getElementById('step-2').classList.contains('hidden')", 4000));
  await digitarEm("#category", "Insumos (Chaves, Lâminas, Cilindros)");
  teste("Conta: categoria livre com acentos digitada", (await valor("#category")) === "Insumos (Chaves, Lâminas, Cilindros)", await valor("#category"));
  await escolher("#payment_method", "boleto");
  await escolher("#issuer_company", String(idEmpresa));
  await escolher("#payer_responsible", "Carlos Eduardo Silva");
  teste("Conta: pagador é caixa de seleção com os cadastrados", await js("document.getElementById('payer_responsible').tagName === 'SELECT'") &&
    (await valor("#payer_responsible")) === "Carlos Eduardo Silva");
  const pdf = "%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n";
  await js(`(() => { const dt = new DataTransfer(); dt.items.add(new File([${JSON.stringify(pdf)}], 'NF-e 14892.pdf', { type: 'application/pdf' }));
    const i = document.getElementById('invoice_pdf'); i.files = dt.files; i.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
  await esperarPredicado("document.getElementById('file_label').textContent.includes('14892')", 4000);
  teste("Conta: o PDF escolhido aparece em pré-visualização abaixo do anexo",
    await esperarPredicado("!document.getElementById('anexo-previa').classList.contains('hidden') && !!document.querySelector('#anexo-previa-conteudo embed') && document.getElementById('anexo-previa').offsetHeight > 100", 4000));
  await clicarSel("#btn-remover-anexo");
  teste("Conta: REMOVER (clique real) tira o arquivo e esconde a pré-visualização",
    await esperarPredicado("document.getElementById('anexo-previa').classList.contains('hidden') && document.getElementById('file_label').textContent.startsWith('ESCOLHER')", 3000));
  const fotoPrevia = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  await js(`(() => { const b = Uint8Array.from(atob(${JSON.stringify(fotoPrevia)}), (c) => c.charCodeAt(0)); const dt = new DataTransfer();
    dt.items.add(new File([b], 'foto.png', { type: 'image/png' }));
    const i = document.getElementById('invoice_pdf'); i.files = dt.files; i.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
  teste("Conta: foto escolhida aparece como imagem na pré-visualização",
    await esperarPredicado("!document.getElementById('anexo-previa').classList.contains('hidden') && !!document.querySelector('#anexo-previa-conteudo img')", 4000));
  // volta ao PDF original (o resto do teste espera a nota 14892 em PDF)
  await js(`(() => { const dt = new DataTransfer(); dt.items.add(new File([${JSON.stringify(pdf)}], 'NF-e 14892.pdf', { type: 'application/pdf' }));
    const i = document.getElementById('invoice_pdf'); i.files = dt.files; i.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
  await esperarPredicado("document.getElementById('file_label').textContent.includes('14892') && !!document.querySelector('#anexo-previa-conteudo embed')", 4000);
  await capturar("04-inserir-conta-etapa2");
  await clicarSel("#btn-salvar");
  teste("Conta: INSERIR CONTA grava e volta ao Menu", await esperarPredicado("document.body.dataset.contaSalva === 'true'", 8000) && await esperarTela("menu"));
  teste("Conta: aviso 'Conta ... salva' aparece no Menu", await esperarNotificacao("salva"), await notificacoes());
  await esperarPredicado("document.body.dataset.alertas !== undefined", 8000);
  teste("Menu: 'Mensagens do dia' mostra a conta real 'Vence em 5 dias'",
    await js(`(() => { const t = document.getElementById('alertas-corpo').textContent; return t.includes('Silca Chaves do Brasil') && t.includes('Vence em 5 dias') && t.includes('R$ 1.234,56'); })()`),
    await texto("#alertas-corpo"));
  await capturar("05-menu-com-alerta");

  // ---------- 6. TODAS AS CONTAS: ler, buscar por valor, editar, baixar PDF, pagar, imprimir ----------
  teste("Menu → CONTROLE (clique real)", await clicarSel('a[data-path="controle-de-contas"]') && await esperarTela("controle"));
  teste("CONTROLE → TODAS AS CONTAS (clique real)", await clicarSel('a[data-modulo="todas-as-contas"]') && await esperarTela("todas-as-contas"));
  const linhaConta = linhaCom("#tableBody", "Silca Chaves do Brasil");
  teste("Todas as Contas: conta listada com valor, pasta e boleto", await js(`(() => { const tr = ${linhaConta}; const t = tr ? tr.textContent : ''; return t.includes('R$ 1.234,56') && t.includes('SIM') && t.toLowerCase().includes('boleto'); })()`));
  await digitarEm("#searchInput", "1234");
  teste("Todas as Contas: busca por VALOR acha a conta", await esperarPredicado(`!!(${linhaConta}) && document.querySelectorAll('#tableBody tr.bill-row').length === 1`, 3000));
  await digitarEm("#searchInput", "xyz-nada");
  teste("Todas as Contas: busca sem resultado esvazia a lista", await esperarPredicado(`document.querySelectorAll('#tableBody tr.bill-row').length === 0`, 3000));
  await digitarEm("#searchInput", "silca");
  await clicar(linhaConta);
  teste("Todas as Contas: área de edição mostra a nota fiscal anexada", await esperarPredicado("!!document.querySelector('#notaConteudo embed')", 6000));
  teste("Todas as Contas: colunas extras escondidas até clicar em »", await js(`getComputedStyle(document.querySelector('#billsTable th.col-extra')).display === 'none'`));
  await clicarSel("#btnExpandirColunas");
  teste("Todas as Contas: » mostra as colunas extras", await js(`getComputedStyle(document.querySelector('#billsTable th.col-extra')).display !== 'none'`));
  await clicarSel("#btnExpandirColunas");
  await clicarSel("#btnBaixarAnexo");
  const notaSalva = (await esperarPredicado("!!document.body.dataset.notaSalva", 6000)) ? await js("document.body.dataset.notaSalva") : "";
  teste("Todas as Contas: BAIXAR PDF grava a nota na pasta Downloads (isolada)", notaSalva && fs.existsSync(notaSalva) && fs.readFileSync(notaSalva, "latin1").startsWith("%PDF"), notaSalva);

  // nota fiscal mostrada abaixo da edicao: clique = imprimir ou salvar; trocar e excluir
  teste("Todas as Contas: a nota em PDF aparece abaixo da edição",
    await esperarPredicado("!document.getElementById('notaVisualizacao').classList.contains('hidden') && !!document.querySelector('#notaConteudo embed')", 6000));
  await js("delete document.body.dataset.notaSalva");
  await clicarSel("#notaVisualizacao");
  const tituloNota = await responderDialogo("alternativa");
  teste("Todas as Contas: clicar na nota pergunta e SALVAR NO COMPUTADOR grava em Downloads",
    String(tituloNota).includes("NOTA FISCAL") && await esperarPredicado("!!document.body.dataset.notaSalva", 6000) &&
    fs.readFileSync(await js("document.body.dataset.notaSalva"), "latin1").startsWith("%PDF"), String(tituloNota));
  const abertosAntes = arquivosAbertos.length;
  await clicarSel("#notaVisualizacao");
  await responderDialogo("confirmar");
  teste("Todas as Contas: IMPRIMIR a nota em PDF abre o arquivo no leitor",
    await esperarNotificacao("Ctrl+P") && arquivosAbertos.length > abertosAntes, await notificacoes());
  await clicarSel("#btnExcluirNota");
  const tituloExcluirNota = await responderDialogo("confirmar");
  teste("Todas as Contas: EXCLUIR NOTA confirma e deixa a conta sem nota",
    String(tituloExcluirNota).includes("EXCLUIR") && await esperarNotificacao("Nota fiscal excluída") &&
    await esperarPredicado("!document.getElementById('notaVazia').classList.contains('hidden')", 5000),
    await texto("#notaErro"));
  const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  // a janela nativa "Abrir arquivo" (botao ANEXAR NOTA) nao e automatizavel: o arquivo entra direto no input
  teste("Todas as Contas: sem nota, aparece o quadro 'Nenhuma nota fiscal anexada' com ANEXAR NOTA FISCAL",
    (await texto("#notaVaziaTitulo")) === "Nenhuma nota fiscal anexada" &&
    await js("document.getElementById('btnAnexarNotaVazia').offsetParent !== null && document.getElementById('btnTrocarNota').classList.contains('hidden')"));
  await capturar("06a-todas-as-contas-sem-nota");
  await js(`(() => { const b = Uint8Array.from(atob(${JSON.stringify(png)}), (c) => c.charCodeAt(0)); const dt = new DataTransfer();
    dt.items.add(new File([b], 'foto nota 14892.png', { type: 'image/png' }));
    const i = document.getElementById('inputNovaNota'); i.files = dt.files; i.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
  teste("Todas as Contas: ANEXAR NOTA com foto mostra a imagem abaixo da edição",
    await esperarNotificacao("Nota fiscal anexada") && await esperarPredicado("!!document.querySelector('#notaConteudo img')", 6000),
    await texto("#notaErro"));
  await capturar("06b-todas-as-contas-nota-foto");
  await escolher("#fieldSelect", "valor");
  await digitarEm("#newValueInput", "150000");
  teste("Todas as Contas: máscara de moeda no editor", (await valor("#newValueInput")) === "1.500,00", await valor("#newValueInput"));
  await clicarSel("#btnApplyChange");
  teste("Todas as Contas: editar o valor salva", await esperarNotificacao("Alterações salvas") && await esperarPredicado(`(${linhaConta} || {}).textContent?.includes('R$ 1.500,00')`, 5000));
  await clicar(`(${linhaConta}).querySelector('.btn-mark-paid')`);
  teste("Todas as Contas: botão PAGO dá baixa", await esperarNotificacao("marcada como paga") && await esperarPredicado(`(${linhaConta} || {}).textContent?.includes('Pago')`, 5000), await notificacoes());
  await clicarSel("#btnImprimirLista");
  teste("Todas as Contas: IMPRIMIR LISTA gera o PDF do relatório", await esperarPredicado("!!document.body.dataset.relatorioPdf", 10000) &&
    fs.existsSync(await js("document.body.dataset.relatorioPdf")));
  await clicar(linhaConta);
  await clicarSel("#btnImprimirConta");
  teste("Todas as Contas: IMPRIMIR CONTA gera a ficha + nota (PDF)", await esperarPredicado("(document.body.dataset.relatorioPdf || '').includes('Conta ')", 10000) &&
    fs.existsSync(await js("document.body.dataset.relatorioPdf")));
  await capturar("06-todas-as-contas-paga");

  // ---------- 7. GRÁFICOS com a conta paga ----------
  await ir("graficos");
  await esperarPredicado("document.body.dataset.resumoCarregado === 'true'", 8000);
  teste("Gráficos: total pago do mês = R$ 1.500,00", (await texto("#kpiPago")) === "R$ 1.500,00", await texto("#kpiPago"));
  teste("Gráficos: maiores fornecedores lista a Silca", (await texto("#graficoFornecedores")).toUpperCase().includes("SILCA"));
  await clicarSel("#btn-imprimir");
  teste("Gráficos: IMPRIMIR gera o PDF", await esperarPredicado("!!document.body.dataset.relatorioPdf", 10000));
  await capturar("07-graficos");

  // ---------- 8. PAGOS: ler, editar o pagamento, desfazer ----------
  await ir("pagos");
  const linhaPago = linhaCom("#tableBody", "Silca Chaves do Brasil");
  teste("Pagos: pagamento listado", await esperarPredicado(`!!(${linhaPago})`, 5000));
  await clicar(linhaPago);
  await escolher("#fieldSelect", "valorPago");
  await digitarEm("#newValueInput", "152000");
  await clicarSel("#btnApplyChange");
  teste("Pagos: corrigir o valor pago (juros) salva", await esperarNotificacao("pagamento salvas") && await esperarPredicado(`(${linhaPago} || {}).textContent?.includes('1.520,00')`, 5000), await notificacoes());
  await clicar(linhaPago);
  await clicarSel("#btnUnpayAction");
  const tituloEstorno = await responderDialogo("confirmar");
  teste("Pagos: DESFAZER PAGAMENTO pede confirmação e remove dos pagos", String(tituloEstorno).includes("DESFAZER") &&
    await esperarNotificacao("desfeito") && await esperarPredicado(`!(${linhaPago})`, 5000), String(tituloEstorno));

  // ---------- 9. EXCLUIR a conta (Todas as Contas) ----------
  await ir("todas-as-contas");
  await clicar(linhaConta);
  await clicarSel("#btnDeleteAction");
  const tituloExcluirConta = await responderDialogo("confirmar");
  teste("Todas as Contas: excluir a conta pede 'EXCLUIR?' e remove", String(tituloExcluirConta).includes("EXCLUIR") &&
    await esperarPredicado(`!(${linhaConta})`, 6000), String(tituloExcluirConta));

  // ---------- 10. CONTA RECORRENTE (PF + débito) ----------
  await ir("form-recorrente");
  await digitarEm("#fornecedor", "Aluguel do Galpão");
  await clicar(`document.querySelector('input[name="tipo_pessoa"][value="PF"]').closest('label')`);
  await digitarEm("#valor_previsto", "250000");
  await digitarEm("#dia_vencimento", "10");
  await escolher("#formato_cobranca", "DEBITO");
  await escolher("#pagador_responsavel", "Carlos Eduardo Silva");
  teste("Recorrente: campos preenchidos (PF, 2.500,00, dia 10)", await js(`document.querySelector('input[name="tipo_pessoa"][value="PF"]').checked`) &&
    (await valor("#valor_previsto")) === "2.500,00" && (await valor("#dia_vencimento")) === "10");
  await capturar("08-form-recorrente");
  await clicarSel("#btn-salvar");
  teste("Recorrente: SALVAR cria a conta fixa", await esperarPredicado("document.body.dataset.recorrenteSalva !== undefined", 8000), await notificacoes());
  await ir("recorrentes-tabela");
  // espera a tabela carregar (contar logo apos abrir a tela dava 0 as vezes)
  const contarGeradas = `Array.from(document.querySelectorAll('#tableBody tr')).filter((tr) => tr.textContent.toUpperCase().includes('ALUGUEL DO GALPÃO')).length`;
  await esperarPredicado(`${contarGeradas} === 12`, 6000);
  const linhasGeradas = await js(contarGeradas);
  teste("Recorrentes: 12 contas geradas", linhasGeradas === 12, String(linhasGeradas));
  teste("Recorrentes: contas geradas com PF e Débito automático", await js(`(() => { const tr = ${linhaCom("#tableBody", "Aluguel do Galpão")}; return !!tr && tr.textContent.includes('PF') && tr.textContent.includes('Débito automático') && tr.textContent.includes('Carlos Eduardo Silva'); })()`));
  const linhaFixa = linhaCom("#recorrentesCadastradas", "Aluguel do Galpão");
  await clicar(`(${linhaFixa}).querySelector('button')`);
  teste("Recorrentes: GERAR PRÓXIMOS MESES não duplica (12 já existem)", await esperarNotificacao("já existem"), await notificacoes());
  await clicar(linhaCom("#tableBody", "Aluguel do Galpão"));
  await escolher("#fieldSelect", "valor");
  await digitarEm("#newValueInput", "260000");
  await clicarSel("#btnApplyChange");
  teste("Recorrentes: editar o valor de uma competência salva", await esperarNotificacao("Alterações salvas"));
  await clicar(`(${linhaFixa}).querySelectorAll('button')[1]`);
  const tituloExcluirFixa = await responderDialogo("confirmar");
  teste("Recorrentes: excluir a conta fixa remove a fixa e as 12 contas pendentes", String(tituloExcluirFixa).includes("EXCLUIR") &&
    await esperarPredicado(`!(${linhaFixa}) && !(${linhaCom("#tableBody", "Aluguel do Galpão")})`, 6000), String(tituloExcluirFixa));

  // ---------- 11. MENSAGENS: criar, ver no Menu, editar, excluir ----------
  await ir("criar-mensagem");
  await clicarSel("#btn-hoje");
  const fim = dataBR(7);
  await clicarSel("#dt_fim");
  entradaReal("digitar", { texto: fim.digitos });
  await esperar(300);
  await clicarSel("#btn-todos-dias");
  await digitarEm("#msg_titulo", "Conferir caixa");
  await digitarEm("#msg_corpo", "Conferir o caixa e o cofre antes de fechar a loja.");
  teste("Mensagem: datas, dias e textos preenchidos", Boolean(await valor("#dt_inicio")) && Boolean(await valor("#dt_fim")) &&
    (await js("document.querySelectorAll('.day-btn.is-active').length")) === 7 && (await valor("#msg_titulo")) === "Conferir caixa",
    `${await valor("#dt_inicio")} → ${await valor("#dt_fim")}`);
  await capturar("09-criar-mensagem");
  await clicarSel("#btn-salvar");
  teste("Mensagem: SALVAR cria o recado", await esperarPredicado("document.body.dataset.mensagemSalva !== undefined", 8000), await notificacoes());
  await ir("todas-as-mensagens");
  const linhaMsg = linhaCom("#tableBody", "Conferir caixa");
  teste("Mensagens: recado listado como ATIVO", await esperarPredicado(`(${linhaMsg} || {}).textContent?.includes('ATIVO')`, 5000));
  await clicar(linhaMsg);
  await escolher("#fieldSelect", "titulo");
  await digitarEm("#newValueInput", "Conferir caixa e cofre");
  await clicarSel("#btnApplyChange");
  teste("Mensagens: editar o título salva", await esperarNotificacao("Mensagem atualizada") && await esperarPredicado(`!!(${linhaCom("#tableBody", "Conferir caixa e cofre")})`, 5000));
  await ir("menu");
  await esperarPredicado("document.body.dataset.alertas !== undefined", 8000);
  teste("Menu: recado de hoje aparece em 'Recados de hoje'", (await texto("#recados-dia")).includes("Conferir caixa e cofre"), await texto("#recados-dia"));
  await clicarSel("#btn-expandir-mensagens");
  teste("Menu: EXPANDIR abre o pop-up com contas e recados", await esperarPredicado("document.body.dataset.mensagensExpandidas === 'true'", 3000) &&
    (await texto("#recados-expandidos")).includes("Conferir caixa e cofre"));
  await capturar("10-menu-mensagens-expandidas");
  await clicarSel("#btn-fechar-mensagens");
  teste("Menu: FECHAR fecha o pop-up", await esperarPredicado("document.body.dataset.mensagensExpandidas === undefined", 3000));
  await ir("todas-as-mensagens");
  await clicar(linhaCom("#tableBody", "Conferir caixa e cofre"));
  await clicarSel("#btnDeleteAction");
  const tituloExcluirMsg = await responderDialogo("confirmar");
  teste("Mensagens: excluir pede 'EXCLUIR?' e remove", String(tituloExcluirMsg).includes("EXCLUIR") &&
    await esperarPredicado(`!(${linhaCom("#tableBody", "Conferir caixa")})`, 6000));

  // ---------- 12. LIMPEZA: excluir empresa e pagador ----------
  await ir("todos-cadastros");
  await clicar(linhaCom("#tabela-area", "Silca Chaves do Brasil"));
  await clicarSel("#btn-edt-excluir");
  await responderDialogo("confirmar");
  teste("Cadastros: excluir a empresa remove", await esperarPredicado(`!(${linhaCom("#tabela-area", "Silca Chaves do Brasil")})`, 6000));
  await clicarSel("#btn-filtro-pagadores");
  await esperar(300);
  await clicar(linhaCom("#tabela-area", "Carlos Eduardo Silva"));
  await clicarSel("#btn-edt-excluir");
  await responderDialogo("confirmar");
  teste("Cadastros: excluir o pagador remove", await esperarPredicado(`!(${linhaCom("#tabela-area", "Carlos Eduardo Silva")})`, 6000));

  // ---------- isolamento ----------
  const operacional = path.join(process.env.LOCALAPPDATA || "", "ChaveiroUniversal", "ContasAPagar", "contas_a_pagar.db");
  teste("Isolamento: o teste usou SOMENTE o banco temporário", path.resolve(process.env.FINDESK_DB_PATH) !== path.resolve(operacional) && fs.existsSync(process.env.FINDESK_DB_PATH));
  teste("Isolamento: PDFs gerados só na pasta Downloads temporária", arquivosAbertos.every((a) => a.startsWith(PASTA)), JSON.stringify(arquivosAbertos));

  const falhas = resultados.filter((r) => !r.ok);
  console.log(`\nCapturas: ${CAPTURAS}`);
  console.log(`\n=== RESULTADO CRUD REAL: ${resultados.length - falhas.length}/${resultados.length} verificacoes passaram ===`);
  if (falhas.length) {
    console.log("Falhas:");
    for (const f of falhas) console.log(` - ${f.nome}`);
  }
  app.exitCode = falhas.length ? 1 : 0;
  app.quit();
}

app.on("browser-window-created", (_e, win) => {
  if (janela) return;
  janela = win;
  win.webContents.on("console-message", (...args) => {
    const nivel = typeof args[1] === "number" ? args[1] : 0;
    if (nivel >= 3) console.log("[console.error]", args[2]);
  });
  setTimeout(() => {
    executar().catch((erro) => {
      console.error("ERRO FATAL:", erro);
      app.exitCode = 1;
      app.quit();
    });
  }, 1500);
});
