---
name: sqlite-financial-integrity
description: >
  Diretrizes de persistência e integridade financeira para SQLite 3 local.
  Garante integridade ACID sob WAL mode, chaves estrangeiras ativas, migrações
  versionadas via PRAGMA user_version, backups consistentes online via VACUUM INTO
  ou SQLite Online Backup API, integridade física e cálculos monetários exatos.
triggers:
  - "sqlite integridade"
  - "migração sqlite"
  - "backup sqlite"
  - "vacuum into"
  - "valores monetários"
  - "user_version"
origin: "Documentação Oficial SQLite Consortium (Domínio Público) + Padrões Chaveiro Universal"
license: "Autoral / Documentação SQLite (Domínio Público)"
---

# SQLite & Financial Data Integrity Guidelines

Diretrizes para garantir que dados financeiros locais nunca sejam corrompidos, perdidos ou calculados com imprecisão.

## 1. Conexões Concorrentes e Pragmas Obrigatórios

Ao abrir qualquer conexão SQLite (via JDBC), configure **imediatamente** os seguintes PRAGMAs:
1. `PRAGMA journal_mode = WAL;` (Write-Ahead Logging para leitura simultânea de múltiplos leitores sem travar o gravador).
2. `PRAGMA synchronous = NORMAL;` (Equilíbrio ideal de durabilidade física e performance em modo WAL).
3. `PRAGMA foreign_keys = ON;` (**Crítico:** SQLite desativa chaves estrangeiras por padrão em conexões novas; deve ser ligado explicitamente).
4. `PRAGMA busy_timeout = 5000;` (Evita falhas imediatas de `SQLITE_BUSY` aguardando até 5 segundos sob concorrência).

## 2. Migrações Versionadas via `PRAGMA user_version`

Nunca realize recriação destrutiva (`DROP TABLE`) de tabelas operacionais em produção:
1. Verifique a versão atual: `PRAGMA user_version;`.
2. Execute apenas as migrações aditivas necessárias dentro de transação:
   ```java
   int versaoAtual = obterVersao(conn);
   if (versaoAtual < 1) {
       conn.createStatement().execute("CREATE TABLE IF NOT EXISTS bancos (...)");
       conn.createStatement().execute("PRAGMA user_version = 1;");
   }
   if (versaoAtual < 2) {
       // Migração v2
       conn.createStatement().execute("PRAGMA user_version = 2;");
   }
   ```

## 3. Backup Online Consistente (Proibida Cópia Simples em WAL)

> 🚨 **AVISO CRÍTICO:** Em modo WAL, uma cópia simples de arquivo (`Files.copy("contas.db")` ou comando `copy`) **NÃO** é segura, pois transações recentes ainda estão no arquivo auxiliar `-wal`, gerando snapshots corrompidos ou incompletos.

### Métodos Oficiais Aceitos:
1. **Comando SQL `VACUUM INTO` (Padrão do Projeto):**
   ```sql
   VACUUM INTO 'C:/caminho/do/backup/contas_a_pagar_2026-11-08.db';
   ```
   Gera um snapshot limpo, consistente e desfragmentado sem travar o uso da aplicação.
2. **SQLite Online Backup API:**
   Utilizada quando se deseja cópia incremental via driver nativo (`sqlite3_backup_*`).

### Políticas de Backup:
- Manter política de retenção rotativa de backups (ex.: 8 backups diários).
- Executar backup preventivo antes de aplicar migrações estruturais de esquema.

## 4. Verificação de Saúde e Restauração

Antes de carregar ou substituir o banco de dados operacional por uma restauração de backup, execute a validação física:
```sql
PRAGMA integrity_check;
```
Se o resultado não for uma linha única com a string `"ok"`, o arquivo de dados está corrompido e **não** deve ser restaurado.

## 5. Valores Monetários Exatos

1. **Proibição de Tipos Ponto Flutuante:** Jamais use `FLOAT`, `DOUBLE` ou `REAL` para valores em dinheiro devido a imprecisão IEEE 754.
2. **Padrão Aceito:**
   - No SQLite: armazene como `INTEGER` em centavos (ex.: R$ 150,50 = `15050`) ou `NUMERIC`/`TEXT` preservando a escala.
   - No Java: use `BigDecimal` com escala definida (ex.: 2 casas decimais) e modo de arredondamento explícito (`RoundingMode.HALF_EVEN`).
