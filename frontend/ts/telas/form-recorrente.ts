import { buscarStatus, criarRecorrente, ErroValidacaoApi, ErroApi } from "../api";
import { confirmar, dialogoEstaAberto, menuLateralAberto } from "../componentes";
import { voltar } from "../navegacao";
import { montarNavbar } from "../navbar";
import { mascaraDia, mascaraMoeda, paraCentavos } from "../mascaras";

const MAPA_FORMATO: Record<string, string> = {
  BOLETO: "boleto", PIX: "pix", CARTAO: "cartao", DEBITO: "transferencia",
};

function el<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

let sujo = false;

function lerCampos() {
  const tipo = document.querySelector<HTMLInputElement>('input[name="tipo_pessoa"]:checked');
  const periodicidade = document.querySelector<HTMLInputElement>('input[name="periodicidade"]:checked');
  return {
    fornecedor: el<HTMLInputElement>("fornecedor").value.trim(),
    tipoPessoa: tipo ? tipo.value : "PJ",
    valor: el<HTMLInputElement>("valor_previsto").value.trim(),
    dia: Number(el<HTMLInputElement>("dia_vencimento").value),
    periodicidade: periodicidade ? periodicidade.value : "MENSAL",
    formato: el<HTMLSelectElement>("formato_cobranca").value,
  };
}

function validar(): Record<string, string> {
  const dados = lerCampos();
  const erros: Record<string, string> = {};
  if (dados.fornecedor.length < 2 || dados.fornecedor.length > 120) {
    erros.nomeEmpresa = "informe o fornecedor (2 a 120 caracteres)";
  }
  if (paraCentavos(dados.valor) === null) {
    erros.valor = "informe o valor no formato R$ 0,00 (maior que zero)";
  }
  if (!Number.isInteger(dados.dia) || dados.dia < 1 || dados.dia > 31) {
    erros.dia = "informe o dia de vencimento (1 a 31)";
  }
  return erros;
}

function mostrarErros(erros: Record<string, string>): void {
  document.querySelectorAll<HTMLElement>(".campo-erro").forEach ( (elErro) => {
    const nome = elErro.dataset.erroCampo ?? "";
    const mensagem = erros[nome];
    elErro.textContent = mensagem ?? "";
    elErro.classList.toggle("hidden", !mensagem);
  });
}

function mostrarFeedback(mensagem: string, sucesso: boolean): void {
  const feedback = el("feedback-recorrente");
  feedback.textContent = mensagem;
  feedback.classList.remove("hidden");
  feedback.classList.toggle("text-[#006c46]", sucesso);
  feedback.classList.toggle("text-[#ba1a1a]", !sucesso);
}

async function submeter(): Promise<void> {
  const erros = validar();
  mostrarErros(erros);
  if (Object.keys(erros).length > 0) {
    mostrarFeedback("Corrija os campos destacados.", false);
    return;
  }
  const dados = lerCampos();
  try {
    const cfg = await window.finDesk!.config();
    const criada = await criarRecorrente(cfg, {
      nomeEmpresa: dados.fornecedor,
      idEmpresa: null,
      pagadorResponsavel: "NÃO INFORMADO",
      categoria: null,
      numeroDocumento: null,
      valor: paraCentavos(dados.valor)! / 100,
      dia: dados.dia,
      periodicidade: dados.periodicidade,
      formaPagamento: MAPA_FORMATO[dados.formato],
      ativo: true,
    });
    sujo = false;
    document.body.dataset.formSujo = "false";
    document.body.dataset.recorrenteSalva = String(criada.id);
    mostrarFeedback(`Recorrência de "${criada.nomeEmpresa}" cadastrada — contas fixas geradas.`, true);
    console.info("[ContasAPagar] recorrencia cadastrada (id:", criada.id, ")");
    window.setTimeout(() => {
      void voltar();
    }, 1200);
  } catch (erro) {
    if (erro instanceof ErroValidacaoApi) {
      mostrarErros(erro.campos);
      mostrarFeedback("Corrija os campos destacados.", false);
    } else if (erro instanceof ErroApi) {
      mostrarFeedback("Nao foi possivel salvar a recorrencia. Tente novamente.", false);
    } else {
      mostrarFeedback("Nao foi possivel salvar a recorrencia. Tente novamente.", false);
      console.error("[ContasAPagar] falha ao cadastrar recorrencia:", erro);
    }
  }
}

async function verificarApi(): Promise<void> {
  try {
    const cfg = await window.finDesk!.config();
    await buscarStatus(cfg);
    document.body.dataset.apiStatus = "ok";
  } catch {
    document.body.dataset.apiStatus = "erro";
  }
}

function iniciar(): void {
  montarNavbar("form-recorrente");
  mascaraMoeda(el<HTMLInputElement>("valor_previsto"));
  mascaraDia(el<HTMLInputElement>("dia_vencimento"));

  el<HTMLFormElement>("recorrente-form").addEventListener("input", () => {
    sujo = true;
    document.body.dataset.formSujo = "true";
  });
  el<HTMLFormElement>("recorrente-form").addEventListener("submit", (evento) => {
    evento.preventDefault();
    void submeter();
  });
  el("btn-cancelar").addEventListener("click", () => {
    void (async () => {
      if (sujo && !(await confirmar("Ha alteracoes nao salvas. Deseja sair mesmo assim?"))) return;
      void voltar();
    })();
  });

  document.addEventListener("keydown", (evento) => {
    if (evento.key !== "Escape" || !sujo || dialogoEstaAberto() || menuLateralAberto()) return;
    evento.preventDefault();
    evento.stopPropagation();
    void confirmar("Ha alteracoes nao salvas. Deseja sair mesmo assim?").then((ok) => {
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
      void confirmar("Ha alteracoes nao salvas. Deseja sair mesmo assim?").then((ok) => {
        if (ok) alvo.click();
        navegacaoConfirmada = false;
      });
    },
    true
  );

  void verificarApi();
  console.info("[ContasAPagar] formulario de recorrencia iniciado (design Stitch roxo)");
}

export function iniciarFormRecorrente(): void {
  iniciar();
}
