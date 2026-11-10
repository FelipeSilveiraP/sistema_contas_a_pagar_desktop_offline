---
name: fluxo-de-entrega
description: Processo de planejar, executar e verificar uma entrega (fatia vertical) neste projeto — do SQLite até a tela, com portões de teste e registro de contexto. Use ao iniciar uma nova funcionalidade, tela ou entrega, ao planejar tarefas, ou antes de declarar algo pronto.
---

# Fluxo de entrega (planejar → executar → verificar)

Consolida as antigas `gsd-plan-phase`, `gsd-execute-phase`, `gsd-verify-work`, `planning-and-task-breakdown` e `project-memory-bank` (o memory bank foi substituído por `docs/estado-atual.md` + `docs/decisoes.md`).

## 1. Planejar

1. Leia o contexto antes de varrer o código: `docs/estado-atual.md` e `docs/decisoes.md`.
2. Defina o escopo: o que **entra** e o que **não entra** (YAGNI). Uma entidade de negócio por entrega.
3. Triangule as fontes, nesta ordem de autoridade:
   - **design:** Stitch (`docs/stitch/<tela>.html`, `telas_referencia/`);
   - **requisitos:** `BRIEFING_PROJETO.md` e `docs/plano-telas.md`;
   - **regra de negócio:** VBA original (`vba/`, fora do Git).
4. Liste os riscos:
   - Precisa de migração nova? Ela tem que ser aditiva (ver skill `sqlite-financeiro`).
   - Quais campos são obrigatórios e quais máscaras usam?
   - Toca dinheiro ou status? Então a operação precisa de transação.
5. Quebre em fatias verticais, na ordem de dependência:
   1. migração (`DatabaseInitializer`, `VERSAO_ATUAL + 1`);
   2. record em `model/` + `repository/`;
   3. `service/` com regras e testes JUnit;
   4. `api/` controller;
   5. tela: HTML + TS (ver skill `frontend-telas`);
   6. smoke e persistência.
6. Dê a cada tarefa um critério de aceitação verificável (um comando que passa, um comportamento observável).
7. Mostre o plano ao dono do projeto antes de implementar algo grande.

## 2. Executar

- **O plano é contrato:** não adicione bibliotecas, camadas ou abstrações fora do plano.
- **Ordem estrita:** não faça a tela antes da API compilar e passar nos testes.
- **Débito fora de escopo:** anote em vez de corrigir agora.
- **Checkpoint após cada tarefa:**
  - mexeu no TS: `npm run typecheck`;
  - mexeu no Java: `mvn -f backend/pom.xml test`;
  - mexeu na UI: `npm run build` + `npx electron desktop/smoke.js`.
- **Checkpoint falhou:** pare e corrija antes de seguir. Use a skill `depuracao`.
- **Bloqueio ou divergência** (campo que não existe no modelo, regra ambígua do VBA): não adivinhe. Pergunte ao dono, com alternativas.

## 3. Verificar (antes de dizer "pronto")

Rode tudo, nesta ordem (detalhes na skill `testes`):

```bash
npm run typecheck && npm run build
mvn -f backend/pom.xml package           # roda o JUnit e gera o jar usado pelo Electron
npx electron desktop/smoke.js
npx electron desktop/smoke-boot.js
node desktop/teste-persistencia.js
npx electron desktop/smoke-real.js       # entrada real: não usar o PC durante
node desktop/smoke-dev.js                # regressão obrigatória do bug de foco
```

- Releia os critérios de aceitação item a item e liste o que ficou de fora.
- **Nunca** remova uma asserção nem afrouxe um teste para a suíte passar.
- Confirme que nenhum teste tocou o banco operacional (todos usam `FINDESK_DB_PATH` temporário).
- Apresente o resultado com números (X/Y testes) e as capturas de `docs/responsivo/`.

## 4. Registrar

- Ao fechar a entrega: **reescreva** `docs/estado-atual.md` (máx. 30 linhas: foco, situação, pendências) e acrescente cada decisão nova em `docs/decisoes.md` (2–3 linhas, com data). Sem colar código.
- Faça commits locais atômicos numa branch de feature. **Nunca commit direto na `main` e nunca `git push` sem ordem explícita.**
