import {
  buscarStatus,
  criarConta,
  listarContas,
  listarEmpresas,
  ErroValidacaoApi,
  ErroDuplicidadeApi,
  ErroApi,
  ContaDados,
} from "../api";
import { confirmarDuplicidade, confirmarSaida, dialogoEstaAberto, menuLateralAberto } from "../componentes";
import { notificarAoAbrir } from "../notificacoes";
import { voltar } from "../navegacao";
import { montarNavbar } from "../navbar";
import { preencherSelectPagadores } from "../pagadores";
import { montarPreviaNota } from "../nota-previa";
import {
  mascaraMoeda,
  mascaraData,
  paraCentavos,
  formatarMoedaBR,
  parseDataBR,
  formatarDataBR,
} from "../mascaras";

// nota fiscal: PDF, foto ou Word .docx ate 10 MB. O backend confere de novo
// pelo conteudo (assinatura do arquivo), sem confiar na extensao.
const LIMITE_ANEXO = 10 * 1024 * 1024;
const EXTENSOES_ANEXO = [".pdf", ".jpg", ".jpeg", ".png", ".webp", ".docx"];

interface CamposFormulario {
  vencimento: string;
  tipoPessoa: string;
  nomeEmpresa: string;
  numeroDocumento: string;
  valor: string;
  boletoNaPasta: string;
  categoria: string;
  formaPagamento: string;
  idEmpresa: string;
  pagadorResponsavel: string;
}

function el<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

function lerCampos(): CamposFormulario {
  const tipo = document.querySelector<HTMLInputElement>('input[name="account_type"]:checked');
  const pasta = document.querySelector<HTMLInputElement>('input[name="in_folder"]:checked');
  return {
    vencimento: el<HTMLInputElement>("due_date").value.trim(),
    tipoPessoa: tipo ? tipo.value : "PJ",
    nomeEmpresa: el<HTMLInputElement>("company_name").value.trim(),
    numeroDocumento: el<HTMLInputElement>("doc_number").value.trim(),
    valor: el<HTMLInputElement>("total_amount").value.trim(),
    boletoNaPasta: pasta ? pasta.value : "nao",
    categoria: el<HTMLInputElement>("category").value.trim(),
    formaPagamento: el<HTMLSelectElement>("payment_method").value.trim(),
    idEmpresa: el<HTMLSelectElement>("issuer_company").value.trim(),
    pagadorResponsavel: el<HTMLSelectElement>("payer_responsible").value.trim(),
  };
}

function preencherSugestoes(idLista: string, valores: string[]): void {
  const lista = document.getElementById(idLista);
  if (!lista) return;
  const existentes = new Set([...lista.querySelectorAll("option")].map((o) => o.value.toLowerCase()));
  for (const valor of valores) {
    const v = valor.trim();
    if (!v || existentes.has(v.toLowerCase())) continue;
    existentes.add(v.toLowerCase());
    const opcao = document.createElement("option");
    opcao.value = v;
    lista.appendChild(opcao);
  }
}

let anexoSelecionado: { nome: string; base64: string } | null = null;

function validar(dados: CamposFormulario): Record<string, string> {
  const erros: Record<string, string> = {};
  const iso = parseDataBR(dados.vencimento);
  if (!iso) {
    erros.vencimento = "Informe uma data válida (DD/MM/AAAA).";
  }
  const centavos = paraCentavos(dados.valor);
  if (centavos === null) {
    erros.valor = "Informe o valor (maior que zero). Exemplo: 150,00.";
  }
  if (dados.nomeEmpresa.length < 2 || dados.nomeEmpresa.length > 120) {
    erros.nomeEmpresa = "Informe o nome da empresa (de 2 a 120 caracteres).";
  }
  if (dados.numeroDocumento.length > 60) {
    erros.numeroDocumento = "O número do documento deve ter até 60 caracteres.";
  }
  if (!dados.formaPagamento) {
    erros.formaPagamento = "Selecione o documento de cobrança.";
  }
  if (!dados.pagadorResponsavel || dados.pagadorResponsavel.length > 120) {
    erros.pagadorResponsavel = "Selecione o pagador responsável.";
  }
  if (!anexoSelecionado && !el<HTMLInputElement>("sem_nota").checked) {
    erros.anexo = "Anexe a nota fiscal ou marque \"Conta sem nota fiscal\".";
  }
  return erros;
}

const ETAPA1 = ["vencimento", "valor", "nomeEmpresa", "numeroDocumento"];

/** Some com o erro de um campo assim que ele passa a ser valido (sem esperar o SALVAR). */
function revalidarErrosVisiveis(): void {
  const atuais = validar(lerCampos());
  document.querySelectorAll<HTMLElement>(".campo-erro:not(.hidden)").forEach((elErro) => {
    const nome = elErro.dataset.erroCampo ?? "";
    if (!atuais[nome]) {
      elErro.textContent = "";
      elErro.classList.add("hidden");
    }
  });
}

function mostrarErros(erros: Record<string, string>): void {
  document.querySelectorAll<HTMLElement>(".campo-erro").forEach((elErro) => {
    const nome = elErro.dataset.erroCampo ?? "";
    const mensagem = erros[nome];
    elErro.textContent = mensagem ?? "";
    elErro.classList.toggle("hidden", !mensagem);
  });
}

function alternarEtapa(etapa: 1 | 2): void {
  const step1 = el<HTMLElement>("step-1");
  const step2 = el<HTMLElement>("step-2");
  if (etapa === 1) {
    step1.classList.remove("hidden");
    step2.classList.add("hidden");
    el("step-title-text").textContent = "DADOS BÁSICOS & VENCIMENTO";
    el("step-counter-badge").textContent = "PÁGINA 1 DE 2";
    el("progress-fill").classList.remove("w-full");
    el("progress-fill").classList.add("w-1/2");
  } else {
    step1.classList.add("hidden");
    step2.classList.remove("hidden");
    el("step-title-text").textContent = "CATEGORIZAÇÃO & ANEXO";
    el("step-counter-badge").textContent = "PÁGINA 2 DE 2";
    el("progress-fill").classList.remove("w-1/2");
    el("progress-fill").classList.add("w-full");
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function montarPayload(forcar: boolean) {
  const dados = lerCampos();
  return {
    nomeEmpresa: dados.nomeEmpresa,
    idEmpresa: dados.idEmpresa ? Number(dados.idEmpresa) : undefined,
    pagadorResponsavel: dados.pagadorResponsavel,
    tipoPessoa: dados.tipoPessoa,
    formaPagamento: dados.formaPagamento,
    categoria: dados.categoria && dados.categoria !== "Selecione a categoria..." ? dados.categoria : undefined,
    numeroDocumento: dados.numeroDocumento || undefined,
    valor: (paraCentavos(dados.valor)! / 100).toFixed(2),
    vencimento: parseDataBR(dados.vencimento)!,
    boletoNaPasta: dados.boletoNaPasta === "sim",
    anexoNome: anexoSelecionado?.nome,
    anexoPdfBase64: anexoSelecionado?.base64,
    semNotaFiscal: !anexoSelecionado && el<HTMLInputElement>("sem_nota").checked,
    forcar,
  };
}

let sujo = false;

function marcarSujo(): void {
  sujo = true;
  document.body.dataset.formSujo = "true";
}

async function enviar(forcar: boolean): Promise<ContaDados> {
  return criarConta(await window.finDesk!.config(), montarPayload(forcar));
}

async function submeter(): Promise<void> {
  const erros = validar(lerCampos());
  mostrarErros(erros);
  if (Object.keys(erros).length > 0) {
    alternarEtapa(erros.valor || erros.vencimento || erros.nomeEmpresa ? 1 : 2);
    return;
  }
  try {
    try {
      await enviar(false);
    } catch (erro) {
      if (!(erro instanceof ErroDuplicidadeApi)) throw erro;
      const e = erro.existente;
      const linhas = [
        `Empresa: ${e.nomeEmpresa}`,
        `Vencimento: ${formatarDataBR(e.vencimento)}`,
        `Valor: ${formatarMoedaBR(Math.round(e.valor * 100))}`,
      ];
      if (e.numeroDocumento) linhas.push(`Documento: ${e.numeroDocumento}`);
      const inserir = await confirmarDuplicidade(linhas.join("\n"));
      if (!inserir) return;
      await enviar(true);
    }
    sujo = false;
    document.body.dataset.formSujo = "false";
    document.body.dataset.contaSalva = "true";
    // a tela volta sozinha; o aviso de sucesso aparece na tela seguinte
    notificarAoAbrir(`Conta de "${lerCampos().nomeEmpresa}" salva.`);
    console.info("[ContasAPagar] conta cadastrada via formulario");
    // pausa curta: o botao mostra que salvou antes de a tela trocar
    window.setTimeout(() => {
      void voltar();
    }, 600);
  } catch (erro) {
    if (erro instanceof ErroValidacaoApi) {
      mostrarErros(erro.campos);
      alternarEtapa(2);
    } else if (erro instanceof ErroApi && erro.status === 409) {
      mostrarErros({ anexo: "Não foi possível salvar: confira a empresa emissora escolhida." });
    } else {
      mostrarErros({ anexo: "Não foi possível salvar a conta. Verifique se o sistema está aberto e tente de novo." });
      console.error("[ContasAPagar] falha ao cadastrar conta:", erro);
    }
  }
}

/** Assinatura (primeiros bytes) dos formatos aceitos. */
function assinaturaAceita(b: Uint8Array): boolean {
  const ini = (...x: number[]): boolean => x.every((v, k) => b[k] === v);
  return ini(0x25, 0x50, 0x44, 0x46) // %PDF
    || ini(0xff, 0xd8, 0xff) // JPG
    || ini(0x89, 0x50, 0x4e, 0x47) // PNG
    || (ini(0x52, 0x49, 0x46, 0x46) && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) // WEBP
    || ini(0x50, 0x4b, 0x03, 0x04); // DOCX (zip)
}

let liberarPrevia: (() => void) | null = null;

function limparAnexo(): void {
  anexoSelecionado = null;
  el("file_label").textContent = "ESCOLHER ARQUIVO OU ARRASTAR AQUI";
  el<HTMLInputElement>("invoice_pdf").value = "";
  liberarPrevia?.();
  liberarPrevia = null;
  el("anexo-previa").classList.add("hidden");
}

async function receberAnexo(arquivo: File | undefined): Promise<void> {
  limparAnexo();
  if (!arquivo) return;
  const nome = arquivo.name.toLowerCase();
  if (!EXTENSOES_ANEXO.some((ext) => nome.endsWith(ext))) {
    mostrarErros({ anexo: "Formato não aceito. Envie PDF, foto (JPG, PNG ou WEBP) ou Word (.docx)." });
    return;
  }
  if (arquivo.size === 0 || arquivo.size > LIMITE_ANEXO) {
    mostrarErros({ anexo: "O arquivo deve ter no máximo 10 MB." });
    return;
  }
  const bytes = new Uint8Array(await arquivo.arrayBuffer());
  if (!assinaturaAceita(bytes)) {
    mostrarErros({ anexo: "O conteúdo do arquivo não corresponde a um PDF, foto ou Word válido." });
    return;
  }
  let binario = "";
  for (let k = 0; k < bytes.length; k += 0x8000) {
    binario += String.fromCharCode(...bytes.subarray(k, k + 0x8000));
  }
  anexoSelecionado = { nome: arquivo.name, base64: btoa(binario) };
  el("file_label").textContent = arquivo.name.toUpperCase();
  // previa logo abaixo: foto, PDF ou cartao do Word
  liberarPrevia = montarPreviaNota(el("anexo-previa-conteudo"), arquivo.name, bytes,
    "Arquivo do Word: não dá para mostrar aqui, mas ele será guardado com a conta.");
  el("anexo-previa").classList.remove("hidden");
  el<HTMLInputElement>("sem_nota").checked = false;
  revalidarErrosVisiveis();
}

async function verificarApi(): Promise<void> {
  try {
    if (!window.finDesk) throw new Error("configuracao indisponivel");
    const cfg = await window.finDesk.config();
    await buscarStatus(cfg);
    document.body.dataset.apiStatus = "ok";
  } catch {
    document.body.dataset.apiStatus = "erro";
  }
}

async function carregarEmissoras(): Promise<void> {
  try {
    const cfg = await window.finDesk!.config();
    const empresas = await listarEmpresas(cfg);
    // pagadores: caixa de selecao; categorias: sugestoes das ja usadas (texto livre)
    const contasExistentes = await listarContas(cfg);
    await preencherSelectPagadores(el<HTMLSelectElement>("payer_responsible"), "Selecione o pagador...");
    preencherSugestoes("lista-categorias", contasExistentes.map((c) => c.categoria ?? ""));
    const sel = el<HTMLSelectElement>("issuer_company");
    for (const empresa of empresas) {
      const opcao = document.createElement("option");
      opcao.value = String(empresa.id);
      opcao.textContent = empresa.razaoSocial;
      sel.appendChild(opcao);
    }
    document.body.dataset.listasCarregadas = "true";
  } catch (erro) {
    console.error("[ContasAPagar] falha ao carregar empresas emissoras:", erro);
    document.body.dataset.listasCarregadas = "erro";
  }
}

function iniciar(): void {
  montarNavbar("inserir-conta");

  mascaraData(el<HTMLInputElement>("due_date"));
  mascaraMoeda(el<HTMLInputElement>("total_amount"));

  const hoje = new Date();
  el<HTMLInputElement>("due_date").value =
    formatarDataBR(`${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`);

  el("btn-calendario").addEventListener("click", () => {
    const picker = el<HTMLInputElement>("native_date_picker");
    if (typeof picker.showPicker === "function") {
      picker.showPicker();
    } else {
      picker.click();
    }
  });
  el<HTMLInputElement>("native_date_picker").addEventListener("change", () => {
    const iso = el<HTMLInputElement>("native_date_picker").value;
    if (iso) el<HTMLInputElement>("due_date").value = formatarDataBR(iso);
    marcarSujo();
  });

  const areaAnexo = el("anexo-area");
  const inputAnexo = el<HTMLInputElement>("invoice_pdf");
  areaAnexo.addEventListener("click", () => inputAnexo.click());
  areaAnexo.addEventListener("dragover", (evento) => evento.preventDefault());
  areaAnexo.addEventListener("drop", (evento) => {
    evento.preventDefault();
    void receberAnexo(evento.dataTransfer?.files[0]);
    marcarSujo();
  });
  inputAnexo.addEventListener("change", () => {
    void receberAnexo(inputAnexo.files?.[0]);
    marcarSujo();
  });
  el("btn-remover-anexo").addEventListener("click", () => {
    limparAnexo();
    marcarSujo();
    revalidarErrosVisiveis();
  });
  // "veio sem nota" e anexo sao excludentes
  el<HTMLInputElement>("sem_nota").addEventListener("change", () => {
    if (el<HTMLInputElement>("sem_nota").checked) limparAnexo();
  });

  el<HTMLFormElement>("form-conta").addEventListener("input", marcarSujo);
  el<HTMLFormElement>("form-conta").addEventListener("input", revalidarErrosVisiveis);
  el<HTMLFormElement>("form-conta").addEventListener("change", revalidarErrosVisiveis);
  el("btn-proxima").addEventListener("click", () => {
    // so os erros da ETAPA 1: os campos da etapa 2 ainda nem foram mostrados ao usuario
    const todos = validar(lerCampos());
    const daEtapa1 = Object.fromEntries(Object.entries(todos).filter(([c]) => ETAPA1.includes(c)));
    mostrarErros(daEtapa1);
    if (Object.keys(daEtapa1).length) return;
    alternarEtapa(2);
  });
  el("btn-voltar-etapa").addEventListener("click", () => alternarEtapa(1));
  el<HTMLFormElement>("form-conta").addEventListener("submit", (evento) => {
    evento.preventDefault();
    void submeter();
  });
  el("btn-cancelar").addEventListener("click", () => {
    void (async () => {
      if (sujo && !(await confirmarSaida())) return;
      void voltar();
    })();
  });

  document.addEventListener("keydown", (evento) => {
    if (dialogoEstaAberto() || menuLateralAberto()) return;
    if (evento.key === "F10") {
      evento.preventDefault();
      void submeter();
    }
    if (evento.key !== "Escape" || !sujo) return;
    evento.preventDefault();
    evento.stopPropagation();
    void confirmarSaida().then((ok) => {
      if (ok) void voltar();
    });
  }, true);

  let navegacaoConfirmada = false;
  document.addEventListener(
    "click",
    (evento) => {
      const alvo = (evento.target as HTMLElement).closest<HTMLElement>("[data-nav]");
      if (!alvo || !sujo || navegacaoConfirmada || dialogoEstaAberto()) return;
      evento.preventDefault();
      evento.stopPropagation();
      navegacaoConfirmada = true;
      void confirmarSaida().then((ok) => {
        if (ok) alvo.click();
        navegacaoConfirmada = false;
      });
    },
    true
  );

  void verificarApi();
  void carregarEmissoras();
  console.info("[ContasAPagar] formulario de inserir conta iniciado (design Stitch)");
}

export function iniciarInserirConta(): void {
  iniciar();
}
