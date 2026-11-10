# Estado atual

> Máximo 30 linhas. **Reescreva** este arquivo a cada entrega (não acrescente histórico — decisões vão em `docs/decisoes.md`, histórico fica no Git).

**Atualizado em:** 2026-11-09 — branch `feature/layout-mascaras-contexto`

## Entrega atual (concluída, aguardando validação visual do usuário)
- **Layout:** todas as telas cabem sem rolar a partir de 1366×768; os formulários longos usam 2 colunas em telas largas; os botões de ação estão centralizados; a navbar fica na mesma posição em todas as telas; o Menu não corta mais os cartões.
- **Máscaras:** reescritas como funções puras e testadas. Trazem o "R$" sem duplicar, Backspace sobre separadores, CNPJ alfanumérico, máscara nos editores das tabelas e o dia com 2 dígitos. O CPF é opcional também na edição.

## Situação
- Fases 1–3 concluídas: todas as telas do Stitch estão implementadas e gravam no SQLite.
- Testes: JUnit, `teste-mascaras`, smoke, smoke-boot, smoke-real, smoke-dev e persistência. Os números estão no último commit da entrega.

## Pendências
- **Menu:** a tabela "Mensagens do dia" ainda mostra dados FICTÍCIOS fixos do design (contas de 2023), ligados a nada. Precisa ser conectada a `/api/contas/alertas`.
- Validação visual final na resolução real do monitor da empresa.
- Validação manual do bug de foco/digitação no uso real (`npm run dev`).
- Revogar a chave de API da Xiaomi que está em `chat_mimo.ps1` (fora do Git).

## Próximos passos
- Fase 4: filtros avançados, gráficos consolidados e impressão.
- Fase 5: logs com rotação e instalador Windows (Electron + JRE via `jpackage`).
