// "Quem esta usando?" — como na Netflix: cada pessoa clica na sua bolinha e
// digita o PIN (4 a 6 numeros). Primeira abertura: cria a conta do administrador.
// Esqueceu o PIN: um administrador cadastra um PIN novo em CONTAS. Voltar a esta tela
// encerra a sessao do perfil anterior. Teclas 1 a 9 escolhem a bolinha.
import { buscarStatus } from "../api";
import {
  criarPrimeiroAdmin,
  entrarComPin,
  fotoDoPerfil,
  listarPerfis,
  sairDaSessao,
  ErroApi,
  ErroValidacaoApi,
  PerfilConta,
  SessaoConta,
} from "../api-contas";
import { criarAvatar, definirPerfil, limparPerfil, perfilAtual } from "../perfil";
import { menuPrincipal } from "../navegacao";
import { notificar } from "../notificacoes";

let escolhido: (PerfilConta & { foto?: string | null }) | null = null;

function el<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

function erro(id: string, msg?: string): void {
  el(id).textContent = msg ?? "";
  el(id).classList.toggle("hidden", !msg);
}

async function entrar(sessao: SessaoConta, foto?: string | null): Promise<void> {
  definirPerfil({ id: sessao.id, nome: sessao.nome, admin: sessao.admin, token: sessao.token, foto: foto ?? null });
  document.body.dataset.perfil = sessao.nome;
  await menuPrincipal();
}

// ---------- pop-up do PIN ----------

function abrirPin(perfil: PerfilConta & { foto?: string | null }): void {
  escolhido = perfil;
  el("pin-bolinha").replaceChildren(criarAvatar(perfil, "pequena"));
  el("pin-nome").textContent = perfil.nome;
  el<HTMLInputElement>("pin-campo").value = "";
  erro("pin-erro");
  el("pin-form").classList.remove("hidden");
  el("esqueci-form").classList.add("hidden");
  el("pin-veu").classList.remove("hidden");
  document.body.dataset.pinAberto = "true";
  el<HTMLInputElement>("pin-campo").focus();
}

function fecharPin(): void {
  el("pin-veu").classList.add("hidden");
  delete document.body.dataset.pinAberto;
  escolhido = null;
}

async function conferirPin(): Promise<void> {
  if (!escolhido) return;
  const pin = el<HTMLInputElement>("pin-campo").value.trim();
  if (!/^\d{4,6}$/.test(pin)) return erro("pin-erro", "O PIN tem de 4 a 6 números.");
  try {
    const sessao = await entrarComPin(await window.finDesk!.config(), escolhido.id, pin);
    await entrar(sessao, escolhido.foto);
  } catch (falha) {
    el<HTMLInputElement>("pin-campo").value = "";
    el<HTMLInputElement>("pin-campo").focus();
    if (falha instanceof ErroApi && falha.status === 401) {
      const resta = Number(falha.corpo.tentativasRestantes ?? 0);
      erro("pin-erro", resta ? `PIN incorreto. Mais ${resta} tentativa(s) antes de bloquear.` : "PIN incorreto.");
    } else if (falha instanceof ErroApi && falha.status === 423) {
      erro("pin-erro", `Conta bloqueada por PINs errados. Espere ${falha.corpo.minutos ?? 5} minutos ou peça a um administrador um PIN novo.`);
    } else {
      erro("pin-erro", "Não foi possível entrar. Tente de novo.");
    }
  }
}

// ---------- esqueci o PIN ----------

function abrirEsqueci(): void {
  // sem e-mail: o PIN novo e cadastrado por um administrador em CONTAS (pedido do usuario)
  el("pin-form").classList.add("hidden");
  el("esqueci-form").classList.remove("hidden");
  el("esqueci-voltar").focus();
}

// ---------- primeira abertura: administrador ----------

async function criarAdmin(): Promise<void> {
  const v = (id: string): string => el<HTMLInputElement>(id).value.trim();
  const erros: Record<string, string> = {};
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v("adm_email_loja"))) erros.emailLoja = "Informe o e-mail da loja (ex.: loja@gmail.com).";
  if (!/^\d{4,6}$/.test(v("adm_pin"))) erros.pin = "O PIN tem de 4 a 6 números.";
  else if (v("adm_pin") !== v("adm_pin2")) erros.pin2 = "Os dois PINs não são iguais.";
  const mostrar = (e: Record<string, string>): void => {
    document.querySelectorAll<HTMLElement>("#form-admin .campo-erro").forEach((p) => {
      const msg = e[p.dataset.erroCampo ?? ""];
      p.textContent = msg ?? "";
      p.classList.toggle("hidden", !msg);
    });
  };
  mostrar(erros);
  if (Object.keys(erros).length) return;
  try {
    const sessao = await criarPrimeiroAdmin(await window.finDesk!.config(), {
      nome: v("adm_nome"), email: v("adm_email"), emailLoja: v("adm_email_loja"), pin: v("adm_pin"),
    });
    notificar(`Administrador ${sessao.nome} criado. Cadastre as outras contas em CONTAS, na barra.`);
    await entrar(sessao);
  } catch (falha) {
    if (falha instanceof ErroValidacaoApi) mostrar(falha.campos);
    else erro("perfis-erro", "Não foi possível criar o administrador. Tente de novo.");
  }
}

// ---------- bolinhas ----------

function cartao(perfil: PerfilConta & { foto?: string | null }, indice: number): HTMLLIElement {
  const li = document.createElement("li");
  const botao = document.createElement("button");
  botao.type = "button";
  botao.className = "perfil-cartao";
  botao.dataset.perfil = perfil.nome;
  botao.setAttribute("aria-label", `Entrar como ${perfil.nome}`);
  const nome = document.createElement("span");
  nome.className = "perfil-nome";
  nome.textContent = perfil.nome;
  const tecla = document.createElement("span");
  tecla.className = "perfil-tecla";
  tecla.textContent = indice < 9 ? String(indice + 1) : "";
  botao.append(criarAvatar(perfil, "grande"), nome, tecla);
  if (perfil.admin) {
    const coroa = document.createElement("span");
    coroa.className = "perfil-admin";
    coroa.textContent = "ADMIN";
    botao.appendChild(coroa);
  }
  botao.addEventListener("click", () => abrirPin(perfil));
  li.appendChild(botao);
  return li;
}

async function carregar(): Promise<void> {
  try {
    const cfg = await window.finDesk!.config();
    await buscarStatus(cfg);
    document.body.dataset.apiStatus = "ok";
    // voltar para esta tela encerra a sessao anterior (trocar de perfil)
    if (perfilAtual()) await sairDaSessao(cfg).catch(() => undefined);
    limparPerfil();
    const { primeiroAcesso, perfis } = await listarPerfis(cfg);
    if (primeiroAcesso) {
      // o "BEM-VINDO AO SISTEMA DE CONTAS A PAGAR" ja fica no topo (perfis.html)
      el("perfis-titulo").textContent = "Vamos começar";
      el("perfis-dica").textContent = "Ainda não há contas no sistema.";
      el("primeiro-admin").classList.remove("hidden");
      document.body.dataset.primeiroAcesso = "true";
      el<HTMLInputElement>("adm_nome").focus();
      return;
    }
    const comFoto = await Promise.all(perfis.map(async (p) => ({ ...p, foto: p.temFoto ? await fotoDoPerfil(cfg, p.id) : null })));
    el("perfis").replaceChildren(...comFoto.map(cartao));
    document.body.dataset.perfisCarregados = String(perfis.length);
    document.addEventListener("keydown", (evento) => {
      if (evento.key === "Escape" && document.body.dataset.pinAberto) {
        evento.preventDefault();
        fecharPin();
        return;
      }
      if (document.body.dataset.pinAberto) return;
      const n = Number(evento.key);
      if (!Number.isInteger(n) || n < 1 || n > Math.min(9, comFoto.length)) return;
      evento.preventDefault();
      abrirPin(comFoto[n - 1]);
    });
    el("perfis").querySelector<HTMLButtonElement>("button")?.focus();
  } catch (falha) {
    document.body.dataset.apiStatus = "erro";
    erro("perfis-erro", "Não foi possível carregar as contas. Feche e abra o sistema de novo.");
    console.error("[ContasAPagar] falha ao carregar os perfis:", falha);
  }
}

export function iniciarPerfis(): void {
  el<HTMLFormElement>("pin-form").addEventListener("submit", (e) => {
    e.preventDefault();
    void conferirPin();
  });
  el("pin-cancelar").addEventListener("click", fecharPin);
  el("btn-esqueci").addEventListener("click", abrirEsqueci);
  el("esqueci-voltar").addEventListener("click", () => escolhido && abrirPin(escolhido));
  el<HTMLFormElement>("form-admin").addEventListener("submit", (e) => {
    e.preventDefault();
    void criarAdmin();
  });
  // so numeros nos campos de PIN
  document.querySelectorAll<HTMLInputElement>("#pin-campo, #adm_pin, #adm_pin2").forEach((i) => {
    i.addEventListener("input", () => {
      i.value = i.value.replace(/\D/g, "").slice(0, 6);
    });
  });
  void carregar();
}
