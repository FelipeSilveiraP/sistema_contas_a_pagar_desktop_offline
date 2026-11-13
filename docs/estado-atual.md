# Estado atual

> Máximo 30 linhas. **Reescreva** este arquivo a cada entrega (não acrescente histórico — decisões vão em `docs/decisoes.md`, histórico fica no Git).

**Atualizado em:** 2026-11-12 — branch `main` (tudo commitado e enviado; o agente pode comitar/enviar direto na `main`, ver `AGENTS.md` §5)

## Situação
- Fases 1 a 5 concluídas. Entrega de 2026-11-11 com 15 ajustes de uso (ver `decisoes.md` › "Ajustes de uso"): chave pela fechadura, bordas simples, colunas recolhíveis, área de edição única, impressão formal com a nota, nota obrigatória (ou "sem nota"), navbar estreita e tabelas do legado.
- 2ª rodada (2026-11-12): mensagens voltam a salvar no banco da loja (migração v15), área de edição única em todas as telas, pagador em caixa de seleção, Mensagens do dia com EXPANDIR/VER NO CONTROLE.
- Limpeza trimestral das notas antigas e backup em planilha no Google Drive a cada abertura.
- Versão **1.3.1**: barra com INSERIR CONTA e MENU PRINCIPAL vermelho; hambúrguer alinhado em todas as telas. Desde a 1.3.0: abre com o Windows e abre o Chrome no e-mail (`configuracoes.json`). As atualizações chegam pelo Drive: `npm run instalador` e depois `npm run publicar -- "novidades"` (passo a passo em `docs/instalacao.md`).
- Emblema próprio (cadeado) na janela, barra de tarefas, `.exe` e instalador; `release/` só com o instalador atual; projeto limpo (ver `decisoes.md`).
- Esquema SQLite **v16**. Nova dependência de execução: `pdf-lib` 1.17.1, que junta a nota em PDF na impressão.
- **Testes (2026-11-12), todos verdes:** JUnit 139 · máscaras 65 · filtros 22 · automações 24 · smoke 336 · hambúrguer 204 · smoke-boot 2 ciclos · persistência 11 · smoke-real 2 ciclos · smoke-dev 83 · CRUD real 70 · layout 54 medições (rodada final sem falhas). Smoke e smoke-boot tiveram falhas de tempo intermitentes (animação/carregamento) que passaram ao repetir.

## Próximos passos
- Importador da planilha legada para `legado_*` e, depois, para `contas_a_pagar`/`boletos_recorrentes`/`avisos`, quando o usuário enviar os dados.

## Pendências — decisões do usuário (auditoria)
- Trilha de auditoria (`auditoria_operacoes`): implementar ou descartar.
- Empresa: endereço estruturado, nome fantasia e vários e-mails; CNPJ e representante obrigatórios?
- Virada de ano: gerar as contas fixas ao abrir ou manter o botão "Gerar próximos meses"?
- Editar uma conta fixa altera as pendentes já geradas (modo ALTERAR do VBA)?
- Exclusão de banco/empresa com contas: hoje desfaz o vínculo (SET NULL); bloquear?
- Baixa rápida pedir o banco usado no pagamento?

## Pendências do usuário
- **Ligar os Drives (antes da 1ª atualização):** na conta da firma, criar em Meu Drive a pasta `Chaveiro Universal - Atualizacoes` e compartilhar como Editor com o e-mail do desenvolvedor. No PC de desenvolvimento, usar "Adicionar atalho ao Meu Drive". Na loja, marcar a pasta como "Disponível off-line" (passo a passo em `docs/instalacao.md`).
- Instalar `release/Contas a Pagar - Chaveiro Universal - Instalador 1.3.1.exe` no computador da loja, por cima da versão anterior, validar na resolução real e conferir se aparece `Meu Drive\Chaveiro Universal - Backup` com a planilha do dia.
- Revogar a chave de API da Xiaomi em `chat_mimo.ps1` (fora do Git).
