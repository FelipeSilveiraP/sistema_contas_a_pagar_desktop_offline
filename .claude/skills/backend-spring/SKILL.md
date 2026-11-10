---
name: backend-spring
description: Padrões do backend Spring Boot 3.3 / Java 21 deste projeto — camadas controller/service/repository, injeção por construtor, exceções de domínio e ApiExceptionHandler, Java moderno (records), logs SLF4J sem dados sensíveis. Use ao criar ou alterar endpoints, services, repositories ou tratamento de erro em backend/.
---

# Backend Spring Boot (Java 21)

Consolida `spring-boot-rest-craft`, `java-clean-di-wiring`, `java-global-exception-safety`, `java-modern-craft` e `java-observability-logging`.

## Camadas (`backend/src/main/java/com/chaveiro/`)

| Pacote | Responsabilidade | Nunca |
|---|---|---|
| `api/` (`@RestController`) | Rota, conversão do JSON, delegar ao service, status HTTP (201 + corpo, 204) | SQL, regra de negócio, cálculo de data |
| `service/` (`@Service`) | Validação de domínio, regras financeiras, orquestração | Conhecer HTTP (`HttpServletRequest`) |
| `repository/` (`@Repository`) | JDBC puro com `PreparedStatement` + try-with-resources, transações | Regra de negócio |
| `model/` | `record` imutáveis | Getters e setters manuais |
| `database/` | Conexão, PRAGMAs, migrações, inicialização (ver skill `sqlite-financeiro`) | — |
| `web/` | `TokenFilter` (`X-FinDesk-Token`) e CORS | — |

## Injeção de dependência

- **Só por construtor**, com campos `private final`. Sem `@Autowired` em campo, sem service locator e sem singleton estático.
- **Testes:** os services são instanciados à mão sobre um SQLite real e temporário (`@TempDir` + `new ConnectionFactory(caminho)` + `new DatabaseInitializer(conexao).inicializar()`). Este projeto **não** usa Mockito. Veja `BancoServiceTest`.

## Erros

- O service lança exceções de domínio de `service/`:
  - `DadosInvalidosException` → 400, com o mapa de campos;
  - `RecursoNaoEncontradoException` → 404;
  - `ConflitoIntegridadeException` → 409;
  - `PossivelDuplicataException` → 409, com os detalhes da duplicidade.
- `api/ApiExceptionHandler` é o **único** lugar que converte exceção em resposta. Não faça `try/catch` em controller.
- A resposta nunca leva stack trace, SQL ou caminho de arquivo. O detalhe vai só para o log.
- Proibido engolir exceção (`catch (Exception e) {}`, `printStackTrace()`). Faça log + rethrow, ou converta para uma exceção de domínio.

## Java moderno

- Use `record` para dados e coleções imutáveis (`List.of`). Prefira `switch` expression e pattern matching a cascatas de `if`/`instanceof`.
- Dinheiro é `BigDecimal` no Java e `INTEGER` em centavos no banco (`valor_centavos`). Nunca `double`/`float`.
- **Simplicidade:** não crie interface com uma implementação só, nem factory ou camada extra (ver skill `simplicidade`).

## Logs (SLF4J)

- `private static final Logger log = LoggerFactory.getLogger(X.class);`, com parâmetros `{}` (sem concatenação) e a exceção como último argumento.
- **Níveis:** `INFO` para evento de negócio (conta paga, banco cadastrado); `WARN` para situação anômala tratada; `ERROR` para falha que precisa de diagnóstico.
- **Proibido logar:** o token, senhas, CPF/CNPJ completos (mascare) e dados financeiros de terceiros. Registre IDs e status.
- A rotação de log em arquivo (`logging.file.name` em `%LOCALAPPDATA%`, `max-file-size`, `max-history`) é da Fase 5. Ainda não está configurada.

## Segurança

- `server.address=127.0.0.1`. O token vem de `FINDESK_API_TOKEN` (sem valor padrão). Toda rota passa pelo `TokenFilter`.
- Valide 100% do que chega na API, mesmo que o frontend já valide.
