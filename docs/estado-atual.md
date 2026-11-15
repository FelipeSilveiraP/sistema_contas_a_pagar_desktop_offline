# Estado atual

> Máximo 30 linhas. **Reescreva** este arquivo a cada entrega (não acrescente histórico — decisões vão em `docs/decisoes.md`, histórico fica no Git).

**Atualizado em:** 2026-11-15 — branch `claude/sleepy-mccarthy-w6itjv` (PR de auditoria de segurança aberto para a `main`, aguardando aprovação)

## Situação
- Fases 1 a 5 concluídas. Entrega de 2026-11-11 com 15 ajustes de uso (ver `decisoes.md` › "Ajustes de uso"): chave pela fechadura, bordas simples, colunas recolhíveis, área de edição única, impressão formal com a nota, nota obrigatória (ou "sem nota"), navbar estreita e tabelas do legado. 2ª rodada (2026-11-12): mensagens no banco da loja (v15), pagador em caixa de seleção.
- **Versão 1.3.7 (2026-11-15) — auditoria de segurança** (relatório em `docs/seguranca.md`): teto de valor, PDF com JavaScript escondido recusado, erros 4xx no lugar de 500, limite de tamanho das requisições, token obrigatório, IPC só das telas do sistema, backup no Drive que nunca apaga arquivo alheio, Spring Boot 3.5.16, sqlite-jdbc 3.54.1.0, GitHub Actions (`.github/workflows/testes.yml`).
- Versões anteriores: 1.3.6 gatilhos/auditoria/transações no banco; 1.3.5 instalador cadastra abrir com o Windows; 1.3.4 nota fiscal no Controle e prévia no Inserir Conta. Atualizações pelo Drive: `npm run instalador` e `npm run publicar -- "novidades"` (`docs/instalacao.md`).
- Esquema SQLite **v18** (v17: gatilhos + `auditoria_operacoes`; v18: auditoria das contas fixas e teto de valor no banco). Nova dependência de execução: `pdf-lib` 1.17.1, que junta a nota em PDF na impressão.
- **Testes (2026-11-15, nuvem Linux):** JUnit 178 · máscaras 65 · filtros 22 · automações 26 · smoke 336 · persistência 11 · SpotBugs ok. smoke-boot (parcial), smoke-real, smoke-dev e CRUD real precisam do Windows: rodar no PC antes de instalar na loja (o GitHub Actions também tenta).

## Próximos passos
- **Atualizar o Electron 33 → atual** (46 avisos de segurança) numa entrega própria, com smoke-real, smoke-dev e CRUD real no Windows.
- Conferir o 1º resultado do GitHub Actions no PR (os testes de entrada real lá são informativos).
- Importador da planilha legada para `legado_*` e, depois, para `contas_a_pagar`/`boletos_recorrentes`/`avisos`, quando o usuário enviar os dados.

## Pendências — decisões do usuário (auditoria)
- Empresa: endereço estruturado, nome fantasia e vários e-mails; CNPJ e representante obrigatórios?
- Virada de ano: gerar as contas fixas ao abrir ou manter o botão "Gerar próximos meses"?
- Editar uma conta fixa altera as pendentes já geradas (modo ALTERAR do VBA)?
- Exclusão de banco/empresa com contas: hoje desfaz o vínculo (SET NULL); bloquear?
- Baixa rápida pedir o banco usado no pagamento?

## Pendências do usuário
- Decidir sobre **assinar o `versao.json` das atualizações** (ver `docs/seguranca.md` §8). Até lá, compartilhar a pasta de atualizações do Drive só com quem precisa.
- **Ligar os Drives (antes da 1ª atualização):** na conta da firma, criar em Meu Drive a pasta `Chaveiro Universal - Atualizacoes` e compartilhar como Editor com o e-mail do desenvolvedor. No PC de desenvolvimento, usar "Adicionar atalho ao Meu Drive". Na loja, marcar a pasta como "Disponível off-line" (passo a passo em `docs/instalacao.md`).
- Instalar `release/Contas a Pagar - Chaveiro Universal - Instalador 1.3.2.exe` no computador da loja, por cima da versão anterior, validar na resolução real e conferir se aparece `Meu Drive\Chaveiro Universal - Backup` com a planilha do dia.
- Revogar a chave de API da Xiaomi em `chat_mimo.ps1` (fora do Git).
