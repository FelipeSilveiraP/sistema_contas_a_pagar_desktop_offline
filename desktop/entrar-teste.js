// Testes automaticos: o sistema abre em "Quem esta usando?" (contas com PIN). Este
// ajudante cria (so no banco TEMPORARIO do teste) a conta "TESTE ADMIN" com PIN 2468,
// entra com ela pela API, guarda a sessao como a tela faria e vai para o Menu.
// Uso: await entrarParaTeste(js) — `js` executa codigo na janela e devolve o resultado.

const CODIGO_ENTRAR = `(async () => {
  const cfg = await window.finDesk.config();
  const h = { 'X-FinDesk-Token': cfg.token, 'Content-Type': 'application/json' };
  const base = 'http://127.0.0.1:' + cfg.port + '/api';
  const lista = await (await fetch(base + '/perfis', { headers: h })).json();
  let r;
  if (lista.primeiroAcesso) {
    r = await fetch(base + '/perfis/primeiro-admin', { method: 'POST', headers: h,
      body: JSON.stringify({ nome: 'TESTE ADMIN', login: 'teste.admin', email: 'teste@exemplo.com', pin: '2468' }) });
  } else {
    const p = lista.perfis.find((x) => x.nome === 'TESTE ADMIN') || lista.perfis[0];
    r = await fetch(base + '/sessao', { method: 'POST', headers: h, body: JSON.stringify({ idUsuario: p.id, pin: '2468' }) });
  }
  if (!r.ok) return 'falhou: HTTP ' + r.status;
  const s = await r.json();
  sessionStorage.setItem('contas.perfil', JSON.stringify({ id: s.id, nome: s.nome, admin: s.admin, token: s.token }));
  await window.finDesk.navegar('menu');
  return 'ok';
})()`;

async function entrarParaTeste(js, limiteMs = 60000) {
  const fim = Date.now() + limiteMs;
  while (Date.now() < fim) {
    const tela = await js("document.body && document.body.dataset.tela").catch(() => null);
    if (tela === "menu") return true;
    if (tela === "perfis" && (await js("document.body.dataset.perfisCarregados !== undefined || document.body.dataset.primeiroAcesso !== undefined").catch(() => false))) {
      const r = await js(CODIGO_ENTRAR).catch((e) => String(e));
      if (r !== "ok") throw new Error(`entrarParaTeste: ${r}`);
    }
    await new Promise((ok) => setTimeout(ok, 150));
  }
  return false;
}

module.exports = { entrarParaTeste };
