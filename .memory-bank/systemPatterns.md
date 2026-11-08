# System Patterns & Architectural Decisions

## Stack Tecnológica (legado JavaFX — preservado por histórico; NÃO é a stack atual)
* **Linguagem:** Java 21 LTS (Eclipse Adoptium OpenJDK).
* **UI Framework:** JavaFX 21.0.2 via FXML e CSS nativo (`-fx-*`).
* **Banco de Dados Local:** SQLite 3.45.2 via JDBC puro.
* **Testes Automatizados:** JUnit 5 (Jupiter) + AssertJ 3.25.3.

> **Nota de consistência (2026-11-08):** os itens 1–10 abaixo referem-se à fase JavaFX legada
> (incluindo "sem Spring" e PF/PJ em Pagador, ambos superados). A stack oficial vigente está em
> `AGENTS.md` e nos itens 11–16 (Electron + TypeScript puro + Spring Boot 3.3 + SQLite WAL).

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

## Padrões do Sistema de Contas a Pagar — Chaveiro Universal (migração Electron/TypeScript — atual)
11. **Navegação Multi-página Segura:** cada tela = 1 HTML + 1 módulo TS (`telas/*.ts`); despacho por `body[data-tela]`. Renderer **não** toca o sistema de arquivos: o preload expõe só `config()` e `navegar(tela)`; o processo principal valida a chave contra whitelist (`Map` chave→arquivo) antes de `loadFile`. `contextIsolation: true`, `nodeIntegration: false`, `will-navigate` e `window.open` bloqueados, CSP por página.
12. **Pilha de Voltar em `sessionStorage`:** `navegacao.ts` mantém `irPara()/voltar()/menuPrincipal()`; persistência entre páginas `file://` verificada no smoke.
13. **Entregas Agrupadas por Afinidade:** tarefas semelhantes que compartilham componentes/layouts/testes são agrupadas em uma única entrega (ex.: todos os submenus); cada entrega é testada e apresentada antes da próxima. Submenus são navegação pura (sem SQLite/regras financeiras — ver `docs/plano-telas.md` §3).
14. **Submenu como Componente Genérico:** `telas/submenu.ts` renderiza cards a partir de `submenus-config.ts` (rótulos/cores/selos/SVGs/destinos centralizados); telas HTML são cascas finas; Tailwind extrai classes também de `frontend/ts/**`.
15. **Navbar Global como Camada Fixa:** `navbar.ts` monta barra desktop (≥900px) + hambúrguer/painel/véu (`position:fixed`, `z-index`, `transform`) — overlays nunca tocam o layout dos cartões; módulo ativo derivado de `MODULO_DA_TELA` (tela filha herda módulo pai); cores oficiais do Menu como única fonte de cor de módulo.
16. **Isolamento de Testes × Banco Operacional (regra do usuário):** testes automatizados apontam SEMPRE para bancos temporários/isolados via `FINDESK_DB_PATH`; dados de teste nunca se misturam com dados de utilização normal; nenhuma operação destrutiva no banco operacional (quando em uso na empresa); integridade SQLite e mecanismos de backup/restauração sempre preservados.
