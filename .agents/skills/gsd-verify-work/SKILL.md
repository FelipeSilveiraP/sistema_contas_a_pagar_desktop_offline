---
name: gsd-verify-work
description: >
  Verificação e auditoria de qualidade de entregas (GSD Verify).
  Compara o resultado com o plano, audita critérios de aceitação, orquestra testes
  automatizados (JUnit 5, smoke tests, testes reais via PowerShell SendInput e persistência),
  garante isolamento do banco operacional e documenta evidências para validação humana.
triggers:
  - "gsd verify"
  - "verificar entrega"
  - "validação"
  - "auditar entrega"
  - "critérios de aceitação"
origin: "GSD Core Framework (Get Shit Done) adaptado para OpenCode e Chaveiro Universal"
license: "MIT"
---

# GSD Verify Work — Verificação & Auditoria de Entregas

Diretrizes para coordenar a verificação de ponta a ponta das entregas construídas pelo `gsd-execute-phase`, garantindo que nenhuma funcionalidade seja considerada pronta sem prova cabal de funcionamento.

---

## 1. O Papel do Coordenador de Verificação

A skill `gsd-verify-work` atua como **maestro da verificação**, orquestrando as skills de teste especializadas:

```text
                               [ GSD Verify Work ]
                         (Coordenação & Auditoria Geral)
                                       │
        ┌──────────────────────────────┼──────────────────────────────┐
        ▼                              ▼                              ▼
[ tdd-junit5-assertj ]      [ desktop-smoke-testing ]     [ debugging-and-error-recovery ]
(Regras & API REST Backend) (UI, Foco Real & Persistência) (Triagem e Resolução de Falhas)
```

---

## 2. Roteiro de Verificação em 5 Etapas

### Etapa 1: Auditoria de Critérios de Aceitação
1. Reler os critérios de aceitação definidos no plano (`gsd-plan-phase`).
2. Verificar item a item se todos os requisitos foram atendidos.
3. Se houver funcionalidade planejada que não foi implementada, registrar explicitamente como pendência ou lacuna ("gap").

### Etapa 2: Verificação do Backend (Testes Unitários & Integração)
Acionar a skill [`tdd-junit5-assertj`](../tdd-junit5-assertj/SKILL.md):
```bash
mvn -f backend/pom.xml test
```
- Verificar cobertura de casos de sucesso, valores limite e cenários de erro (ex.: 400 Bad Request em dados inválidos, 404 em id inexistente, 409 em violação de chave estrangeira).
- Todos os testes devem rodar em ambiente isolado e passar com 100% de sucesso.

### Etapa 3: Verificação da Interface Desktop & Foco no Windows
Acionar a skill [`desktop-smoke-testing`](../desktop-smoke-testing/SKILL.md):
1. **Smoke Sintético Completo:**
   ```bash
   node desktop/smoke.js
   ```
   Valida carregamento de telas, ausência de erros no console, rotas de navegação, responsividade e layout.
2. **Teste de Entrada Real do SO (SendInput via PowerShell):**
   ```bash
   node desktop/smoke-real.js
   ```
   Valida que a janela do Electron recebe ativação real no Windows, que o cursor clica fisicamente nos campos, que o teclado digita sem bloqueios e que os botões respondem a cliques físicos reais.

### Etapa 4: Verificação de Persistência em Cold Start
Executar o ciclo completo de persistência:
```bash
node desktop/teste-persistencia.js
```
- Valida que um registro criado é persistido fisicamente no SQLite e recuperado após o encerramento forçado e reabertura do aplicativo.
- **Auditoria de Banco:** Confirmar que o banco operacional oficial permaneceu 100% intocado e que os testes usaram exclusivamente `FINDESK_DB_PATH` temporário.

### Etapa 5: Resolução de Falhas e Coleta de Evidências
1. **Se algum teste falhar:**
   - Acionar imediatamente a skill [`debugging-and-error-recovery`](../debugging-and-error-recovery/SKILL.md).
   - Aplicar o método de 5 passos (Parar a Linha, Reproduzir, Localizar, Reduzir, Corrigir e Proteger).
   - Nunca mascarar testes quebrando ou remover asserções para fazer a suíte passar.
2. **Coleta de Evidências e Registro:**
   - Registrar evidências visuais (capturas de tela em `docs/responsivo/` nas resoluções 1536x864, 768x800 e 480x800).
   - Atualizar [`.memory-bank/progress.md`](../../.memory-bank/progress.md) e [`.memory-bank/activeContext.md`](../../.memory-bank/activeContext.md).
   - Apresentar o resultado detalhado com evidências para validação humana do proprietário.
