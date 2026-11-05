import { buscarStatus, buscarContas } from "./api";

async function iniciar(): Promise<void> {
  try {
    if (!window.finDesk) {
      throw new Error("configuração indisponível");
    }
    const cfg = await window.finDesk.config();
    const status = await buscarStatus(cfg);
    const contas = await buscarContas(cfg);
    document.body.dataset.apiStatus = "ok";
    document.title += " — API OK";
    console.info("[FinDesk] API:", status, "| contas de teste:", contas.length);
  } catch (erro) {
    document.body.dataset.apiStatus = "erro";
    document.title += " — API OFFLINE";
    console.error("[FinDesk] falha na API:", erro);
  }
}

iniciar();
