// CONTAS (icone na barra): todos veem "Minha conta" e trocam o proprio PIN.
// So o ADMINISTRADOR ve e edita as contas dos outros (nome, foto, login, e-mail,
// PIN, admin, ativo), o historico de acessos e o Gmail que envia os codigos.
// O servidor confere o admin em cada pedido (403 para quem nao e).
import {
  atualizarUsuario,
  cadastrarUsuario,
  excluirUsuario,
  fotoDoPerfil,
  listarAcessos,
  listarUsuarios,
  minhaConta,
  novoPinDoUsuario,
  trocarFotoDoUsuario,
  trocarMeuPin,
  AcessoDados,
  ErroApi,
  ErroValidacaoApi,
  UsuarioDados,
} from "../api-contas";
import { criarEditorCampo, EditorCampo } from "../editor-registro";
import { confirmarExclusao } from "../componentes";
import { notificar } from "../notificacoes";
import { montarNavbar } from "../navbar";
import { criarAvatar, definirPerfil, exigirPerfil } from "../perfil";

const TIPOS: Record<string, string> = {
  ENTRADA: "Entrou", PIN_ERRADO: "PIN errado", BLOQUEIO: "Bloqueada (PINs errados)", PIN_TROCADO: "Trocou o PIN",
  PIN_REDEFINIDO_EMAIL: "PIN novo pelo e-mail", PIN_REDEFINIDO_ADMIN: "PIN novo pelo admin", CODIGO_ENVIADO: "Código enviado por e-mail",
};

let usuarios: UsuarioDados[] = [];
const fotos = new Map<number, string | null>();
let selecionadoId: number | null = null;
let editor: EditorCampo | null = null;

function el<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

function erroEm(id: string, msg?: string): void {
  el(id).textContent = msg ?? "";
  el(id).classList.toggle("hidden", !msg);
}

function mensagem(falha: unknown, padrao: string): string {
  if (falha instanceof ErroValidacaoApi) return Object.values(falha.campos)[0] ?? padrao;
  if (falha instanceof ErroApi && falha.status === 409) return "O sistema precisa de pelo menos um administrador ativo, e você não pode excluir a sua própria conta.";
  if (falha instanceof ErroApi && falha.status === 403) return "Só o administrador pode fazer isso.";
  return padrao;
}

function dataBR(texto: string | null): string {
  if (!texto) return "—";
  const [d, h] = texto.split(" ");
  const [a, m, dia] = d.split("-");
  return `${dia}/${m}/${a}${h ? ` ${h.slice(0, 5)}` : ""}`;
}

function selo(texto: string, classe: string): HTMLSpanElement {
  const s = document.createElement("span");
  s.className = `selo ${classe}`;
  s.textContent = texto;
  return s;
}

/** Foto escolhida -> quadrado de 256 px em JPEG (fica pequena no banco). */
async function prepararFoto(arquivo: File): Promise<string> {
  // so imagem de verdade e de ate 15 MB (a foto e refeita em 256 px, entao o servidor
  // recebe um JPEG pequeno e sem os dados escondidos do arquivo original)
  if (!/^image\/(png|jpeg|webp)$/.test(arquivo.type) || arquivo.size > 15 * 1024 * 1024) {
    throw new ErroValidacaoApi({ foto: "Foto inválida: use JPG, PNG ou WEBP de até 15 MB." });
  }
  let imagem: ImageBitmap;
  try {
    imagem = await createImageBitmap(arquivo);
  } catch {
    throw new ErroValidacaoApi({ foto: "Esse arquivo não é uma imagem. Escolha uma foto JPG ou PNG." });
  }
  const lado = Math.min(imagem.width, imagem.height);
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  canvas.getContext("2d")!.drawImage(imagem, (imagem.width - lado) / 2, (imagem.height - lado) / 2, lado, lado, 0, 0, 256, 256);
  return canvas.toDataURL("image/jpeg", 0.85);
}

function linhaAcesso(a: AcessoDados, comNome: boolean): HTMLLIElement {
  const li = document.createElement("li");
  if (a.tipo === "PIN_ERRADO" || a.tipo === "BLOQUEIO") li.classList.add("alerta");
  const quando = document.createElement("span");
  quando.className = "font-mono";
  quando.textContent = dataBR(a.momento);
  const texto = document.createElement("span");
  texto.textContent = `${comNome ? `${a.nome} — ` : ""}${TIPOS[a.tipo] ?? a.tipo}`;
  li.append(quando, texto);
  return li;
}

// ---------- minha conta ----------

async function carregarMinhaConta(): Promise<void> {
  const cfg = await window.finDesk!.config();
  const eu = await minhaConta(cfg);
  const foto = eu.temFoto ? await fotoDoPerfil(cfg, eu.id) : null;
  const dados = document.createElement("div");
  dados.className = "flex flex-col gap-1 text-sm font-bold";
  const nome = document.createElement("span");
  nome.className = "text-lg uppercase";
  nome.textContent = eu.nome;
  const email = document.createElement("span");
  email.textContent = `E-mail (login): ${eu.email ?? eu.login}`;
  const acessos = document.createElement("span");
  acessos.className = "font-mono text-xs text-neutral-600 uppercase";
  acessos.textContent = `${eu.acessos} acesso(s) · último: ${dataBR(eu.ultimoAcesso)}`;
  dados.append(nome, email, acessos);
  el("minha-conta").replaceChildren(criarAvatar({ id: eu.id, nome: eu.nome, foto }, "grande"), dados);
}

async function trocarPin(): Promise<void> {
  const atual = el<HTMLInputElement>("meu_atual").value;
  const novo = el<HTMLInputElement>("meu_novo").value;
  if (!/^\d{4,6}$/.test(novo)) return erroEm("erro-meu-pin", "O PIN novo tem de 4 a 6 números.");
  if (novo !== el<HTMLInputElement>("meu_novo2").value) return erroEm("erro-meu-pin", "Os dois PINs novos não são iguais.");
  try {
    await trocarMeuPin(await window.finDesk!.config(), atual, novo);
    el<HTMLFormElement>("form-meu-pin").reset();
    erroEm("erro-meu-pin");
    notificar("PIN trocado.");
  } catch (falha) {
    erroEm("erro-meu-pin", mensagem(falha, "Não foi possível trocar o PIN."));
  }
}

// ---------- administrador ----------

function selecionado(): UsuarioDados | undefined {
  return usuarios.find((u) => u.id === selecionadoId);
}

function renderTabela(): void {
  const corpo = el("tabela-usuarios");
  corpo.replaceChildren(...usuarios.map((u) => {
    const tr = document.createElement("tr");
    tr.className = "cursor-pointer hover:bg-[#fff9d6]";
    if (u.id === selecionadoId) tr.classList.add("bg-[#FFE600]");
    if (!u.ativo) tr.classList.add("text-neutral-500");
    const celula = (conteudo: string | HTMLElement, classe = ""): HTMLTableCellElement => {
      const td = document.createElement("td");
      td.className = `py-2.5 px-3 ${classe}`;
      if (typeof conteudo === "string") td.textContent = conteudo;
      else td.appendChild(conteudo);
      return td;
    };
    tr.append(
      celula(criarAvatar({ id: u.id, nome: u.nome, foto: fotos.get(u.id) }, "pequena")),
      celula(u.nome, "uppercase"),
      celula(u.email ?? u.login, "font-mono text-xs"),
      celula(u.admin ? selo("Admin", "bg-[#A78BFA]/30 text-[#4c1d95]") : selo("Usuário", "bg-neutral-100 text-neutral-700"), "text-center"),
      celula(u.bloqueado ? selo("Bloqueada", "bg-[#ffdad6] text-[#ba1a1a]") : u.ativo ? selo("Ativa", "bg-[#006c46]/10 text-[#006c46]")
        : selo("Desativada", "bg-neutral-200 text-neutral-700"), "text-center"),
      celula(String(u.acessos), "text-right font-mono"),
      celula(dataBR(u.ultimoAcesso), "font-mono text-xs whitespace-nowrap"),
    );
    tr.addEventListener("click", () => void selecionar(u.id));
    return tr;
  }));
  document.body.dataset.usuarios = String(usuarios.length);
}

async function selecionar(id: number): Promise<void> {
  selecionadoId = id;
  const u = selecionado();
  if (!u) return;
  el("editorContainer").classList.remove("hidden");
  el("editorRecordName").textContent = `${u.nome} (${u.email ?? u.login})`;
  el("editor-bolinha").replaceChildren(criarAvatar({ id: u.id, nome: u.nome, foto: fotos.get(u.id) }, "pequena"));
  el("btnAdminTexto").textContent = u.admin ? "TIRAR ADMIN" : "TORNAR ADMIN";
  el("btnAtivoTexto").textContent = u.ativo ? "DESATIVAR" : "ATIVAR";
  erroEm("erro-novo-pin");
  editor?.atualizar();
  renderTabela();
  const acessos = await listarAcessos(await window.finDesk!.config(), id, 30);
  el("acessos-conta").replaceChildren(...(acessos.length ? acessos.map((a) => linhaAcesso(a, false)) : [semAcessos()]));
}

function semAcessos(): HTMLLIElement {
  const li = document.createElement("li");
  li.textContent = "Nenhum acesso ainda.";
  return li;
}

async function recarregarAdmin(): Promise<void> {
  const cfg = await window.finDesk!.config();
  usuarios = await listarUsuarios(cfg);
  for (const u of usuarios) if (u.temFoto && !fotos.has(u.id)) fotos.set(u.id, await fotoDoPerfil(cfg, u.id));
  renderTabela();
  if (selecionadoId !== null) {
    if (selecionado()) await selecionar(selecionadoId);
    else fecharEditor();
  }
  const todos = await listarAcessos(cfg, undefined, 100);
  el("acessos-todos").replaceChildren(...(todos.length ? todos.map((a) => linhaAcesso(a, true)) : [semAcessos()]));
}

function fecharEditor(): void {
  selecionadoId = null;
  el("editorContainer").classList.add("hidden");
  renderTabela();
}

async function acao(fazer: (cfg: FinDeskConfig, u: UsuarioDados) => Promise<unknown>, sucesso: string): Promise<void> {
  const u = selecionado();
  if (!u) return;
  try {
    await fazer(await window.finDesk!.config(), u);
    notificar(sucesso);
    fotos.delete(u.id);
    await recarregarAdmin();
  } catch (falha) {
    notificar(mensagem(falha, "Não foi possível. Tente de novo."), "erro");
  }
}

function mostrarErrosForm(form: string, erros: Record<string, string>): void {
  document.querySelectorAll<HTMLElement>(`#${form} .campo-erro`).forEach((p) => {
    const msg = erros[p.dataset.erroCampo ?? ""];
    p.textContent = msg ?? "";
    p.classList.toggle("hidden", !msg);
  });
}

function ligarAdmin(): void {
  el<HTMLFormElement>("form-usuario").addEventListener("submit", (e) => {
    e.preventDefault();
    void (async () => {
      const v = (id: string): string => el<HTMLInputElement>(id).value.trim();
      try {
        const arquivo = el<HTMLInputElement>("u_foto").files?.[0];
        const fotoBase64 = arquivo ? await prepararFoto(arquivo) : undefined;
        const u = await cadastrarUsuario(await window.finDesk!.config(), {
          nome: v("u_nome"), email: v("u_email"), pin: v("u_pin"),
          admin: el<HTMLInputElement>("u_admin").checked, fotoBase64,
        });
        el<HTMLFormElement>("form-usuario").reset();
        mostrarErrosForm("form-usuario", {});
        notificar(`Conta de ${u.nome} criada. A bolinha já aparece em "Quem está usando?".`);
        document.body.dataset.usuarioCriado = u.nome;
        await recarregarAdmin();
      } catch (falha) {
        if (falha instanceof ErroValidacaoApi) mostrarErrosForm("form-usuario", falha.campos);
        else notificar(mensagem(falha, "Não foi possível cadastrar."), "erro");
      }
    })();
  });
  editor = criarEditorCampo([
    { valor: "nome", rotulo: "Nome" },
    { valor: "email", rotulo: "E-mail (login)" },
  ], (campo) => {
    const u = selecionado();
    return !u ? "" : campo === "nome" ? u.nome : u.email ?? u.login;
  });
  el("btnApplyChange").addEventListener("click", () => {
    const u = selecionado();
    if (!u || !editor) return;
    const campo = editor.campo();
    const valor = editor.ler().trim();
    void (async () => {
      try {
        await atualizarUsuario(await window.finDesk!.config(), u.id, { [campo]: valor });
        editor!.erro();
        notificar("Alteração salva.");
        await recarregarAdmin();
      } catch (falha) {
        editor!.erro(mensagem(falha, "Não foi possível salvar."));
      }
    })();
  });
  el("btnClearSelection").addEventListener("click", fecharEditor);
  el("btnAdmin").addEventListener("click", () => void acao((cfg, u) => atualizarUsuario(cfg, u.id, { admin: !u.admin }), "Perfil de administrador alterado."));
  el("btnAtivo").addEventListener("click", () => void acao((cfg, u) => atualizarUsuario(cfg, u.id, { ativo: !u.ativo }), "Situação da conta alterada."));
  el("btnRemoverFoto").addEventListener("click", () => void acao((cfg, u) => trocarFotoDoUsuario(cfg, u.id, null), "Foto removida."));
  const inputFoto = el<HTMLInputElement>("inputFoto");
  el("btnTrocarFoto").addEventListener("click", () => inputFoto.click());
  inputFoto.addEventListener("change", () => {
    const arquivo = inputFoto.files?.[0];
    inputFoto.value = "";
    if (arquivo) void acao(async (cfg, u) => trocarFotoDoUsuario(cfg, u.id, await prepararFoto(arquivo)), "Foto trocada.");
  });
  el("btnExcluir").addEventListener("click", () => {
    const u = selecionado();
    if (!u) return;
    void confirmarExclusao(`a conta de "${u.nome}" (o histórico de acessos fica guardado)`).then((ok) => {
      if (ok) void acao((cfg) => excluirUsuario(cfg, u.id), "Conta excluída.");
    });
  });
  el<HTMLFormElement>("form-novo-pin").addEventListener("submit", (e) => {
    e.preventDefault();
    const pin = el<HTMLInputElement>("novo_pin").value;
    if (!/^\d{4,6}$/.test(pin)) return erroEm("erro-novo-pin", "O PIN tem de 4 a 6 números.");
    erroEm("erro-novo-pin");
    void acao((cfg, u) => novoPinDoUsuario(cfg, u.id, pin), "PIN novo salvo (e a conta foi desbloqueada).").then(() => {
      el<HTMLInputElement>("novo_pin").value = "";
    });
  });
}

export function iniciarContas(): void {
  const perfil = exigirPerfil();
  if (!perfil) return;
  montarNavbar("usuarios");
  document.querySelectorAll<HTMLInputElement>("#meu_atual, #meu_novo, #meu_novo2, #u_pin, #novo_pin").forEach((i) => {
    i.addEventListener("input", () => {
      i.value = i.value.replace(/\D/g, "").slice(0, 6);
    });
  });
  el<HTMLFormElement>("form-meu-pin").addEventListener("submit", (e) => {
    e.preventDefault();
    void trocarPin();
  });
  void carregarMinhaConta().catch((falha) => {
    if (falha instanceof ErroApi && falha.status === 401) void window.finDesk!.navegar("perfis");
  });
  if (perfil.admin) {
    // admin troca o proprio PIN (e o de qualquer conta) so na conta selecionada, la embaixo
    el("form-meu-pin").classList.add("hidden");
    el("area-admin").classList.remove("hidden");
    el("selo-admin").classList.remove("hidden");
    ligarAdmin();
    void recarregarAdmin().then(() => {
      document.body.dataset.adminCarregado = "true";
      // o nome do admin pode ter mudado: atualiza a bolinha da barra
      const eu = usuarios.find((u) => u.id === perfil.id);
      if (eu && eu.nome !== perfil.nome) definirPerfil({ ...perfil, nome: eu.nome });
    }).catch((falha) => notificar(mensagem(falha, "Não foi possível carregar as contas."), "erro"));
  }
}
