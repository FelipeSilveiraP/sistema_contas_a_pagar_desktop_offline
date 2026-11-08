interface EstadoInicializacao {
  estado: "aguardando" | "pronto" | "falhou";
}

function mostrarErro(): void {
  document.getElementById("iniciando")?.classList.add("hidden");
  document.getElementById("erro-inicializacao")?.classList.remove("hidden");
}

function mostrarIniciando(): void {
  document.getElementById("erro-inicializacao")?.classList.add("hidden");
  document.getElementById("iniciando")?.classList.remove("hidden");
}

export function iniciarCarregando(): void {
  const finDesk = window.finDesk;
  if (!finDesk) return;

  finDesk
    .estadoInicializacao()
    .then((estado: EstadoInicializacao) => {
      if (estado.estado === "falhou") mostrarErro();
    })
    .catch(() => mostrarErro());

  finDesk.onInicializacao((estado: EstadoInicializacao) => {
    if (estado.estado === "falhou") mostrarErro();
  });

  document.getElementById("btn-tentar-novamente")?.addEventListener("click", async (evento) => {
    const botao = evento.currentTarget as HTMLButtonElement;
    botao.disabled = true;
    mostrarIniciando();
    try {
      const resultado = (await finDesk.reiniciarBackend()) as { ok: boolean };
      if (!resultado.ok) mostrarErro();
    } catch {
      mostrarErro();
    } finally {
      botao.disabled = false;
    }
  });

  document.getElementById("btn-fechar")?.addEventListener("click", () => {
    void finDesk.fecharAplicativo();
  });

  console.info("[ContasAPagar] tela de carregamento iniciada");
}
