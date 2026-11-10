---
name: sqlite-financeiro
description: Integridade dos dados financeiros no SQLite deste projeto — PRAGMAs, migrações aditivas via user_version, transações atômicas (baixa/estorno), backup com VACUUM INTO, valores em centavos e proteção do banco operacional. Use ao alterar esquema, migrações, repositories, pagamentos, recorrências ou backup.
---

# SQLite e integridade financeira

Consolida `sqlite-financial-integrity` e `sqlite-crash-resilience`.

## Regra de ouro

**Nenhuma operação destrutiva no banco operacional** (`%LOCALAPPDATA%\ChaveiroUniversal\ContasAPagar\contas_a_pagar.db`). Teste, script e experimento sempre usam `FINDESK_DB_PATH` apontando para um arquivo temporário.

## Conexão

`database/ConnectionFactory` aplica, em **toda** conexão:
- `journal_mode = WAL`
- `synchronous = NORMAL`
- `foreign_keys = ON` (o SQLite desliga por padrão)
- `busy_timeout = 5000`

Não abra conexão por fora dele.

## Migrações

- Ficam em `database/DatabaseInitializer`, versionadas por `PRAGMA user_version` (constante `VERSAO_ATUAL`). Cada versão roda dentro de uma transação, com rollback se falhar.
- **Só aditivas:** `CREATE TABLE`, `ADD COLUMN` e índices. **Proibido `DROP TABLE`** e recriação destrutiva. Se precisar reestruturar, crie a tabela nova, copie os dados e mantenha a antiga.
- `InicializadorBanco` (ApplicationRunner) faz um backup **antes** de migrar. Não remova isso.
- Migração nova = `VERSAO_ATUAL + 1` + um teste que abre um banco na versão anterior e confere os dados preservados.

## Transações

- Operações em várias etapas são atômicas: `setAutoCommit(false)` → passos → `commit()`, com `rollback()` no catch e `setAutoCommit(true)` no finally.
- **Baixa e estorno de pagamento:** o `INSERT`/`DELETE` em `pagamentos` e a troca de `status` da conta acontecem na mesma transação.
- O `status` (PENDENTE/PAGO) **não** muda por PUT de conta: o UPDATE não toca a coluna. Teste de guarda: `naoDevePermitirTrocarStatusViaPut`.
- `UNIQUE(id_conta)` em `pagamentos`: um pagamento integral por conta, e o valor pago pode ser diferente do valor da conta.
- `forcar` (duplicidade) pula **só** o filtro de duplicidade. Validações, FKs e CHECKs continuam valendo.
- **Duplicidade (regra do VBA):** mesma conta no mesmo mês de vencimento.
- **Recorrência:**
  - gera 12 competências e preserva o dia (dia inexistente vira o último dia do mês);
  - anti-duplicação por nome + vencimento;
  - excluir a recorrência remove só as contas geradas **não pagas**.

## SQL

- 100% `PreparedStatement` com `?` e try-with-resources em `Connection`, `PreparedStatement` e `ResultSet`. Zero concatenação.
- Dinheiro em `INTEGER` de centavos (`valor_centavos`, `valor_pago_centavos`) com `CHECK (> 0)`. No Java, use `BigDecimal`.

## Backup e restauração

- **Só** via `VACUUM INTO '<arquivo>'` (`service/BackupService`). **Proibido** copiar o arquivo `.db` com o app aberto: os dados recentes estão no `-wal`.
- Há backup diário e pré-migração, com rotação dos últimos 8.
- **Antes de restaurar:** `PRAGMA integrity_check` precisa retornar exatamente `ok`, senão o arquivo é recusado.
