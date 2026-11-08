---
name: java-global-exception-safety
description: >
  Diretrizes de resiliência e tratamento global de exceções para o backend Spring Boot
  e processo desktop. Enfatiza @RestControllerAdvice, respostas de erro semânticas
  padronizadas, proteção contra vazamento de stack traces, rollback transacional
  automático e proibição estrita de engolir exceções.
triggers:
  - "tratamento de erro"
  - "exceção"
  - "restControllerAdvice"
  - "exceptionHandler"
  - "resiliência backend"
  - "crash safety"
origin: "Padrões de Resiliência REST Spring Boot + Chaveiro Universal"
license: "Autoral / Padrões do Projeto Chaveiro Universal"
---

# Global Exception Safety & Error Resilience

Diretrizes para garantir que o backend Spring Boot e a interface desktop tratem falhas de forma resiliente, informando erros com clareza ao usuário sem corromper dados ou expor detalhes sensíveis.

## 1. Tratamento Global Centralizado (`@RestControllerAdvice`)

Nunca capture exceções pontuais nos `@RestController` com blocos `try/catch` manuais. Todas as exceções da API devem fluir para um `@RestControllerAdvice` centralizado:

```java
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger LOG = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(EntidadeNaoEncontradaException.class)
    public ResponseEntity<ErroResposta> tratarNaoEncontrado(EntidadeNaoEncontradaException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
            .body(new ErroResposta(404, "Recurso não encontrado", ex.getMessage(), null));
    }

    @ExceptionHandler(ConflitoDadosException.class)
    public ResponseEntity<ErroResposta> tratarConflito(ConflitoDadosException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
            .body(new ErroResposta(409, "Conflito de integridade", ex.getMessage(), null));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErroResposta> tratarValidacao(MethodArgumentNotValidException ex) {
        Map<String, String> campos = new HashMap<>();
        for (FieldError f : ex.getBindingResult().getFieldErrors()) {
            campos.put(f.getField(), f.getDefaultMessage());
        }
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
            .body(new ErroResposta(400, "Dados inválidos", "Um ou mais campos contêm erros", campos));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErroResposta> tratarInesperado(Exception ex) {
        LOG.error("Erro interno inesperado no servidor: ", ex);
        // NUNCA vazar o stack trace para a resposta HTTP
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
            .body(new ErroResposta(500, "Erro interno", "Ocorreu um erro inesperado ao processar a requisição", null));
    }
}
```

## 2. Prevenção de Vazamento de Dados Sensíveis (Information Disclosure)

1. **Stack Traces Proibidos na Resposta HTTP:** O cliente da API (frontend) deve receber apenas mensagens explicativas e semânticas. Stack traces internos expõem caminhos de arquivos e detalhes de implementação.
2. **Consultas SQL Ocultadas:** Erros de JDBC (`SQLException`) devem ser traduzidos para exceções de domínio antes de responder ao cliente, mantendo o SQL bruto apenas nos logs internos.

## 3. Segurança Transacional e Rollback Automático

Se uma falha ocorrer durante o processamento de regras financeiras:
1. Em métodos anotados com `@Transactional`, o Spring dispara rollback automático para `RuntimeException`.
2. Em JDBC puro, o bloco `catch` deve invocar explicitamente `connection.rollback()`.
3. Nunca execute commits parciais antes que todas as etapas da operação sejam concluídas com sucesso.

## 4. Proibição Estrita de "Engolir" Exceções

- ❌ **TERMINANTEMENTE PROIBIDO:** `catch (Exception e) {}` ou apenas imprimir no console sem tratar (`e.printStackTrace()`).
- Se a exceção puder ser recuperada com segurança (fallback/retry), registre log informativo com nível `WARN`.
- Caso contrário, relance a exceção ou envolva-a em uma exceção de domínio tipada para que a camada global realize o tratamento adequado.
