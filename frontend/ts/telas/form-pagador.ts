import { buscarStatus, criarPagador, ErroValidacaoApi } from "../api";
import { confirmar, dialogoEstaAberto, menuLateralAberto } from "../componentes";
import { voltar } from "../navegacao";
import { montarNavbar } from "../navbar";
import { cpfValido, mascaraCPF } from "../mascaras";

interface CamposFormulario {
  nome: string;
  cpf: string;
  funcao: string;
}

const ID_CAMPOS: Record<keyof CamposFormulario, string> = {
  nome: "campo-nome",
  cpf: "campo-cpf",
  funcao: "campo-funcao",
};

function campo(nome: keyof CamposFormulario): HTMLInputElement {
  return document.getElementById(ID_CAMPOS[nome]) as HTMLInputElement;
}

function lerCampos(): CamposFormulario {
  return {
    nome: campo("nome").value.trim(),
    cpf: campo("cpf").value.trim(),
    funcao: campo("funcao").value.trim(),
  };
}

function validar(dados: CamposFormulario): Record<string, string> {
  const erros: Record<string, string> = {};
  if (dados.nome.length < 2 || dados.nome.length > 120) {
    erros.nome = "informe o nome do pagador (2 a 120 caracteres)";
  }
  if (dados.cpf && !cpfValido(dados.cpf)) {
    erros.cpf = "CPF invalido (11 digitos com digitos verificadores)";
  }
  if (dados.funcao.length > 100) {
    erros.funcao = "funcao deve ter ate 100 caracteres";
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
  const feedback = document.getElementById("feedback-pagador");
  if (!feedback) return;
  feedback.textContent = mensagem;
  feedback.classList.remove("hidden");
  feedback.classList.toggle("text-[#006c46]", sucesso);
  feedback.classList.toggle("text-[#b6212a]", !sucesso);
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

function iniciar(): void {
  montarNavbar("form-pagador");
  mascaraCPF(campo("cpf"));
  const formulario = document.getElementById("form-pagador") as HTMLFormElement;
  let sujo = false;

  formulario.addEventListener("input", () => {
    sujo = true;
    document.body.dataset.formSujo = "true";
  });

  formulario.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const dados = lerCampos();
    const erros = validar(dados);
    mostrarErros(erros);
    if (Object.keys(erros).length > 0) {
      mostrarFeedback("Corrija os campos destacados.", false);
      return;
    }
    try {
      const cfg = await window.finDesk!.config();
      const criado = await criarPagador(cfg, {
        nome: dados.nome,
        cpf: dados.cpf,
        funcao: dados.funcao || undefined,
      });
      sujo = false;
      document.body.dataset.formSujo = "false";
      formulario.reset();
      mostrarErros({});
      mostrarFeedback(`Pagador "${criado.nome}" cadastrado com sucesso.`, true);
      document.body.dataset.pagadorSalvo = String(criado.id);
      console.info("[ContasAPagar] pagador cadastrado via formulario (id:", criado.id, ")");
    } catch (erro) {
      if (erro instanceof ErroValidacaoApi) {
        mostrarErros(erro.campos);
        mostrarFeedback("Corrija os campos destacados.", false);
      } else {
        mostrarFeedback("Nao foi possivel salvar o pagador. Tente novamente.", false);
        console.error("[ContasAPagar] falha ao cadastrar pagador:", erro);
      }
    }
  });

  document.getElementById("btn-cancelar")?.addEventListener("click", () => {
    void (async () => {
      if (sujo && !(await confirmar("Ha alteracoes nao salvas. Deseja sair mesmo assim?"))) return;
      void voltar();
    })();
  });

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

  document.addEventListener(
    "keydown",
    (evento) => {
      if (evento.key !== "Escape" || !sujo || dialogoEstaAberto() || menuLateralAberto()) return;
      evento.preventDefault();
      evento.stopPropagation();
      void confirmar("Ha alteracoes nao salvas. Deseja sair mesmo assim?").then((ok) => {
        if (ok) void voltar();
      });
    },
    true
  );

  void verificarApi();
  console.info("[ContasAPagar] formulario de pagador iniciado");
}

export function iniciarFormPagador(): void {
  iniciar();
}
