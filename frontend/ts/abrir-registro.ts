// Abrir um registro ja existente direto na area de edicao de outra tela (pedido do usuario,
// 2026-11-24): no Inserir Conta, "SIM, EDITAR A CONTA QUE JA EXISTE" leva ao Controle (Todas as
// Contas) ou as Contas Recorrentes com a conta ja aberta. O id vai pelo sessionStorage e e
// lido uma vez so pela tela de destino.
const CHAVE = "contas.abrirRegistro";

export type DestinoRegistro = "conta" | "recorrente";

export function pedirAbertura(tipo: DestinoRegistro, id: number): void {
  try {
    sessionStorage.setItem(CHAVE, JSON.stringify({ tipo, id }));
  } catch {
    // sem sessionStorage: a tela abre sem nada selecionado
  }
}

/** Id pedido para esta tela (e apaga o pedido), ou null. */
export function aberturaPedida(tipo: DestinoRegistro): number | null {
  try {
    const pedido = JSON.parse(sessionStorage.getItem(CHAVE) ?? "null") as { tipo?: string; id?: number } | null;
    if (!pedido || pedido.tipo !== tipo || typeof pedido.id !== "number") return null;
    sessionStorage.removeItem(CHAVE);
    return pedido.id;
  } catch {
    return null;
  }
}
