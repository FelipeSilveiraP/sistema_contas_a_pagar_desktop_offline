import { buscarStatus, criarBanco, ErroValidacaoApi } from "../api";
import { confirmar } from "../componentes";
import { voltar } from "../navegacao";
import { montarNavbar } from "../navbar";

interface CamposFormulario {
  instituicao: string;
  chavePix: string;
}

const ID_CAMPOS: Record<keyof CamposFormulario, string> = {
  instituicao: "campo-instituicao",
  chavePix: "campo-chave-pix",
};

function campo(nome: keyof CamposFormulario): HTMLInputElement {
  return document.getElementById(ID_CAMPOS[nome]) as HTMLInputElement;
}

function lerCampos(): CamposFormulario {
  return {
    instituicao: campo("instituicao").value.trim(),
    chavePix: campo("chavePix").value.trim(),
  };
}

function validar(dados: CamposFormulario): Record<string, string> {
  const erros: Record<string, string> = {};
  if (dados.instituicao.length < 2 || dados.instituicao.length > 120) {
    erros.instituicao = "informe a instituicao bancaria (2 a 120 caracteres)";
  }
  if (dados.chavePix && (dados.chavePix.length > 77 || dados.chavePix.includes(" "))) {
    erros.chavePix = "chave Pix invalida (ate 77 caracteres, sem espacos)";
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
  const feedback = document.getElementById("feedback-banco");
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
  montarNavbar("form-banco");
  const formulario = document.getElementById("form-banco") as HTMLFormElement;
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
      const criado = await criarBanco(cfg, {
        instituicao: dados.instituicao,
        chavePix: dados.chavePix || undefined,
      });
      sujo = false;
      document.body.dataset.formSujo = "false";
      formulario.reset();
      mostrarErros({});
      mostrarFeedback(`Banco "${criado.instituicao}" cadastrado com sucesso.`, true);
      document.body.dataset.bancoSalvo = String(criado.id);
      console.info("[ContasAPagar] banco cadastrado via formulario (id:", criado.id, ")");
    } catch (erro) {
      if (erro instanceof ErroValidacaoApi) {
        mostrarErros(erro.campos);
        mostrarFeedback("Corrija os campos destacados.", false);
      } else {
        mostrarFeedback("Nao foi possivel salvar o banco. Tente novamente.", false);
        console.error("[ContasAPagar] falha ao cadastrar banco:", erro);
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
  console.info("[ContasAPagar] formulario de banco iniciado");
}

export function iniciarFormBanco(): void {
  iniciar();
}
