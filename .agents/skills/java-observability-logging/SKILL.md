---
name: java-observability-logging
description: >
  Instrumenta o backend Spring Boot e Java 21 com logs estruturados via SLF4J,
  níveis de severidade corretos, IDs de correlação (MDC), rotação de arquivos
  e proteção rigorosa contra vazamento de senhas, tokens efêmeros ou dados pessoais (LGPD).
triggers:
  - "adicionar log"
  - "logging"
  - "observabilidade"
  - "rastrear operação"
  - "slf4j"
  - "mdc"
  - "diagnóstico"
origin: "Adaptado de addyosmani/agent-skills (MIT License) + Spring Boot 3.3 / Java 21 Standards"
license: "MIT (Addy Osmani / agent-skills) + Adaptação Local"
---

# Java & Spring Boot Observability & Logging

> "Código que você não consegue observar é código que você não consegue operar."  
> Adaptado de [addyosmani/agent-skills – observability-and-instrumentation](https://github.com/addyosmani/agent-skills/tree/main/skills/observability-and-instrumentation).

---

## 1. Regra de Ouro: Defina a Pergunta Antes de Logar

Antes de adicionar qualquer linha de log, responda:
```text
FUNCIONALIDADE: Pagamento de conta
PERGUNTAS QUE UM DESENVOLVEDOR FARÁ AO INVESTIGAR UMA FALHA:
1. Qual conta foi paga, em qual banco e com qual identificador de operação?
2. A operação falhou na validação de negócio ou na persistência SQLite?
3. O rollback da transação foi acionado?
→ Cada linha de log deve responder exatamente a UMA dessas perguntas.
```
Se você não sabe qual pergunta o log responde, você está apenas gerando ruído no disco.

---

## 2. Logger Oficial do Projeto: SLF4J + Logback

No backend Spring Boot 3.3 com Java 21, utilize a fachada padrão **SLF4J**:

```java
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;

@Service
public class ContaService {

    private static final Logger LOG = LoggerFactory.getLogger(ContaService.class);
}
```

### Por que Logs Parametrizados com `{}`?
Nunca concatene strings no log. O SLF4J avalia argumentos de forma postergada (lazy evaluation):
* ❌ **ERRADO:** `LOG.info("Conta salva: " + conta.id() + " no banco: " + banco.id());` (Cria objetos na memória mesmo com nível desativado).
* ✅ **CORRETO:** `LOG.info("Conta salva com id={} vinculada ao banco id={}", conta.id(), banco.id());`

---

## 3. Níveis de Severidade — Use Corretamente

| Nível | Significado | Ação Esperada |
|---|---|---|
| `ERROR` | Falha grave; exceção não tratada; inconsistência detectada | Requer diagnóstico imediato |
| `WARN` | Situação anômala mas tratada (ex.: tentativa repetida, fallback acionado) | Monitorar frequência |
| `INFO` | Evento de negócio significativo (ex.: banco cadastrado, conta liquidada) | Nenhuma (registro operacional) |
| `DEBUG` | Detalhes de fluxo para desenvolvedores (ex.: payload recebido no Controller) | Desligado em produção |
| `TRACE` | Detalhes exaustivos (ex.: parâmetros brutos de query JDBC) | Apenas depuração fina local |

---

## 4. IDs de Correlação com MDC (Mapped Diagnostic Context)

Para que todos os logs de uma mesma requisição compartilhem o mesmo identificador sem precisar passá-lo manualmente em cada método:

### 4.1 Injeção no Filtro HTTP ou Ponto de Entrada:
```java
String opId = UUID.randomUUID().toString().substring(0, 8);
try {
    MDC.put("opId", opId);
    LOG.info("Iniciando processamento da requisição POST /api/bancos");
    service.executarOperacao();
} finally {
    MDC.clear(); // Obrigatório para evitar vazamento entre threads
}
```

### 4.2 Formato no Arquivo de Log:
Com o padrão `%d{ISO8601} [%thread] [op=%X{opId}] %-5level %logger{36} - %msg%n`, o log sai padronizado:
```text
2026-11-08T13:30:15 [http-nio-8080-exec-1] [op=a1b2c3d4] INFO  c.c.service.BancoService - Banco cadastrado com id=3
```

---

## 5. Proteção Máxima de Dados Pessoais & Credenciais (LGPD)

> 🚨 **REGRA DE SEGURANÇA E PRIVACIDADE:** O arquivo de log pode ser inspecionado por suporte ou exportado em diagnósticos. Nunca grave segredos ou dados pessoais sensíveis em texto claro.

### Proibições Absolutas:
1. **Zero Tokens de Autenticação:** O token efêmero de sessão (`FINDESK_API_TOKEN` / `X-FinDesk-Token`) **NUNCA** deve ser registrado em arquivos de log ou console.
2. **Zero Senhas:** Senhas de usuários e chaves privadas nunca são logadas.
3. **Mascaramento de CPF / PII:**
   - ❌ **ERRADO:** `LOG.info("Pagador cadastrado com CPF: {}", pagador.cpf());`
   - ✅ **CORRETO:** `LOG.info("Pagador cadastrado com CPF: ***.***.{}", pagador.cpf().substring(7));`
4. **Ausência de Dados Financeiros Confidenciais:** Não registre extratos bancários brutos ou saldos completos de terceiros. Loge apenas os IDs envolvidos e o status do pagamento.

---

## 6. Configuração e Rotação de Arquivos de Log

Para evitar crescimento descontrolado de disco no computador do usuário, configure no `application.properties` (ou `logback-spring.xml`):
```properties
# Local do log dentro da pasta de dados locais da aplicação
logging.file.name=${LOCALAPPDATA}/ChaveiroUniversal/ContasAPagar/logs/findesk.log

# Rotação diária e limite por arquivo
logging.logback.rollingpolicy.max-file-size=10MB
logging.logback.rollingpolicy.max-history=7
logging.logback.rollingpolicy.total-size-cap=100MB
```

---

## 7. Tratamento Seguro de Erros e Stack Traces

1. **Nunca use `e.printStackTrace()`:** Stack traces soltos vão para `stderr` desformatados e sem correlação.
2. **Passe a exceção como último parâmetro:** O SLF4J formata o stack trace automaticamente:
   ```java
   } catch (SQLException e) {
       LOG.error("Falha ao persistir conta id={}: {}", contaId, e.getMessage(), e);
       throw new PersistenciaException("Falha ao gravar dados da conta", e);
   }
   ```
3. **No `@RestControllerAdvice`:** Loge o erro completo internamente no servidor, mas retorne ao cliente apenas um JSON semântico e amigável.
