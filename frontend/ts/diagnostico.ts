// Sondagem leve de eventos de interacao (diagnostico do bug de inputs).
// Os eventos ficam apenas em memoria (buffer limitado) e somente sao gravados
// em arquivo pelo processo principal quando FINDESK_DIAG_DIR esta definido.
// Nunca registra valores digitados: apenas id do alvo, tamanho e teclas nao-imprimiveis.

interface EventoDiag {
  t: number;
  tipo: string;
  alvo: string;
  hf: number;
  extra?: unknown;
}

const MAX_EVENTOS = 800;
const eventos: EventoDiag[] = [];

function alvoDe(ev: Event): string {
  const el = ev.target as HTMLElement | null;
  if (!el) return "-";
  const id = el.id ? `#${el.id}` : "";
  return `${el.tagName}${id}`;
}

function registrar(tipo: string, ev: Event, extra?: unknown): void {
  eventos.push({ t: Date.now(), tipo, alvo: alvoDe(ev), hf: document.hasFocus() ? 1 : 0, extra });
  if (eventos.length > MAX_EVENTOS) eventos.splice(0, eventos.length - MAX_EVENTOS);
}

export function iniciarDiagnostico(): void {
  document.addEventListener("pointerdown", (ev) => registrar("pointerdown", ev), true);
  document.addEventListener("mousedown", (ev) => registrar("mousedown", ev), true);
  document.addEventListener("click", (ev) => registrar("click", ev), true);
  document.addEventListener("focusin", (ev) => registrar("focusin", ev), true);
  document.addEventListener("focusout", (ev) => registrar("focusout", ev), true);
  document.addEventListener(
    "keydown",
    (ev) => {
      const tecla = (ev as KeyboardEvent).key;
      registrar("keydown", ev, { key: tecla.length > 1 ? tecla : "*" });
    },
    true
  );
  document.addEventListener(
    "input",
    (ev) => {
      const alvo = ev.target as HTMLInputElement | null;
      const len = alvo && typeof alvo.value === "string" ? alvo.value.length : -1;
      registrar("input", ev, { len });
    },
    true
  );
  window.addEventListener("blur", () => registrar("win-blur", new Event("-")));
  window.addEventListener("focus", () => registrar("win-focus", new Event("-")));

  (window as unknown as { __diagColetar?: () => EventoDiag[] }).__diagColetar = () =>
    eventos.splice(0, eventos.length);
}
