# Progress Tracking

## O que já está 100% Pronto
- [x] Conexão com Google Stitch & Design Tokens Neobrutalistas mapeados.
- [x] Configuração Maven com Java 21, JavaFX 21, SQLite JDBC, JUnit 5 e AssertJ.
- [x] DER Conceitual e Lógico formalizado e validado (12 entidades e relacionamentos).
- [x] DDL SQLite completo idempotente com 12 tabelas, índices e dados semente (`DatabaseInitializer`).
- [x] 12 Modelos Records do Java 21 imutáveis em `com.chaveiro.model`.
- [x] Persistência SQLite local em modo WAL (`ConnectionFactory`).
- [x] Camada de Repository JDBC com baixa atômica e auditoria ACID (`ContaRepository`).
- [x] Camada de Service com regras de negócio e propagação de recorrências do VBA (`ContaService`).
- [x] Ponto de entrada JavaFX com Pure DI (`App`, `AppContainer`).
- [x] Tratamento global de exceções contra crash abrupto (`App.configurarTratamentoGlobalErros`).
- [x] Layout inicial FXML e CSS Neobrutalista do Menu Principal (`menu-principal.fxml`, `neobrutalism.css`).
- [x] Testes unitários com JUnit 5 + AssertJ (`ContaServiceTest`).
- [x] Memory Bank instalado e atualizado em `.memory-bank/`.
- [x] 7 Skills de Engenharia instaladas em `.agents/skills/`.

## Em Andamento / Próximos Itens
- [ ] Fluxo 1: Inserir Conta (Formulário em 2 etapas: Valor/Vencimento ➔ Categoria/Fornecedor/NF).
- [ ] Fluxo 2: Controle (Todas as Contas com Baixa Rápida em 1 clique, Recorrentes e Histórico de Pagos).
- [ ] Fluxo 3: Cadastros (Empresas, Pagadores, Bancos).
- [ ] Fluxo 4: Mensagens (Quadro de recados).
- [ ] Fluxo 5: Gráficos e Impressão de relatórios.
- [ ] Empacotamento final `.exe` offline via `jpackage`.
