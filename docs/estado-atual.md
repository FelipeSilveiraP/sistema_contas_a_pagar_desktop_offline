# Estado atual

> Máximo 30 linhas. **Reescreva** este arquivo a cada entrega (não acrescente histórico — decisões vão em `docs/decisoes.md`, histórico fica no Git).

**Atualizado em:** 2026-11-09 — branch `feature/layout-mascaras-contexto`

## Foco atual
- Centralizar as telas e a navbar e eliminar a rolagem causada por formulários grandes demais.
- Revisar input por input as máscaras de todos os formulários, com testes automatizados.

## Situação
- Fases 1–3 concluídas: todas as telas do Stitch estão implementadas e gravam no SQLite.
- Última regressão completa (2026-11-09):

| Teste | Resultado |
|---|---|
| JUnit | 120/120 |
| smoke | 326/326 |
| smoke-boot | 44/44 |
| smoke-real | 50/50 |
| smoke-dev | 83/83 |
| persistência | 11/11 |

## Pendências do usuário
- Validação visual final na resolução real do monitor da empresa.
- Validação manual do bug de foco/digitação no uso real (`npm run dev`).
- Revogar a chave de API da Xiaomi que está em `chat_mimo.ps1` (fora do Git).

## Próximos passos
- Fase 4: filtros avançados, gráficos consolidados e impressão.
- Fase 5: logs com rotação e instalador Windows (Electron + JRE via `jpackage`).
