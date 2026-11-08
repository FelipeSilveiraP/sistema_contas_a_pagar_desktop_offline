---
name: gsd-execute-phase
description: >
  Execução disciplinada de tarefas planejadas (GSD Execute).
  Lê o plano aprovado, executa alterações na ordem correta de dependência,
  aplica mudanças incrementais focadas, valida checkpoints técnicos intermediários
  e preserva o escopo sem desvios ou push automático.
triggers:
  - "gsd execute"
  - "executar fase"
  - "execução"
  - "implementar plano"
origin: "GSD Core Framework (Get Shit Done) adaptado para OpenCode e Chaveiro Universal"
license: "MIT"
---

# GSD Execute Phase — Execução Disciplinada e Incremental

Diretrizes para guiar o agente na execução ordenada das tarefas planejadas pelo `gsd-plan-phase`, garantindo passos incrementais e verificados sem poluição de contexto ou quebra do sistema.

---

## 1. Princípios Fundamentais de Execução

1. **Plano é Contrato:** Executar exatamente o que foi planejado. Não adicione bibliotecas, camadas ou abstrações especulativas não descritas no plano.
2. **Ordem Estrita de Dependência:** Nunca inicie o frontend antes que a API esteja compilando e testada; nunca crie o repository antes da migração do banco.
3. **Escopo Focado:** Proibido alterar arquivos fora da fatia vertical atual. Se encontrar um débito técnico não relacionado, registre-o no Memory Bank em vez de corrigi-lo de imediato.
4. **Zero Push Automático:** Toda alteração é commitada localmente de forma atômica e organizada. O envio (`git push`) depende sempre de ordem explícita do proprietário.

---

## 2. Ciclo de Execução por Tarefa

Para cada tarefa definida no plano:

```text
[ Carregar Tarefa ] ──► [ Implementar Alteração ] ──► [ Checkpoint Imediato ] ──► [ Registrar Conclusão ]
  (Ordem do Plano)          (Código Focado)             (Compilar / Tipar)            (Memory Bank)
```

### Passo 1: Leitura e Foco
- Carregar o contexto da tarefa atual e a skill técnica especializada correspondente (ex.: `spring-boot-rest-craft` para Controllers, `vanilla-typescript-dom` para formulários).
- Não carregar todas as skills do repositório simultaneamente.

### Passo 2: Implementação Incremental
- Escrever o código mínimo que satisfaça a tarefa (filosofia `ponytail`).
- Utilizar arquivos existentes e padrões já consolidados no projeto.
- Manter formatação uniforme e comentários explicativos preservados.

### Passo 3: Portão de Verificação Intermediário (Checkpoint)
Imediatamente após modificar arquivos, executar a verificação da camada:
* **Frontend TypeScript:** Executar `npm run typecheck` e conferir se não há erros de tipagem.
* **Backend Java:** Executar `mvn compile` no diretório correspondente.
* **Se o checkpoint falhar:** **Pare a linha imediatamente.** Não avance para a tarefa seguinte acumulando erros. Corrija o problema no escopo atual.

### Passo 4: Registro de Progresso
- Concluída a tarefa com sucesso, atualizar o status em `.memory-bank/activeContext.md`.
- Se a entrega atingir um marco estável, criar commit local limpo e sem misturar arquivos de trabalho.

---

## 3. Gestão de Bloqueios e Divergências

Se durante a execução surgir uma divergência inesperada (ex.: campo que não constava no modelo, conflito de chave estrangeira ou limitação técnica):
1. **Não adivinhe:** Interrompa a execução da tarefa atual.
2. **Isole o problema:** Registre a causa exata do bloqueio com evidências objetivas.
3. **Consulte o proprietário:** Formule a dúvida de forma direta e estruturada via `ask_question` ou mensagem clara, propondo alternativas viáveis.
