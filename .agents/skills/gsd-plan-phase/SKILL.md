---
name: gsd-plan-phase
description: >
  Planejamento disciplinado de fases de desenvolvimento (GSD Plan).
  Compreende objetivos de entrega, triangula requisitos com o contexto persistente,
  identifica dependências e riscos, divide o trabalho em fatias verticais finas,
  estabelece critérios de aceitação e integra com o Memory Bank (.memory-bank/).
triggers:
  - "gsd plan"
  - "planejar fase"
  - "planejamento"
  - "plano de entrega"
  - "decompor tarefa"
origin: "GSD Core Framework (Get Shit Done) adaptado para OpenCode e Chaveiro Universal"
license: "MIT"
---

# GSD Plan Phase — Planejamento Disciplinado de Entregas

Diretrizes para planejar e estruturar fases de entrega no **Sistema de Contas a Pagar — Chaveiro Universal**, eliminando a degradação de contexto ("context rot") e garantindo planos executáveis e verificáveis.

---

## 1. Fluxo de Planejamento GSD

```text
[ Compreensão do Escopo ] ──► [ Triangulação de Contexto ] ──► [ Decomposição em Fatias ] ──► [ Plano & Memory Bank ]
      (Objetivo)                 (Memory Bank + Banco)             (Tarefas Atômicas)              (activeContext.md)
```

---

## 2. Etapas Obrigatórias do Planejador

### Etapa 1: Compreensão do Escopo e Fronteiras
1. Identificar o objetivo central da fase (ex.: "Entrega 3.3: Cadastro de Empresa").
2. Delimitar estritamente o que **está** no escopo e o que **não está** (YAGNI).
3. Nunca planejar múltiplas entidades complexas simultaneamente; focar em uma única fatia de negócio por vez.

### Etapa 2: Triangulação com o Contexto Persistente
Antes de escrever código ou planos abstratos, consultar:
1. [`.memory-bank/activeContext.md`](../../../.memory-bank/activeContext.md) (foco atual e decisões consolidadas).
2. [`.memory-bank/systemPatterns.md`](../../../.memory-bank/systemPatterns.md) (invariantes arquiteturais).
3. Esquema atual do SQLite (tabelas existentes e versão em `PRAGMA user_version`).
4. Especificações de telas e contratos de API já implementados para manter consistência cromática e estrutural.

### Etapa 3: Identificação de Dependências e Riscos Técnicos
1. **Impacto no Banco de Dados:** A alteração exige nova versão de esquema? (Apenas migrações aditivas são permitidas; proibido `DROP TABLE`).
2. **Impacto na Interface:** Quais campos são obrigatórios e quais são opcionais? Quais máscaras e validações são necessárias (CNPJ, CPF, Moeda)?
3. **Isolamento de Testes:** Garantir que todos os testes planejados apontem para `FINDESK_DB_PATH` temporário.

### Etapa 4: Decomposição em Fatias Verticais Finas (Thin Vertical Slices)
Dividir a entrega na ordem natural de dependência técnica:
1. **Tarefa 1 (Banco de Dados):** Script de migração aditiva versionada (`PRAGMA user_version = N`).
2. **Tarefa 2 (Modelo & Repositório):** Java 21 `record` do domínio e classe Repository com JDBC puro e PreparedStatements parametrizados.
3. **Tarefa 3 (Serviço & Regras de Negócio):** Service com validações de negócio e suíte de testes unitários com JUnit 5 + AssertJ.
4. **Tarefa 4 (API REST):** Controller com DTOs em `record`, Bean Validation (`@Valid`), rotas REST semânticas e tratamento de exceção.
5. **Tarefa 5 (Interface do Usuário):** HTML semântico + Vanilla TypeScript + Tailwind CSS (com estados de loading, empty e error).
6. **Tarefa 6 (Validação de Ponta a Ponta):** Smoke tests sintéticos, testes de entrada real com mouse/teclado (`smoke-real.js`) e teste de persistência.

### Etapa 5: Definição de Critérios de Aceitação Verificáveis
Cada tarefa do plano deve conter critérios de aceitação explícitos e mensuráveis:
- [ ] Compilação Java sem avisos críticos (`mvn compile`).
- [ ] Tipagem e empacotamento TypeScript sem erros (`npm run typecheck`).
- [ ] Suíte JUnit cobrindo regras de negócio e validações de borda.
- [ ] Interação na UI validada via eventos reais no Windows.
- [ ] Banco operacional intacto e isolado durante os testes.

### Etapa 6: Registro do Plano no Memory Bank
Finalizado o planejamento, registrar o roadmap e os critérios em `.memory-bank/activeContext.md` para que as próximas sessões do agente herdem o plano imediatamente, sem consumo desnecessário de tokens.
