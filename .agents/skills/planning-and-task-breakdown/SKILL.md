---
name: planning-and-task-breakdown
description: >
  Diretrizes para planejamento incremental de software e decomposição atômica de tarefas.
  Divide entregas em fatias verticais testáveis, estabelece portões de verificação (gates),
  e integra-se com o Memory Bank local (.memory-bank/) para economizar contexto e tokens.
triggers:
  - "planejar"
  - "plano"
  - "etapas"
  - "decomposição"
  - "fatias verticais"
origin: "Adaptado de addyosmani/agent-skills (Repositório Público GitHub addyosmani/agent-skills, licença MIT confirmada) e integrado ao .memory-bank/ local"
license: "MIT (Addy Osmani / agent-skills) + Adaptação Local"
---

# Planning & Task Breakdown

Diretrizes para planejar e estruturar o desenvolvimento em etapas atômicas, incrementais e verificáveis.

## 1. Princípio das Fatias Verticais Finas (Thin Vertical Slices)

Evite o padrão "camada por camada" (fazer todo o banco, depois todas as APIs, depois todas as telas).
Em vez disso, entregue uma **fatia vertical completa por entidade de negócio**:
1. Tabela SQLite e migração aditiva.
2. Model Record e Repository JDBC testado.
3. Service com regras de validação e testes unitários JUnit 5.
4. Endpoint REST (Controller) com Bean Validation.
5. Tela HTML + TypeScript Vanilla + CSS.
6. Teste de fumaça e persistência de ponta a ponta.

## 2. Portões de Verificação (Verification Gates)

Cada fatia de entrega deve passar por três critérios obrigatórios antes de avançar para a próxima:
1. **Compilação e Tipagem:** `npm run typecheck` e compilação do Maven (`mvn compile`) sem avisos graves.
2. **Testes Automatizados:** Suíte de testes unitários e de integração verde.
3. **Validação Operacional:** Smoke test executado com sucesso e captura visual de tela registrada para conferência do usuário.

## 3. Preservação de Contexto via Memory Bank Local

Para evitar reanalisar arquivos repetidamente e desperdiçar consumo de tokens da API:
1. **Consulte Primeiro o Memory Bank:** Antes de ler dezenas de arquivos no workspace, consulte `.memory-bank/activeContext.md` e `.memory-bank/systemPatterns.md`.
2. **Registre Decisões Consolidadas:** Sempre que uma regra de negócio ou padrão for aprovado pelo usuário, atualize o Memory Bank para que sessões futuras herdem o conhecimento imediatamente.
3. **Mantenha os Arquivos Concisos:** Nunca copie código-fonte bruto para arquivos de planejamento; utilize referências a arquivos e resumos estruturados.

