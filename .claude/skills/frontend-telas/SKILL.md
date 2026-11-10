---
name: frontend-telas
description: Como criar e alterar telas, formulários e tabelas no frontend TypeScript puro deste projeto (sem frameworks) — DOM seguro, diálogos, máscaras, navegação, estados de carregamento/erro, responsividade e fidelidade ao Stitch. Use ao mexer em frontend/html, frontend/ts ou no Tailwind.
---

# Frontend: telas em TypeScript puro

Consolida `vanilla-typescript-dom` e `frontend-ui-engineering`.

## Criar uma tela nova (checklist)

1. **HTML:** `frontend/html/<tela>.html`, uma casca fina com `<body data-tela="<tela>">`, CSP copiada de uma tela existente e o `app.js`.
2. **TS:** `frontend/ts/telas/<tela>.ts`, exportando `iniciar<Tela>()`.
3. **`frontend/ts/main.ts`:** `case "<tela>"` com `await import("./telas/<tela>")`, para manter o code splitting.
4. **`desktop/main.js`:** registrar a chave no `Map TELAS` (whitelist de navegação).
5. **Navbar:** se for tela filha, mapear o módulo em `MODULO_DA_TELA` (`navbar.ts`).
6. **Fidelidade:** comparar com `docs/stitch/<tela>.html` e o PNG em `telas_referencia/`.

## Regras obrigatórias

- **DOM seguro:** use `createElement`, `textContent` e `setAttribute`. **Proibido `innerHTML` com qualquer dado** (risco de XSS). Para estruturas repetidas, use `<template>` + `cloneNode`.
- **Diálogos:** só via `dialogos.ts`, com as funções `confirmar`, `confirmarExclusao`, `confirmarDuplicidade`, `aviso`, `sucesso`, `erro`, `informacao` e `recorrencia`. Nunca `window.alert/confirm/prompt`.
- **Guardas de teclado e clique dos formulários:** cheque `dialogoEstaAberto()` e `menuLateralAberto()`. ESC com o menu lateral aberto fecha o menu, não o formulário.
- **Máscaras:** use `mascaras.ts` (moeda por centavos, CPF, CNPJ, telefone, CEP, data dd/mm/aaaa). Não reimplemente.
- **Navegação:** use `navegacao.ts` (`irPara`, `voltar`, `menuPrincipal`). A pilha fica em `sessionStorage`.
- **API:** use `api.ts`, que já envia o `X-FinDesk-Token`. O frontend **não** calcula regra financeira: valida formato e mostra o erro que o backend devolve.
- **Delegação de eventos:** em tabelas, um listener no container + `closest('[data-acao]')`. Remova listeners e timers globais ao sair.

## UX de formulários e listas

- **Três estados em todo fluxo assíncrono:**
  - **carregando:** botão desabilitado;
  - **vazio:** mensagem com o próximo passo;
  - **erro:** recuperável, sem perder o que foi digitado.
- Todo `<input>` tem um `<label for>`. A ordem do TAB é lógica. O erro aparece por campo (borda vermelha + texto abaixo), usando o mapa `campos` do 400 do backend.
- **Formulário sujo:** confirme antes de sair por ESC, VOLTAR ou navbar, via `confirmar()`.
- **Público leigo:** botões grandes, alto contraste, textos diretos. Siga o estilo neobrutalista do Stitch (borda preta grossa, sombra dura) e as cores de módulo (MENU `#FFE600`, CADASTROS `#FF8C00`, CONTROLE `#2563EB`, MENSAGENS `#FF5E89`, GRÁFICOS `#00FF66`).

## Responsividade

- Faixas testadas: 480, 600, 768, 960, 1280, 1536 e 1920 px. Barra de navegação desktop a partir de ~851 px; abaixo disso, hambúrguer.
- Os cartões dos submenus têm largura fixa por faixa (padrão compartilhado `.submenu-grade`/`.submenu-cartao`). A quantidade de cartões não muda as dimensões.
- Sem rolagem horizontal em nenhuma faixa.

## Build

- O Tailwind varre também `frontend/ts/**`, então as classes podem estar no TS.
- `npm run build` = `tsc --noEmit` (estrito) + Tailwind + esbuild (`--splitting`, ESM, es2022).
- **Offline:** nada de CDN ou fontes remotas.
