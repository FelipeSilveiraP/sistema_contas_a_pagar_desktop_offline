---
name: sqlite-crash-resilience
description: >
  Diretrizes de persistência, resiliência contra quedas de energia e transações
  ACID no SQLite JDBC. Impõe modo WAL, PreparedStatements parametrizados, transações
  atômicas explícitas e backup consistente sem cópia direta de arquivos.
triggers:
  - "sqlite wal"
  - "transação sqlite"
  - "preparedStatement"
  - "resiliência sqlite"
  - "queda de energia"
origin: "Padrões de Resiliência SQLite Consortium + Chaveiro Universal"
license: "Autoral / Documentação SQLite (Domínio Público)"
---

# SQLite Crash Resilience & JDBC Transaction Safety

Diretrizes para garantir que o banco embutido SQLite resista a quedas abruptas de energia, encerramentos forçados do sistema e falhas de hardware sem corrupção física de dados.

## 1. Conexões e Modo WAL Obrigatório

Ao abrir conexões via JDBC, configure imediatamente os pragmas de resiliência:
```sql
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA busy_timeout = 5000;
PRAGMA foreign_keys = ON;
```
* **WAL (Write-Ahead Logging):** Permite leitura concorrente sem bloquear escrita e garante recuperação atômica no próximo boot após crash do sistema.
* **Synchronous NORMAL:** Garante integridade em caso de falha de energia sem o overhead excessivo do modo FULL em WAL.

## 2. 100% PreparedStatements Parametrizados

Toda e qualquer query SQL com valores dinâmicos deve utilizar `PreparedStatement` com marcadores `?`.
- **Proibido:** Concatenação de variáveis em strings SQL.
- **Obrigatório:** `try-with-resources` em todas as instâncias de `Connection`, `PreparedStatement` e `ResultSet`.

## 3. Transações Atômicas Explícitas

Operações multi-etapa (ex.: liquidação de conta com baixa financeira e trilha de auditoria) devem ser encapsuladas em transações atômicas:
```java
connection.setAutoCommit(false);
try {
    // 1. Atualizar conta para PAGA
    // 2. Inserir registro na tabela pagamentos
    // 3. Registrar operação em auditoria_operacoes
    connection.commit();
} catch (Exception e) {
    connection.rollback();
    throw e;
} finally {
    connection.setAutoCommit(true);
}
```

## 4. Diretriz Estrita de Backup em Modo WAL

> 🚨 **PROIBIÇÃO ABSOLUTA:** Jamais realize cópia simples de arquivo (`Files.copy("contas_a_pagar.db")` ou comandos do sistema operacional como `copy`/`robocopy`) com o aplicativo rodando em modo WAL. Transações recentes ficam retidas no arquivo `-wal` e páginas na memória compartilhada `-shm`, gerando backups corrompidos, incompletos ou em estado inconsistente.

### Alternativas Oficiais Permitidas:
1. **Comando SQL `VACUUM INTO` (Recomendado):**
   ```sql
   VACUUM INTO 'C:/caminho/do/backup/contas_a_pagar_backup.db';
   ```
   Cria um snapshot consistente, desfragmentado e autônomo do banco em tempo real, sem travar leituras.
2. **SQLite Online Backup API:**
   Utilizar a API nativa de backup do driver SQLite (`sqlite3_backup_*` ou `SQLiteConnection`) para cópias incrementais bloco a bloco.

*Para migrações versionadas, verificação com `PRAGMA integrity_check` e tipos monetários exatos, consulte a skill complementar `sqlite-financial-integrity`.*
