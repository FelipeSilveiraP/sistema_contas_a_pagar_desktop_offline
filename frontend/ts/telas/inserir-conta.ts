import {
  buscarStatus,
  criarConta,
  listarContas,
  listarEmpresas,
  listarPagadores,
  ErroValidacaoApi,
  ErroDuplicidadeApi,
  ErroApi,
  ContaDados,
} from "../api";
import { confirmar } from "../componentes";
import { voltar } from "../navegacao";
import { montarNavbar } from "../navbar";

interface CamposFormulario {
  valor: string;
  vencimento: string;
  idEmpresa: string;
  categoria: string;
  numeroDocumento: string;
  idPagador: string;
  boletoNaPasta: string;
}

const ID_CAMPOS: Record<keyof CamposFormulario, string> = {
  valor: "campo-valor",
  vencimento: "campo-vencimento",
  idEmpresa: "campo-fornecedor",
  categoria: "campo-categoria",
  numeroDocumento: "campo-documento",
  idPagador: "campo-pagador",
  boletoNaPasta: "campo-pasta",
};

function campo(nome: keyof CamposFormulario): HTMLInputElement {
  return document.getElementById(ID_CAMPOS[nome]) as HTMLInputElement;
}

function lerCampos(): CamposFormulario {
  return {
    valor: campo("valor").value.trim(),
    vencimento: campo("vencimento").value.trim(),
    idEmpresa: campo("idEmpresa").value.trim(),
    categoria: campo("categoria").value.trim(),
    numeroDocumento: campo("numeroDocumento").value.trim(),
    idPagador: campo("idPagador").value.trim(),
    boletoNaPasta: campo("boletoNaPasta").value.trim(),
  };
}

// Formato monetario BR: virgula como decimal; ponto como milhar (ou decimal
// quando nao ha virgula). Retorna a string normalizada "1234.56" (exata) ou null.
export function parseValor(entrada: string): string | null {
  const limpo = entrada.trim();
  let normalizado: string;
  if (limpo.includes(",")) {
    if (!/^(\d{1,3}(\.\d{3})*|\d+),\d{1,2}$/.test(limpo)) return null;
    normalizado = limpo.replace(/\./g, "").replace(",", ".");
  } else {
    if (!/^\d{1,12}(\.\d{1,2})?$/.test(limpo)) return null;
    normalizado = limpo;
  }
  if (Number(normalizado) <= 0) return null;
  return normalizado;
}

function validar(dados: CamposFormulario): Record<string, string> {
  const erros: Record<string, string> = {};
  if (!parseValor(dados.valor)) {
    erros.valor = "informe o valor no formato 0,00 (maior que zero)";
  }
  if (!dados.vencimento) {
    erros.vencimento = "informe a data de vencimento";
  }
  if (!dados.idEmpresa) {
    erros.idEmpresa = "informe o fornecedor (empresa cadastrada)";
  }
  return erros;
}

function mostrarErros(erros: Record<string, string>): void {
  document.querySelectorAll<HTMLElement>(".campo-erro").forEach((el) => {
    const nome = el.dataset.erroCampo ?? "";
    const mensagem = erros[nome];
    el.textContent = mensagem ?? "";
    el.classList.toggle("hidden", !mensagem);
    campo(nome as keyof CamposFormulario)?.classList.toggle("border-[#b6212a]", Boolean(mensagem));
  });
}

function mostrarFeedback(mensagem: string, sucesso: boolean): void {
  const feedback = document.getElementById("feedback-conta");
  if (!feedback) return;
  feedback.textContent = mensagem;
  feedback.classList.remove("hidden");
  feedback.classList.toggle("text-[#006c46]", sucesso);
  feedback.classList.toggle("text-[#b6212a]", !sucesso);
}

function alternarEtapa(etapa: 1 | 2): void {
  document.getElementById("etapa-1")!.classList.toggle("hidden", etapa !== 1);
  document.getElementById("etapa-2")!.classList.toggle("hidden", etapa !== 2);
  document.getElementById("etapa-2")!.classList.toggle("grid", etapa === 2);
  document.getElementById("btn-proxima")!.classList.toggle("hidden", etapa !== 1);
  document.getElementById("btn-salvar")!.classList.toggle("hidden", etapa !== 2);
  document.getElementById("btn-voltar-etapa")!.classList.toggle("hidden", etapa !== 2);
  document.getElementById("etapa-rotulo")!.textContent =
    etapa === 1 ? "Etapa 1 de 2 — Valor e vencimento" : "Etapa 2 de 2 — Fornecedor e documento";
}

function preencherSelecoes(empresas: { id: number; razaoSocial: string }[],
                           pagadores: { id: number; nome: string }[]): void {
  const selFornecedor = document.getElementById("campo-fornecedor") as HTMLSelectElement;
  for (const empresa of empresas) {
    const opcao = document.createElement("option");
    opcao.value = String(empresa.id);
    opcao.textContent = empresa.razaoSocial;
    selFornecedor.appendChild(opcao);
  }
  const selPagador = document.getElementById("campo-pagador") as HTMLSelectElement;
  for (const pagador of pagadores) {
    const opcao = document.createElement("option");
    opcao.value = String(pagador.id);
    opcao.textContent = pagador.nome;
    selPagador.appendChild(opcao);
  }
}

function preencherCategorias(contas: ContaDados[]): void {
  const lista = document.getElementById("lista-categorias")!;
  const usadas = [...new Set(contas.map((c) => c.categoria).filter((c): c is string => Boolean(c)))].sort();
  for (const categoria of usadas) {
    const opcao = document.createElement("option");
    opcao.value = categoria;
    lista.appendChild(opcao);
  }
}

function descreverDuplicata(existente: ContaDados): string {
  const linhas = [
    `Fornecedor: ${existente.razaoSocial}`,
    `Vencimento: ${existente.vencimento}`,
    `Valor: R$ ${existente.valor.toFixed(2).replace(".", ",")}`,
  ];
  if (existente.numeroDocumento) linhas.push(`Documento: ${existente.numeroDocumento}`);
  return linhas.join("\n");
}

async function enviar(forcar: boolean): Promise<ContaDados> {
  const dados = lerCampos();
  return criarConta(await window.finDesk!.config(), {
    idEmpresa: Number(dados.idEmpresa),
    idPagador: dados.idPagador ? Number(dados.idPagador) : undefined,
    categoria: dados.categoria || undefined,
    numeroDocumento: dados.numeroDocumento || undefined,
    valor: parseValor(dados.valor)!,
    vencimento: dados.vencimento,
    boletoNaPasta: dados.boletoNaPasta === "true",
    forcar,
  });
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

async function carregarListas(): Promise<void> {
  try {
    const cfg = await window.finDesk!.config();
    const [empresas, pagadores, contas] = await Promise.all([
      listarEmpresas(cfg),
      listarPagadores(cfg),
      listarContas(cfg),
    ]);
    preencherSelecoes(empresas, pagadores);
    preencherCategorias(contas);
    document.body.dataset.listasCarregadas = "true";
  } catch (erro) {
    console.error("[ContasAPagar] falha ao carregar listas do formulario de conta:", erro);
    mostrarFeedback("Nao foi possivel carregar fornecedores/pagadores. Tente novamente.", false);
    document.body.dataset.listasCarregadas = "erro";
  }
}

function iniciar(): void {
  montarNavbar("inserir-conta");
  const formulario = document.getElementById("form-conta") as HTMLFormElement;
  let sujo = false;

  const marcarSujo = () => {
    sujo = true;
    document.body.dataset.formSujo = "true";
  };
  formulario.addEventListener("input", marcarSujo);

  document.getElementById("btn-proxima")!.addEventListener("click", () => {
    const erros = validar(lerCampos());
    mostrarErros(erros);
    if (erros.valor || erros.vencimento) {
      mostrarFeedback("Corrija os campos destacados.", false);
      return;
    }
    mostrarFeedback("", true);
    alternarEtapa(2);
  });

  document.getElementById("btn-voltar-etapa")!.addEventListener("click", () => alternarEtapa(1));

  formulario.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const erros = validar(lerCampos());
    mostrarErros(erros);
    if (Object.keys(erros).length > 0) {
      mostrarFeedback("Corrija os campos destacados.", false);
      return;
    }
    try {
      let criada: ContaDados;
      try {
        criada = await enviar(false);
      } catch (erro) {
        if (!(erro instanceof ErroDuplicidadeApi)) throw erro;
        const inserirMesmo = confirmar(
          "Possivel duplicidade de conta!\n\nJa existe uma conta semelhante:\n"
            + descreverDuplicata(erro.existente)
            + "\n\nDeseja inserir mesmo assim?"
        );
        if (!inserirMesmo) {
          mostrarFeedback("Inclusao cancelada (possivel duplicidade identificada).", false);
          return;
        }
        criada = await enviar(true);
      }
      sujo = false;
      document.body.dataset.formSujo = "false";
      formulario.reset();
      mostrarErros({});
      alternarEtapa(1);
      mostrarFeedback(`Conta de "${criada.razaoSocial}" inserida com sucesso.`, true);
      document.body.dataset.contaSalva = String(criada.id);
      console.info("[ContasAPagar] conta cadastrada via formulario (id:", criada.id, ")");
    } catch (erro) {
      if (erro instanceof ErroValidacaoApi) {
        mostrarErros(erro.campos);
        mostrarFeedback("Corrija os campos destacados.", false);
      } else if (erro instanceof ErroApi && erro.status === 409) {
        mostrarFeedback("Registro vinculado a outros dados. Verifique o fornecedor informado.", false);
      } else {
        mostrarFeedback("Nao foi possivel inserir a conta. Tente novamente.", false);
        console.error("[ContasAPagar] falha ao cadastrar conta:", erro);
      }
    }
  });

  document.getElementById("btn-cancelar")?.addEventListener("click", () => {
    if (sujo && !confirmar("Ha alteracoes nao salvas. Deseja sair mesmo assim?")) return;
    void voltar();
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

  document.addEventListener(
    "keydown",
    (evento) => {
      if (evento.key !== "Escape" || !sujo) return;
      if (!confirmar("Ha alteracoes nao salvas. Deseja sair mesmo assim?")) {
        evento.preventDefault();
        evento.stopPropagation();
      }
    },
    true
  );

  void verificarApi();
  void carregarListas();
  console.info("[ContasAPagar] formulario de inserir conta iniciado");
}

export function iniciarInserirConta(): void {
  iniciar();
}
