# Estado atual

> Máximo 30 linhas. **Reescreva** este arquivo a cada entrega (não acrescente histórico — decisões vão em `docs/decisoes.md`, histórico fica no Git).

**Atualizado em:** 2026-11-10 — branch `feature/fase4-auditoria`

## Situação
- **Fases 1 a 5 concluídas.** Todas as telas gravam no SQLite, com filtros avançados, gráficos consolidados e impressão em PDF. O instalador Windows tem o Java embutido e há logs com rotação.
- Auditoria de formulários feita (agente `auditor-formularios`): os bugs claros foram corrigidos; os itens que dependem de decisão estão abaixo.
- **Testes (2026-11-10):**

| Teste | Resultado |
|---|---|
| JUnit | 130/130 |
| Máscaras | 65/65 |
| Filtros | 32/32 |
| smoke | 331/331 |
| smoke-boot | 44/44 |
| persistência | 11/11 |
| smoke-real | 50/50 |
| smoke-dev | 83/83 |
| CRUD real | 62/62 |

## Pendências — decisões do usuário (auditoria)
- Trilha de auditoria (`auditoria_operacoes`): implementar ou descartar.
- Empresa: endereço estruturado (CEP, cidade, UF…), nome fantasia e vários e-mails (estão no Stitch); CNPJ e representante obrigatórios?
- Virada de ano (VBA `cmdCriarAnoNovo`): gerar as contas fixas automaticamente ao abrir ou manter o botão "Gerar próximos meses"?
- Editar uma conta fixa deve alterar as contas pendentes já geradas (modo ALTERAR do VBA)?
- Exclusão de banco/empresa com contas: hoje o vínculo é desfeito (SET NULL); bloquear?
- Baixa rápida pedir o banco usado no pagamento?

## Pendências do usuário
- Instalar o `release/...Instalador 1.0.0.exe` no computador da loja e validar na resolução real.
- Revogar a chave de API da Xiaomi em `chat_mimo.ps1` (fora do Git).
