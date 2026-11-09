import {
  buscarStatus,
  criarConta,
  listarEmpresas,
  ErroValidacaoApi,
  ErroDuplicidadeApi,
  ErroApi,
  ContaDados,
} from "../api";
import { confirmar } from "../componentes";
import { voltar } from "../navegacao";
import { montarNavbar } from "../navbar";
import {
  mascaraMoeda,
  mascaraData,
  paraCentavos,
  formatarMoedaBR,
  parseDataBR,
  formatarDataBR,
} from "../mascaras";

const LIMITE_ANEXO = 15 * 1024 * 1024;

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
    categoria: el<HTMLSelectElement>("category").selectedOptions[0]?.textContent?.trim() ?? "",
    formaPagamento: el<HTMLSelectElement>("payment_method").value.trim(),
    idEmpresa: el<HTMLSelectElement>("issuer_company").value.trim(),
    pagadorResponsavel: el<HTMLInputElement>("payer_responsible").value.trim(),
  };
}

let anexoSelecionado: { nome: string; base64: string } | null = null;

function validar(dados: CamposFormulario): Record<string, string> {
  const erros: Record<string, string> = {};
  const iso = parseDataBR(dados.vencimento);
  if (!iso) {
    erros.vencimento = "informe uma data valida (DD/MM/AAAA)";
  }
  const centavos = paraCentavos(dados.valor);
  if (centavos === null) {
    erros.valor = "informe o valor no formato R$ 0,00 (maior que zero)";
  }
  if (dados.nomeEmpresa.length < 2 || dados.nomeEmpresa.length > 120) {
    erros.nomeEmpresa = "informe o nome da empresa (2 a 120 caracteres)";
  }
  if (dados.numeroDocumento.length > 60) {
    erros.numeroDocumento = "o documento deve ter ate 60 caracteres";
  }
  if (!dados.formaPagamento) {
    erros.formaPagamento = "selecione o documento de cobranca";
  }
  if (!dados.pagadorResponsavel || dados.pagadorResponsavel.length > 120) {
    erros.pagadorResponsavel = "informe o pagador responsavel (1 a 120 caracteres)";
  }
  return erros;
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
    step1.classList.add("flex");
    step2.classList.add("hidden");
    step2.classList.remove("flex");
    el("step-title-text").textContent = "DADOS BÁSICOS & VENCIMENTO";
    el("step-counter-badge").textContent = "PÁGINA 1 DE 2";
    el("progress-fill").classList.remove("w-full");
    el("progress-fill").classList.add("w-1/2");
  } else {
    step1.classList.add("hidden");
    step1.classList.remove("flex");
    step2.classList.remove("hidden");
    step2.classList.add("flex");
    el("step-title-text").textContent = "CATEGORIZAÇÃO & ANEXO";
    el("step-counter-badge").textContent = "PÁGINA 2 DE 2";
    el("progress-fill").classList.remove("w-1/2");
    el("progress-fill").classList.add("w-full");
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function exibirToast(): void {
  el<HTMLElement>("toast").classList.remove("hidden");
  window.setTimeout(() => el<HTMLElement>("toast").classList.add("hidden"), 2200);
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
    valor: String(paraCentavos(dados.valor)! / 100),
    vencimento: parseDataBR(dados.vencimento)!,
    boletoNaPasta: dados.boletoNaPasta === "sim",
    anexoNome: anexoSelecionado?.nome,
    anexoPdfBase64: anexoSelecionado?.base64,
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
      const inserir = confirmar(
        "Possivel duplicidade de conta!\n\nJa existe uma conta semelhante:\n"
          + linhas.join("\n") + "\n\nDeseja inserir mesmo assim?"
      );
      if (!inserir) return;
      await enviar(true);
    }
    sujo = false;
    document.body.dataset.formSujo = "false";
    document.body.dataset.contaSalva = "true";
    exibirToast();
    console.info("[ContasAPagar] conta cadastrada via formulario");
    window.setTimeout(() => {
      void voltar();
    }, 1200);
  } catch (erro) {
    if (erro instanceof ErroValidacaoApi) {
      mostrarErros(erro.campos);
      alternarEtapa(2);
    } else if (erro instanceof ErroApi && erro.status === 409) {
      mostrarErros({ anexo: "registro vinculado a outros dados. verifique a empresa emissora" });
    } else {
      mostrarErros({ anexo: "nao foi possivel inserir a conta. tente novamente" });
      console.error("[ContasAPagar] falha ao cadastrar conta:", erro);
    }
  }
}

function verificarAnexo(arquivo: File | undefined): boolean {
  anexoSelecionado = null;
  const rotulo = el("file_label");
  if (!arquivo) {
    rotulo.textContent = "ESCOLHER ARQUIVO PDF OU ARRASTAR AQUI";
    return true;
  }
  if (arquivo.size > LIMITE_ANEXO) {
    mostrarErros({ anexo: "o anexo deve ter no maximo 15MB" });
    return false;
  }
  if (!arquivo.name.toLowerCase().endsWith(".pdf") && arquivo.type !== "application/pdf") {
    mostrarErros({ anexo: "o anexo deve ser um arquivo PDF" });
    return false;
  }
  rotulo.textContent = arquivo.name.toUpperCase();
  return true;
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
    const arquivo = evento.dataTransfer?.files[0];
    if (verificarAnexo(arquivo) && arquivo) {
      arquivo.arrayBuffer().then((buf) => {
        let binario = "";
        new Uint8Array(buf).forEach((b) => (binario += String.fromCharCode(b)));
        anexoSelecionado = { nome: arquivo.name, base64: btoa(binario) };
      });
    }
    marcarSujo();
  });
  inputAnexo.addEventListener("change", () => {
    const arquivo = inputAnexo.files?.[0];
    if (verificarAnexo(arquivo) && arquivo) {
      arquivo.arrayBuffer().then((buf) => {
        let binario = "";
        new Uint8Array(buf).forEach((b) => (binario += String.fromCharCode(b)));
        anexoSelecionado = { nome: arquivo.name, base64: btoa(binario) };
      });
    }
    marcarSujo();
  });

  el<HTMLFormElement>("form-conta").addEventListener("input", marcarSujo);
  el("btn-proxima").addEventListener("click", () => {
    const erros = validar(lerCampos());
    mostrarErros(erros);
    if (erros.vencimento || erros.valor || erros.nomeEmpresa) return;
    alternarEtapa(2);
  });
  el("btn-voltar-etapa").addEventListener("click", () => alternarEtapa(1));
  el<HTMLFormElement>("form-conta").addEventListener("submit", (evento) => {
    evento.preventDefault();
    void submeter();
  });
  el("btn-cancelar").addEventListener("click", () => {
    if (sujo && !confirmar("Ha alteracoes nao salvas. Deseja sair mesmo assim?")) return;
    void voltar();
  });

  document.addEventListener("keydown", (evento) => {
    if (evento.key === "F10") {
      evento.preventDefault();
      void submeter();
    }
    if (evento.key !== "Escape" || !sujo) return;
    if (!confirmar("Ha alteracoes nao salvas. Deseja sair mesmo assim?")) {
      evento.preventDefault();
      evento.stopPropagation();
    }
  });

  document.addEventListener(
    "click",
    (evento) => {
      const alvo = (evento.target as HTMLElement).closest<HTMLElement>("[data-nav]");
      if (!alvo || !sujo) return;
      if (!confirmar("Ha alteracoes nao salvas. Deseja sair mesmo assim?")) {
        evento.preventDefault();
        evento.stopPropagation();
      }
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
