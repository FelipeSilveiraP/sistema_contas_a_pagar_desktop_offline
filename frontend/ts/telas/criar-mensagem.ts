import { buscarStatus, criarAviso, ErroValidacaoApi } from "../api";
import { confirmar, dialogoEstaAberto, menuLateralAberto } from "../componentes";
import { voltar } from "../navegacao";
import { montarNavbar } from "../navbar";

function el<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

let sujo = false;

function diasSelecionados(): string[] {
  return [...document.querySelectorAll<HTMLButtonElement>(".day-btn.is-active")].map((b) => b.dataset.day ?? "");
}

function validar(): Record<string, string> {
  const erros: Record<string, string> = {};
  const inicio = el<HTMLInputElement>("dt_inicio").value;
  const fim = el<HTMLInputElement>("dt_fim").value;
  const titulo = el<HTMLInputElement>("msg_titulo").value.trim();
  const corpo = el<HTMLTextAreaElement>("msg_corpo").value.trim();
  if (!inicio) erros.dataInicio = "informe a data de inicio";
  if (!fim) erros.dataFim = "informe a data final";
  if (inicio && fim && fim < inicio) erros.dataFim = "o fim deve ser igual ou posterior ao inicio";
  if (titulo.length < 2 || titulo.length > 100) erros.titulo = "informe o titulo (2 a 100 caracteres)";
  if (corpo.length < 2 || corpo.length > 500) erros.mensagem = "informe a mensagem (2 a 500 caracteres)";
  if (diasSelecionados().length === 0) erros.diaSemana = "selecione ao menos um dia da semana";
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

function mostrarFeedback(mensagem: string, sucesso: boolean): void {
  const feedback = el("feedback-mensagem");
  feedback.textContent = mensagem;
  feedback.classList.remove("hidden");
  feedback.classList.toggle("text-[#006c46]", sucesso);
  feedback.classList.toggle("text-[#dc2626]", !sucesso);
}

async function submeter(): Promise<void> {
  const erros = validar();
  mostrarErros(erros);
  if (Object.keys(erros).length > 0) {
    mostrarFeedback("Corrija os campos destacados.", false);
    return;
  }
  try {
    const cfg = await window.finDesk!.config();
    const criada = await criarAviso(cfg, {
      dataInicio: el<HTMLInputElement>("dt_inicio").value,
      dataFim: el<HTMLInputElement>("dt_fim").value,
      diaSemana: diasSelecionados().join(","),
      titulo: el<HTMLInputElement>("msg_titulo").value.trim(),
      mensagem: el<HTMLTextAreaElement>("msg_corpo").value.trim(),
    });
    sujo = false;
    document.body.dataset.formSujo = "false";
    document.body.dataset.mensagemSalva = String(criada.id);
    mostrarFeedback(`Mensagem "${criada.titulo}" salva com sucesso.`, true);
    console.info("[ContasAPagar] mensagem cadastrada (id:", criada.id, ")");
    window.setTimeout(() => {
      void voltar();
    }, 1200);
  } catch (erro) {
    if (erro instanceof ErroValidacaoApi) {
      mostrarErros(erro.campos);
      mostrarFeedback("Corrija os campos destacados.", false);
    } else {
      mostrarFeedback("Nao foi possivel salvar a mensagem. Tente novamente.", false);
      console.error("[ContasAPagar] falha ao salvar mensagem:", erro);
    }
  }
}

function marcarDia(botao: HTMLButtonElement, ativo: boolean): void {
  botao.classList.toggle("is-active", ativo);
  botao.classList.toggle("bg-[#dc2626]", ativo);
  botao.classList.toggle("text-white", ativo);
  botao.classList.toggle("bg-white", !ativo);
  botao.classList.toggle("text-[#1c1b1b]", !ativo);
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
  montarNavbar("criar-mensagem");

  document.querySelectorAll<HTMLButtonElement>(".day-btn").forEach((botao) => {
    botao.addEventListener("click", () => {
      marcarDia(botao, !botao.classList.contains("is-active"));
      sujo = true;
      document.body.dataset.formSujo = "true";
    });
  });
  el("btn-dias-uteis").addEventListener("click", () => {
    const uteis = new Set(["SEGUNDA", "TERCA", "QUARTA", "QUINTA", "SEXTA"]);
    document.querySelectorAll<HTMLButtonElement>(".day-btn").forEach((b) => marcarDia(b, uteis.has(b.dataset.day ?? "")));
    sujo = true;
    document.body.dataset.formSujo = "true";
  });
  el("btn-todos-dias").addEventListener("click", () => {
    document.querySelectorAll<HTMLButtonElement>(".day-btn").forEach((b) => marcarDia(b, true));
    sujo = true;
    document.body.dataset.formSujo = "true";
  });
  el("btn-hoje").addEventListener("click", () => {
    const hoje = new Date().toISOString().split("T")[0];
    el<HTMLInputElement>("dt_inicio").value = hoje;
    if (!el<HTMLInputElement>("dt_fim").value) el<HTMLInputElement>("dt_fim").value = hoje;
    sujo = true;
    document.body.dataset.formSujo = "true";
  });

  el<HTMLFormElement>("form-mensagem").addEventListener("input", () => {
    sujo = true;
    document.body.dataset.formSujo = "true";
  });
  el<HTMLFormElement>("form-mensagem").addEventListener("submit", (evento) => {
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
  console.info("[ContasAPagar] formulario de mensagem iniciado (design Stitch)");
}

export function iniciarCriarMensagem(): void {
  iniciar();
}
