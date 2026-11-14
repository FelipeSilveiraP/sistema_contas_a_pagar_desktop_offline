# Estado atual

> Máximo 30 linhas. **Reescreva** este arquivo a cada entrega (não acrescente histórico — decisões vão em `docs/decisoes.md`, histórico fica no Git).

**Atualizado em:** 2026-11-13 — branch `main` (tudo commitado e enviado; o agente pode comitar/enviar direto na `main`, ver `AGENTS.md` §5)

## Situação
- Fases 1 a 5 concluídas. Entrega de 2026-11-11 com 15 ajustes de uso (ver `decisoes.md` › "Ajustes de uso"): chave pela fechadura, bordas simples, colunas recolhíveis, área de edição única, impressão formal com a nota, nota obrigatória (ou "sem nota"), navbar estreita e tabelas do legado.
- 2ª rodada (2026-11-12): mensagens voltam a salvar no banco da loja (migração v15), área de edição única em todas as telas, pagador em caixa de seleção, Mensagens do dia com EXPANDIR/VER NO CONTROLE.
- Limpeza trimestral das notas antigas e backup em planilha no Google Drive a cada abertura.
- Versão **1.3.6** (2026-11-14): gatilhos de segurança, auditoria e transações atômicas no banco. Na 1.3.5: o instalador já cadastra o sistema para abrir com o Windows, e o sistema confere o cadastro a cada abertura. Na 1.3.4 (2026-11-13): nota fiscal no Controle, prévia no Inserir Conta, selos arredondados, área de edição limpa (cabeçalho branco, sem resumo nem selo) e emblema maior (só o cadeado). Instalada no PC de desenvolvimento; não publicada no Drive (pasta de atualizações ainda não ligada). Na 1.3.2: barra com INSERIR CONTA e MENU PRINCIPAL vermelho; em janela estreita, hambúrguer fixo no canto superior esquerdo (faixa no topo), igual em todas as telas. Desde a 1.3.0: abre com o Windows e abre o Chrome no e-mail (`configuracoes.json`). As atualizações chegam pelo Drive: `npm run instalador` e depois `npm run publicar -- "novidades"` (passo a passo em `docs/instalacao.md`).
- **Nota fiscal no Controle (2026-11-13):** em Todas as Contas, ao clicar numa conta, a nota (foto, PDF ou cartão do Word) aparece abaixo da edição. Clicar na nota oferece IMPRIMIR ou SALVAR NO COMPUTADOR, e há TROCAR/ANEXAR NOTA e EXCLUIR NOTA (`DELETE /api/contas/{id}/anexo`). No Inserir Conta, o arquivo escolhido aparece em prévia, com REMOVER. Ainda não publicado em versão nova do instalador.
- Esquema SQLite **v17** (gatilhos de segurança + `auditoria_operacoes`; ver `decisoes.md` › "Segurança no banco"). Nova dependência de execução: `pdf-lib` 1.17.1, que junta a nota em PDF na impressão.
- **Testes (2026-11-13), todos verdes:** JUnit · máscaras 65 · filtros 22 · automações 24 · smoke 336 · smoke-boot 2 ciclos · persistência 11 · smoke-real 2 ciclos · smoke-dev 83 · CRUD real 76. O smoke-dev falhou 2 vezes em Cadastros (navegação/foco, telas que não mudaram) e passou na 3ª. Hambúrguer e layout não foram rodados nesta entrega. CRUD real 79 com a prévia do Inserir Conta (PDF, foto e REMOVER por clique real).

## Próximos passos
- Importador da planilha legada para `legado_*` e, depois, para `contas_a_pagar`/`boletos_recorrentes`/`avisos`, quando o usuário enviar os dados.

## Pendências — decisões do usuário (auditoria)
- Empresa: endereço estruturado, nome fantasia e vários e-mails; CNPJ e representante obrigatórios?
- Virada de ano: gerar as contas fixas ao abrir ou manter o botão "Gerar próximos meses"?
- Editar uma conta fixa altera as pendentes já geradas (modo ALTERAR do VBA)?
- Exclusão de banco/empresa com contas: hoje desfaz o vínculo (SET NULL); bloquear?
- Baixa rápida pedir o banco usado no pagamento?

## Pendências do usuário
- **Ligar os Drives (antes da 1ª atualização):** na conta da firma, criar em Meu Drive a pasta `Chaveiro Universal - Atualizacoes` e compartilhar como Editor com o e-mail do desenvolvedor. No PC de desenvolvimento, usar "Adicionar atalho ao Meu Drive". Na loja, marcar a pasta como "Disponível off-line" (passo a passo em `docs/instalacao.md`).
- Instalar `release/Contas a Pagar - Chaveiro Universal - Instalador 1.3.2.exe` no computador da loja, por cima da versão anterior, validar na resolução real e conferir se aparece `Meu Drive\Chaveiro Universal - Backup` com a planilha do dia.
- Revogar a chave de API da Xiaomi em `chat_mimo.ps1` (fora do Git).
