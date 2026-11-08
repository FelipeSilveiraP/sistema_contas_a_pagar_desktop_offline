---
name: vanilla-typescript-dom
description: >
  Diretrizes para desenvolvimento com TypeScript puro sem frameworks (sem React, Vue ou Angular).
  Manipulação segura do DOM, prevenção de XSS, gerenciamento limpo de event listeners,
  componentes reutilizáveis com funções puras e empacotamento com esbuild.
triggers:
  - "typescript"
  - "dom"
  - "sem framework"
  - "vanilla"
  - "esbuild"
  - "xss"
origin: "Autoral / Padrões de Desenvolvimento Web do Projeto Chaveiro Universal"
license: "Autoral / Propriedade do Projeto Chaveiro Universal"
---

# Vanilla TypeScript & Safe DOM Engineering

Diretrizes para criar aplicações ricas e rápidas usando TypeScript puro, sem dependências de frameworks volumosos.

## 1. Manipulação Segura do DOM & Prevenção Total de XSS

1. **Proibição Estrita de `innerHTML` com Variáveis:**
   - **ERRADO:** `container.innerHTML = `<div>${usuario.nome}</div>`;` (Vulnerável a XSS)
   - **CORRETO:** Use `document.createElement()`, `textContent`, e `setAttribute()`:
     ```typescript
     const item = document.createElement("div");
     item.className = "p-3 font-medium text-slate-800";
     item.textContent = usuario.nome;
     container.appendChild(item);
     ```
2. **Template Elements para Estruturas Repetitivas:**
   - Utilize `<template>` em HTML estático e clone nós (`template.content.cloneNode(true)`) populando os dados via nós de texto tipados.

## 2. Componentes Reutilizáveis com Funções Puras

Em TypeScript puro, um "componente" é simplesmente uma função tipada que recebe dados e retorna um elemento DOM ou atualiza um container existente:
```typescript
interface BotaoAcaoProps {
  rotulo: string;
  variante?: "primario" | "perigo" | "neutro";
  onClick: () => void;
}

export function criarBotaoAcao(props: BotaoAcaoProps): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = props.rotulo;
  btn.className = props.variante === "perigo" 
    ? "bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded" 
    : "bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-2 px-4 rounded";
  btn.addEventListener("click", props.onClick);
  return btn;
}
```

## 3. Gerenciamento de Eventos e Prevenção de Memory Leaks

1. **Delegação de Eventos:** Para listas ou tabelas com muitos itens, adicione o listener no container pai e use `event.target.closest('[data-acao]')` em vez de criar dezenas de listeners individuais.
2. **Ciclo de Vida Limpo:** Ao substituir telas ou remover elementos que possuem timers ou listeners globais (`window.addEventListener`), faça a devida remoção (`removeEventListener` / `clearTimeout`).

## 4. Despacho por Página e Code Splitting com esbuild

1. Cada tela HTML declara seu identificador no body: `<body data-tela="form-banco">`.
2. O script de entrada principal (`main.ts`) faz o roteamento leve:
   ```typescript
   const telaAtual = document.body.dataset.tela;
   switch (telaAtual) {
     case "menu": inicializarMenu(); break;
     case "form-banco": inicializarFormBanco(); break;
   }
   ```
3. O build via `esbuild` mantém o bundle enxuto com flags modernas:
   `esbuild frontend/ts/main.ts --bundle --outdir=frontend/dist --format=esm --target=es2022`.

