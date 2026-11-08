---
name: spring-boot-rest-craft
description: >
  Diretrizes de arquitetura em camadas e boas práticas para Spring Boot 3.3+ com Java 21 LTS.
  Controllers REST enxutos, Services com regras de negócio, Repositories JDBC puros
  com PreparedStatements parametrizados, DTOs em Java 21 record, Bean Validation
  e tratamento global de exceções (@RestControllerAdvice).
triggers:
  - "spring boot"
  - "rest controller"
  - "endpoint"
  - "dto"
  - "bean validation"
  - "global exception"
  - "java 21"
origin: "Autoral / Baseado na documentação oficial Spring Boot 3.3 e Java 21 LTS adaptados para SQLite JDBC"
license: "Autoral / Propriedade do Projeto Chaveiro Universal"
---

# Spring Boot REST Craft (Java 21 LTS + SQLite JDBC)

Diretrizes para desenvolvimento de APIs REST seguras, de alta performance e baixo consumo de recursos usando Spring Boot 3.3.x e Java 21.

## 1. Arquitetura em Camadas Estrita

1. **Controller (`@RestController`):**
   - Camada de transporte HTTP pura.
   - Responsável apenas por roteamento, receber requisições, invocar validação (`@Valid`), delegar ao `Service` e retornar códigos HTTP semânticos (200, 201 Created + Location, 204 No Content).
   - **Proibição Absoluta:** Jamais executar consultas SQL, regras de negócio ou cálculos de data dentro de um Controller.
2. **Service (`@Service`):**
   - Centraliza todas as regras de negócio, validações de domínio (ex.: regras de CPF, intervalos de datas, transições de status) e orquestração transacional.
3. **Repository (`@Repository`):**
   - Abstração de persistência usando JDBC puro (`sqlite-jdbc`).
   - 100% dos parâmetros executados via `PreparedStatement` e `try-with-resources`. Zero concatenação de strings SQL.

## 2. Java 21 `record` para DTOs e Transferência Imutável

Use `record` do Java 21 para todas as entradas e saídas de dados da API:
```java
public record CriarBancoRequest(
    @NotBlank(message = "A instituição é obrigatória")
    @Size(min = 2, max = 120, message = "A instituição deve ter entre 2 e 120 caracteres")
    String instituicao,

    @Size(max = 77, message = "A chave Pix deve ter no máximo 77 caracteres")
    String chavePix
) {}

public record BancoResponse(
    long idBanco,
    String instituicao,
    String chavePix
) {}
```

## 3. Tratamento Global de Exceções (`@RestControllerAdvice`)

Centralize respostas de erro em uma única classe anotada com `@RestControllerAdvice`:
1. Respostas padronizadas para erros de validação (HTTP 400 Bad Request):
   ```java
   @ExceptionHandler(MethodArgumentNotValidException.class)
   public ResponseEntity<Map<String, Object>> tratarValidacao(MethodArgumentNotValidException ex) {
       Map<String, String> campos = new HashMap<>();
       for (FieldError erro : ex.getBindingResult().getFieldErrors()) {
           campos.put(erro.getField(), erro.getDefaultMessage());
       }
       return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of(
           "status", 400,
           "erro", "Dados inválidos",
           "campos", campos
       ));
   }
   ```
2. Respostas semânticas para recursos não encontrados (`404`) e violação de integridade referencial (`409 Conflict`).

## 4. Segurança Localhost e Autenticação por Token

1. O Spring Boot deve escutar estritamente em `127.0.0.1` (`server.address=127.0.0.1`).
2. Filtro de requisição (`OncePerRequestFilter`) validando se o cabeçalho `X-FinDesk-Token` coincide com o valor seguro da variável de ambiente `FINDESK_API_TOKEN`.
3. Falhar rápido no boot (`System.exit(1)`) caso a variável `FINDESK_API_TOKEN` esteja vazia ou ausente.

