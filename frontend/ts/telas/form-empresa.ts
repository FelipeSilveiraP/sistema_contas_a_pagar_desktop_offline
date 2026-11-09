import { buscarStatus, criarEmpresa, ErroValidacaoApi } from "../api";
import { confirmar } from "../componentes";
import { voltar } from "../navegacao";
import { montarNavbar } from "../navbar";
import { mascaraCNPJ, mascaraTelefone } from "../mascaras";

interface CamposFormulario {
  razaoSocial: string;
  cnpj: string;
  nomeRepresentante: string;
  email: string;
  logradouro: string;
}

const ID_CAMPOS: Record<keyof CamposFormulario, string> = {
  razaoSocial: "campo-razao-social",
  cnpj: "campo-cnpj",
  nomeRepresentante: "campo-representante",
  email: "campo-email",
  logradouro: "campo-logradouro",
};

function campo(nome: keyof CamposFormulario): HTMLInputElement {
  return document.getElementById(ID_CAMPOS[nome]) as HTMLInputElement;
}

function lerCampos(): CamposFormulario {
  return {
    razaoSocial: campo("razaoSocial").value.trim(),
    cnpj: campo("cnpj").value.trim(),
    nomeRepresentante: campo("nomeRepresentante").value.trim(),
    email: campo("email").value.trim(),
    logradouro: campo("logradouro").value.trim(),
  };
}

function lerTelefones(): { numero: string; tipo: string }[] {
  const linhas = document.querySelectorAll<HTMLElement>(".linha-telefone");
  const telefones: { numero: string; tipo: string }[] = [];
  linhas.forEach((linha) => {
    const numero = (linha.querySelector(".tel-numero") as HTMLInputElement).value.trim();
    const tipo = (linha.querySelector(".tel-tipo") as HTMLInputElement).value.trim();
    if (numero) telefones.push({ numero, tipo: tipo || undefined } as { numero: string; tipo: string });
  });
  return telefones;
}

export function cnpjValido(entrada: string): boolean {
  const cnpj = entrada.replace(/\D/g, "");
  if (cnpj.length !== 14 || cnpj.split("").every((c) => c === cnpj[0])) return false;
  const d = cnpj.split("").map((c) => Number(c));
  const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const digito = (pesos: number[]): number => {
    const soma = pesos.reduce((acc, p, i) => acc + d[i] * p, 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  return digito(pesos1) === d[12] && digito(pesos2) === d[13];
}

function validar(dados: CamposFormulario, telefones: { numero: string; tipo: string }[]): Record<string, string> {
  const erros: Record<string, string> = {};
  if (dados.razaoSocial.length < 2 || dados.razaoSocial.length > 120) {
    erros.razaoSocial = "informe a razao social (2 a 120 caracteres)";
  }
  if (dados.cnpj && !cnpjValido(dados.cnpj)) {
    erros.cnpj = "CNPJ invalido (14 digitos com digitos verificadores)";
  }
  if (dados.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dados.email)) {
    erros.email = "email invalido";
  }
  if (dados.nomeRepresentante.length > 120) {
    erros.nomeRepresentante = "nome do representante deve ter ate 120 caracteres";
  }
  if (dados.logradouro.length > 120) {
    erros.logradouro = "logradouro deve ter ate 120 caracteres";
  }
  for (let i = 0; i < telefones.length; i++) {
    if (!/^[0-9A-Za-z().+\- ]{8,20}$/.test(telefones[i].numero)) {
      erros.telefones = `telefone invalido (8 a 20 caracteres) na linha ${i + 1}`;
      break;
    }
  }
  return erros;
}

function mostrarErros(erros: Record<string, string>): void {
  document.querySelectorAll<HTMLElement>(".campo-erro").forEach((el) => {
    const nome = el.dataset.erroCampo ?? "";
    const mensagem = erros[nome];
    el.textContent = mensagem ?? "";
    el.classList.toggle("hidden", !mensagem);
  });
  (Object.keys(ID_CAMPOS) as (keyof CamposFormulario)[]).forEach((nome) => {
    campo(nome).classList.toggle("border-[#b6212a]", Boolean(erros[nome]));
  });
}

function mostrarFeedback(mensagem: string, sucesso: boolean): void {
  const feedback = document.getElementById("feedback-empresa");
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
    etapa === 1 ? "Etapa 1 de 2 — Identificação" : "Etapa 2 de 2 — Contato e endereço";
}

function adicionarLinhaTelefone(): void {
  const lista = document.getElementById("lista-telefones")!;
  const linha = document.createElement("div");
  linha.className = "linha-telefone flex flex-wrap items-center gap-2";
  linha.innerHTML = `
<input class="form-campo tel-numero flex-1 min-w-[10rem] border-4 border-[#1c1b1b] bg-white px-3 py-2 font-mono text-sm text-[#1c1b1b] shadow-[3px_3px_0_0_#1c1b1b] focus:outline-none" type="text" maxlength="20" placeholder="(11) 99999-0000" autocomplete="off">
<input class="form-campo tel-tipo w-36 border-4 border-[#1c1b1b] bg-white px-3 py-2 font-mono text-sm text-[#1c1b1b] shadow-[3px_3px_0_0_#1c1b1b] focus:outline-none" type="text" maxlength="20" placeholder="Comercial" autocomplete="off">
<button class="inline-flex items-center justify-center w-10 h-10 bg-white border-4 border-[#1c1b1b] shadow-[3px_3px_0_0_#1c1b1b] hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all cursor-pointer tel-remover" type="button" aria-label="Remover telefone">
<span class="material-symbols-outlined text-base leading-none font-bold">delete</span>
</button>`;
  mascaraTelefone(linha.querySelector(".tel-numero") as HTMLInputElement);
  linha.querySelector(".tel-remover")!.addEventListener("click", () => linha.remove());
  lista.appendChild(linha);
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
  montarNavbar("form-empresa");
  mascaraCNPJ(campo("cnpj"));
  const formulario = document.getElementById("form-empresa") as HTMLFormElement;
  let sujo = false;

  const marcarSujo = () => {
    sujo = true;
    document.body.dataset.formSujo = "true";
  };
  formulario.addEventListener("input", marcarSujo);
  document.getElementById("lista-telefones")!.addEventListener("input", marcarSujo);

  document.getElementById("btn-add-telefone")!.addEventListener("click", () => {
    adicionarLinhaTelefone();
    marcarSujo();
  });

  document.getElementById("btn-proxima")!.addEventListener("click", () => {
    const dados = lerCampos();
    const erros = validar(dados, []);
    if (erros.razaoSocial || erros.cnpj || erros.nomeRepresentante) {
      mostrarErros(erros);
      mostrarFeedback("Corrija os campos destacados.", false);
      return;
    }
    mostrarErros({});
    mostrarFeedback("", true);
    alternarEtapa(2);
  });

  document.getElementById("btn-voltar-etapa")!.addEventListener("click", () => alternarEtapa(1));

  formulario.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const dados = lerCampos();
    const telefones = lerTelefones();
    const erros = validar(dados, telefones);
    mostrarErros(erros);
    if (Object.keys(erros).length > 0) {
      mostrarFeedback("Corrija os campos destacados.", false);
      return;
    }
    try {
      const cfg = await window.finDesk!.config();
      const criada = await criarEmpresa(cfg, {
        razaoSocial: dados.razaoSocial,
        cnpj: dados.cnpj || undefined,
        nomeRepresentante: dados.nomeRepresentante || undefined,
        email: dados.email || undefined,
        logradouro: dados.logradouro || undefined,
        telefones: telefones.map((t) => ({ numero: t.numero, tipo: t.tipo || undefined })),
      });
      sujo = false;
      document.body.dataset.formSujo = "false";
      formulario.reset();
      document.getElementById("lista-telefones")!.innerHTML = "";
      mostrarErros({});
      alternarEtapa(1);
      mostrarFeedback(`Empresa "${criada.razaoSocial}" cadastrada com sucesso.`, true);
      document.body.dataset.empresaSalva = String(criada.id);
      console.info("[ContasAPagar] empresa cadastrada via formulario (id:", criada.id, ")");
    } catch (erro) {
      if (erro instanceof ErroValidacaoApi) {
        mostrarErros(erro.campos);
        mostrarFeedback("Corrija os campos destacados.", false);
      } else {
        mostrarFeedback("Nao foi possivel salvar a empresa. Tente novamente.", false);
        console.error("[ContasAPagar] falha ao cadastrar empresa:", erro);
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
  console.info("[ContasAPagar] formulario de empresa iniciado");
}

export function iniciarFormEmpresa(): void {
  iniciar();
}
