import { buscarStatus, criarAviso, ErroValidacaoApi } from "../api";
import { confirmarSaida, dialogoEstaAberto, menuLateralAberto } from "../componentes";
import { notificar } from "../notificacoes";
import { hojeIso } from "../filtros";
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
  if (!inicio) erros.dataInicio = "Informe a data de início.";
  if (!fim) erros.dataFim = "Informe a data final.";
  if (inicio && fim && fim < inicio) erros.dataFim = "A data final deve ser igual ou depois da data de início.";
  if (titulo.length < 2 || titulo.length > 100) erros.titulo = "Informe o título (de 2 a 100 caracteres).";
  if (corpo.length < 2 || corpo.length > 500) erros.mensagem = "Escreva a mensagem (de 2 a 500 caracteres).";
  if (diasSelecionados().length === 0) erros.diaSemana = "Selecione pelo menos um dia da semana.";
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
  if (sucesso) {
    feedback.textContent = "";
    feedback.classList.add("hidden");
    if (mensagem) notificar(mensagem);
    return;
  }
  feedback.setAttribute("role", "alert");
  feedback.textContent = mensagem;
  feedback.classList.remove("hidden");
  feedback.classList.toggle("text-[#006c46]", sucesso);
  feedback.classList.toggle("text-[#dc2626]", !sucesso);
}

async function submeter(): Promise<void> {
  const erros = validar();
  mostrarErros(erros);
  if (Object.keys(erros).length > 0) {
    mostrarFeedback("Corrija os campos destacados em vermelho.", false);
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
      mostrarFeedback("Corrija os campos destacados em vermelho.", false);
    } else {
      mostrarFeedback("Não foi possível salvar a mensagem. Verifique se o sistema está aberto e tente de novo.", false);
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
    const hoje = hojeIso();
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
      if (sujo && !(await confirmarSaida())) return;
      void voltar();
    })();
  });

  document.addEventListener("keydown", (evento) => {
    if (evento.key !== "Escape" || !sujo || dialogoEstaAberto() || menuLateralAberto()) return;
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
  console.info("[ContasAPagar] formulario de mensagem iniciado (design Stitch)");
}

export function iniciarCriarMensagem(): void {
  iniciar();
}
