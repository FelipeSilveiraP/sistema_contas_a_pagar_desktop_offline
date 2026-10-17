# System Patterns & Architectural Decisions

## Stack Tecnológica
* **Linguagem:** Java 21 LTS (Eclipse Adoptium OpenJDK).
* **UI Framework:** JavaFX 21.0.2 via FXML e CSS nativo (`-fx-*`).
* **Banco de Dados Local:** SQLite 3.45.2 via JDBC puro.
* **Testes Automatizados:** JUnit 5 (Jupiter) + AssertJ 3.25.3.

## Padrões Arquiteturais Consolidados
1. **Model Layer (DER Refinado):** Java 21 `record` para dados imutáveis (`Conta`, `Empresa`, `TelefoneEmpresa`, `Pagador`, `NotaFiscal`, `CategoriaConta`, `FormaPagamento`, `Banco`, `Pagamento`, `BoletoRecorrente`, `Aviso`, `AuditoriaOperacao`).
2. **Especialização 'xt' de Pagador:** Mapeamento de Pessoa Física / Jurídica via Tabela Única com `CHECK (tipo_pessoa IN ('PF', 'PJ'))`.
3. **Liquidação Financeira Desacoplada:** Relacionamento `contas_a_pagar (1,1) <-> pagamentos (1,1) <-> bancos (0,n)` garantindo que o dinheiro movimentado no banco rastreie exatamente a conta liquidada.
4. **Trilha de Auditoria Atômica:** Execução de mudanças financeiras e registro em `auditoria_operacoes` sob a mesma transação ACID (`conn.setAutoCommit(false)`).
5. **Pure Dependency Injection:** Sem frameworks pesados (sem Spring/Micronaut). Composição de dependências via `AppContainer` e injeção nos controllers via `FXMLLoader.setControllerFactory`.
6. **Repository Pattern:** JDBC puro com `try-with-resources` e PreparedStatements 100% parametrizados. Zero SQL injection.
7. **Service Layer:** Centralização de cálculos de vencimentos, alertas e propagação de recorrências do VBA.
8. **Crash Resilience & WAL:** Conexões SQLite abertas com `PRAGMA journal_mode = WAL;` e `PRAGMA synchronous = NORMAL;`.
9. **Exception Safety:** Registro de `Thread.setDefaultUncaughtExceptionHandler` no boot da aplicação, impedindo travamento ou encerramento súbito sem diálogo amigável.
10. **Virtual Threads / Worker Pattern:** Operações assíncronas via `javafx.concurrent.Task` e Virtual Threads do Java 21 para garantir 60 FPS na UI.
