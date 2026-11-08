---
name: java-observability-logging
description: >
  Instrumenta o código Java/JavaFX desktop com logs estruturados, níveis de severidade
  corretos, IDs de correlação por operação, e cuidados rigorosos para nunca registrar
  senhas ou dados sensíveis. Baseado na skill observability-and-instrumentation do
  repositório addyosmani/agent-skills (github.com/addyosmani/agent-skills), adaptado
  para aplicações Java 21 + JavaFX + SQLite offline sem servidor.
  Use ao: adicionar qualquer operação de I/O, persistência ou regra de negócio;
  investigar falhas que "não têm pista"; revisar PR que adiciona novas funcionalidades.
triggers:
  - "adicionar log"
  - "logging"
  - "observabilidade"
  - "rastrear operação"
  - "log de auditoria"
  - "diagnóstico"
  - "java.util.logging"
  - "slf4j"
  - "log4j"
---

# Java Observability & Logging

> Código que você não consegue observar é código que você não consegue operar.
> Adaptado de [addyosmani/agent-skills – observability-and-instrumentation](https://github.com/addyosmani/agent-skills/tree/main/skills/observability-and-instrumentation).

---

## 1. Regra de Ouro: Defina "o que funcionou?" Antes de Logar

Antes de adicionar qualquer log, responda:

```
FUNCIONALIDADE: Pagamento de conta
PERGUNTAS QUE UM DESENVOLVEDOR FARÁ AO INVESTIGAR:
1. Qual conta foi paga, por quem e quando?
2. O pagamento falhou? Qual era o estado da conta antes?
3. O banco de dados respondeu com erro ou a falha foi na regra de negócio?
→ Cada linha de log deve ajudar a responder UMA dessas perguntas.
```

Se você não consegue formular as perguntas, não está pronto para logar — você
vai registrar ruído e não aprender nada.

---

## 2. Escolha o Logger Correto para o Projeto

Este projeto é **offline/desktop** sem infraestrutura de servidor.
Use **`java.util.logging` (JUL)** — já disponível no JDK, sem dependência extra.

```java
// Em CADA classe que precisa de log:
import java.util.logging.Logger;
import java.util.logging.Level;

public class ContaService {
    // Nome do logger = nome completo da classe (convenção JUL)
    private static final Logger LOG = Logger.getLogger(ContaService.class.getName());
}
```

> **SLF4J + Logback/Log4j2** são preferíveis em projetos com Maven/Gradle quando
> já tiverem dependências configuradas. Se o `pom.xml` incluir SLF4J, use-o.
> A filosofia abaixo se aplica a qualquer framework de logging.

---

## 3. Níveis de Severidade — Use Corretamente

| Nível | Significado | Ação esperada |
|---|---|---|
| `SEVERE` / `ERROR` | Invariante quebrada; dado pode estar inconsistente | Investigue imediatamente |
| `WARNING` / `WARN` | Degradado mas tratado (retry funcionou, fallback usado) | Monitore tendência |
| `INFO` | Evento de negócio significativo (conta paga, empresa salva) | Nenhuma |
| `FINE` / `DEBUG` | Detalhe diagnóstico | Desligado em produção por padrão |
| `FINEST` / `TRACE` | SQL bruto, valores de campos internos | Apenas em desenvolvimento |

```java
// ERRADO — nível errado + mensagem sem contexto
LOG.info("Erro ao pagar conta");

// CORRETO — nível certo + campos que permitem diagnóstico
LOG.severe(String.format(
    "[op=%s conta_id=%d valor=%.2f] Falha ao registrar pagamento: %s",
    operationId, conta.getId(), conta.getValor(), e.getMessage()
));
```

---

## 4. ID de Correlação por Operação — Obrigatório

Sem um identificador único por operação, logs de operações concorrentes ficam
entrelaçados e são impossíveis de reconstituir.

### 4.1 Geração do ID

```java
// Utilitário — gere um ID curto por operação de negócio
import java.util.UUID;

public final class OperationId {
    private OperationId() {}

    /** Gera ID curto (8 chars) para rastreamento de uma operação. */
    public static String generate() {
        return UUID.randomUUID().toString().substring(0, 8);
    }
}
```

### 4.2 Propagação nos Services (camada de negócio)

```java
public class ContaService {
    private static final Logger LOG = Logger.getLogger(ContaService.class.getName());

    public void registrarPagamento(long contaId, BigDecimal valor) {
        String opId = OperationId.generate(); // ← nasce aqui, propaga para baixo

        LOG.info(String.format("[op=%s conta_id=%d valor=%.2f] Iniciando pagamento",
                opId, contaId, valor));
        try {
            contaRepository.registrarPagamento(contaId, valor, opId);
            LOG.info(String.format("[op=%s conta_id=%d] Pagamento registrado com sucesso",
                    opId, contaId));
        } catch (SQLException e) {
            LOG.severe(String.format(
                "[op=%s conta_id=%d valor=%.2f] Falha SQL ao registrar pagamento: %s",
                opId, contaId, valor, e.getMessage()));
            throw new RuntimeException("Falha ao registrar pagamento", e);
        }
    }
}
```

### 4.3 Propagação nos Repositories (camada de dados)

```java
public class ContaRepository {
    private static final Logger LOG = Logger.getLogger(ContaRepository.class.getName());

    public void registrarPagamento(long contaId, BigDecimal valor, String opId)
            throws SQLException {
        LOG.fine(String.format("[op=%s conta_id=%d] Executando UPDATE no SQLite", opId, contaId));
        // ... PreparedStatement ...
    }
}
```

---

## 5. O Que NUNCA Logar — Regra Absoluta de Segurança

> Pipelines de log são caminhos clássicos de vazamento de dados.

```java
// PROIBIDO — nunca logar dados sensíveis
LOG.info("Login: usuario=" + email + " senha=" + senha);
LOG.fine("Payload: " + request.toString()); // pode conter CPF, senha, token
LOG.info("Boleto: " + boleto.toString());   // pode expor dados bancários

// CORRETO — logar apenas identificadores e status, nunca conteúdo sensível
LOG.info(String.format("[op=%s] Login: usuario_id=%d status=sucesso", opId, userId));
LOG.info(String.format("[op=%s conta_id=%d] Boleto processado: status=%s",
        opId, contaId, boleto.getStatus()));
```

### Campos que NUNCA devem aparecer em log:
- Senhas (em texto plano ou hash)
- Tokens de sessão
- Números completos de cartão de crédito
- CPF/CNPJ completo (use apenas últimos 4 dígitos se necessário)
- Dados bancários completos (agência + conta + dígito)
- Conteúdo completo de NF-e ou boletos

---

## 6. Configuração do Logger — Arquivo de Produção

Crie `src/main/resources/logging.properties`:

```properties
# Nível raiz: INFO em produção, FINE em desenvolvimento
.level=INFO

# Handler: arquivo rotativo + console
handlers=java.util.logging.FileHandler, java.util.logging.ConsoleHandler

# Arquivo de log — na pasta do usuário para não requerer permissão de admin
java.util.logging.FileHandler.pattern=%h/chaveiro_universal/logs/app_%u_%g.log
java.util.logging.FileHandler.limit=5000000
java.util.logging.FileHandler.count=3
java.util.logging.FileHandler.formatter=java.util.logging.SimpleFormatter
java.util.logging.FileHandler.append=true

# Formato da linha de log: data/hora | nível | logger | mensagem
java.util.logging.SimpleFormatter.format=[%1$tF %1$tT] [%4$s] %3$s — %5$s%6$s%n

# Console: apenas WARNING e acima para não poluir o terminal
java.util.logging.ConsoleHandler.level=WARNING
java.util.logging.ConsoleHandler.formatter=java.util.logging.SimpleFormatter

# Nível fino apenas para pacotes específicos durante debug
# com.chaveiro.repository.level=FINE
```

### Ativação na App.java:

```java
import java.util.logging.LogManager;
import java.io.InputStream;

public class App extends Application {

    static {
        // Carrega configuração de logging antes de qualquer classe usar LOG
        try (InputStream is = App.class.getResourceAsStream("/logging.properties")) {
            if (is != null) {
                LogManager.getLogManager().readConfiguration(is);
            }
        } catch (Exception e) {
            System.err.println("Aviso: não foi possível carregar logging.properties: " + e.getMessage());
        }
    }

    @Override
    public void start(Stage stage) throws IOException {
        // ... código existente ...
    }
}
```

---

## 7. Logs de Auditoria — Eventos de Negócio Permanentes

Para operações que mudam estado financeiro (pagar, excluir, editar conta),
o log deve servir também como trilha de auditoria:

```java
// Formato de auditoria: AUDIT | timestamp | operação | entidade | id | detalhes
private static final Logger AUDIT = Logger.getLogger("AUDIT.ContaService");

public void excluirConta(long contaId, String operador) {
    String opId = OperationId.generate();
    AUDIT.warning(String.format(
        "[op=%s] EXCLUSAO conta_id=%d operador=%s",
        opId, contaId, operador
    ));
    // O nível WARNING garante que auditoria vai para o log mesmo em produção
}
```

---

## 8. Integração com o Handler Global de Exceções

O projeto já possui `Thread.setDefaultUncaughtExceptionHandler` em `App.java`.
Complementar com log estruturado **antes** de exibir o alerta visual:

```java
private static final Logger LOG = Logger.getLogger(App.class.getName());

private void configurarTratamentoGlobalErros() {
    Thread.setDefaultUncaughtExceptionHandler((thread, throwable) -> {
        // Log estruturado com contexto da thread
        LOG.severe(String.format(
            "[thread=%s] Exceção não capturada: %s",
            thread.getName(), throwable.getMessage()
        ));
        // Log completo do stack trace em nível FINE para não poluir em produção
        LOG.log(Level.FINE, "Stack trace completo:", throwable);

        Platform.runLater(() -> exibirAlertaErroAmigavel(throwable));
    });
}
```

---

## 9. Logs em Tasks JavaFX Concorrentes

Qualquer operação de banco de dados deve rodar em `javafx.concurrent.Task`.
O log deve identificar o contexto da task:

```java
public class PagamentoTask extends Task<Void> {
    private static final Logger LOG = Logger.getLogger(PagamentoTask.class.getName());
    private final String opId = OperationId.generate();

    @Override
    protected Void call() throws Exception {
        LOG.info(String.format("[op=%s] Task de pagamento iniciada na thread: %s",
                opId, Thread.currentThread().getName()));
        try {
            // ... operação ...
            LOG.info(String.format("[op=%s] Task de pagamento concluída", opId));
        } catch (Exception e) {
            LOG.severe(String.format("[op=%s] Task falhou: %s", opId, e.getMessage()));
            throw e;
        }
        return null;
    }
}
```

---

## 10. Sinais de Alerta (Red Flags)

Rejeite em code review qualquer PR que contenha:

- System.out.println(...) em código de produção (não é rastreável, sem nível)
- e.printStackTrace() sem log associado (stack trace vai para stderr, não para o arquivo)
- Concatenação de senha ou CPF completo em mensagem de log
- Log sem identificador de operação (opId) em métodos de Service/Repository
- Nível INFO para erros SQL (deve ser SEVERE)
- Nível SEVERE para "conta não encontrada" (deve ser WARNING ou retorno tipado)
- Logger declarado como variável de instância (deve ser static final)
- LOG.log(Level.SEVERE, e.toString()) — use LOG.log(Level.SEVERE, "msg", e) para preservar stack

---

## 11. Checklist de Verificação

Antes de fazer merge de qualquer funcionalidade nova:

- [ ] Toda operação de negócio gera um opId e o propaga pela cadeia Service → Repository
- [ ] Cada método de Repository loga [op=X] ao iniciar e ao concluir (nível FINE)
- [ ] Cada método de Service loga [op=X] ao iniciar e ao concluir com sucesso (nível INFO)
- [ ] Exceções SQL são logadas em SEVERE com opId e mensagem descritiva
- [ ] Nenhuma senha, hash de senha, token ou CPF completo aparece em nenhum log
- [ ] logging.properties está em src/main/resources e é carregado em App.java
- [ ] O handler global de exceções usa LOG.severe(...) em vez de System.err.println
- [ ] Operações destrutivas (excluir, reverter pagamento) usam o logger AUDIT.*
- [ ] Ao forçar um erro em desenvolvimento, o log aparece no arquivo com opId rastreável

---

## 12. Exemplo Completo — Fluxo de Pagamento de Conta

```java
// ContaService.java
public class ContaService {
    private static final Logger LOG   = Logger.getLogger(ContaService.class.getName());
    private static final Logger AUDIT = Logger.getLogger("AUDIT.ContaService");

    private final ContaRepository repo;

    public ContaService(ContaRepository repo) {
        this.repo = repo;
    }

    public void pagarConta(long contaId, BigDecimal valor) {
        String opId = OperationId.generate();
        LOG.info(String.format("[op=%s conta_id=%d valor=%.2f] Iniciando pagamento",
                opId, contaId, valor));

        if (valor.compareTo(BigDecimal.ZERO) <= 0) {
            LOG.warning(String.format("[op=%s conta_id=%d] Valor inválido: %.2f",
                    opId, contaId, valor));
            throw new IllegalArgumentException("Valor de pagamento deve ser positivo");
        }

        try {
            repo.registrarPagamento(contaId, valor, opId);
            AUDIT.warning(String.format("[op=%s conta_id=%d valor=%.2f] PAGAMENTO_REGISTRADO",
                    opId, contaId, valor));
            LOG.info(String.format("[op=%s conta_id=%d] Pagamento concluído", opId, contaId));
        } catch (SQLException e) {
            LOG.severe(String.format(
                "[op=%s conta_id=%d valor=%.2f] Falha ao registrar no SQLite: %s",
                opId, contaId, valor, e.getMessage()));
            throw new RuntimeException("Erro ao pagar conta id=" + contaId, e);
        }
    }
}
```

```java
// ContaRepository.java
public class ContaRepository {
    private static final Logger LOG = Logger.getLogger(ContaRepository.class.getName());

    public void registrarPagamento(long contaId, BigDecimal valor, String opId)
            throws SQLException {
        LOG.fine(String.format("[op=%s conta_id=%d] Executando UPDATE contas SET status=PAGO",
                opId, contaId));

        String sql = "UPDATE contas SET status = 'PAGO', valor_pago = ?, data_pagamento = ? WHERE id = ?";
        try (var conn = ConnectionFactory.getConnection();
             var ps = conn.prepareStatement(sql)) {
            ps.setBigDecimal(1, valor);
            ps.setString(2, LocalDate.now().toString());
            ps.setLong(3, contaId);
            int rows = ps.executeUpdate();
            LOG.fine(String.format("[op=%s conta_id=%d] UPDATE afetou %d linha(s)", opId, contaId, rows));
        }
    }
}
```

---

## Referências

- [addyosmani/agent-skills – observability-and-instrumentation](https://github.com/addyosmani/agent-skills/tree/main/skills/observability-and-instrumentation)
- [java.util.logging – Javadoc JDK 21](https://docs.oracle.com/en/java/docs/api/java.logging/java/util/logging/package-summary.html)
- Skill complementar deste projeto: java-global-exception-safety
- Skill complementar deste projeto: desktop-security-guard
