---
name: java-clean-di-wiring
description: >
  Diretrizes de injeção de dependência limpa e inversão de controle para Spring Boot 3.3
  e Java 21 LTS. Impõe injeção estrita via construtor com campos final, proíbe @Autowired
  em campos privados e garante testabilidade unitária pura sem overhead de contexto Spring.
triggers:
  - "injeção de dependência"
  - "constructor injection"
  - "di"
  - "desacoplamento"
  - "autowired"
  - "spring service"
origin: "Padrões de Engenharia Spring Boot / Effective Java + Chaveiro Universal"
license: "Autoral / Padrões do Projeto Chaveiro Universal"
---

# Java Clean Dependency Injection (Spring Boot 3 + Java 21)

Diretrizes para desacoplamento de classes, inversão de controle e injeção de dependências limpa em aplicações Spring Boot 3.3 e Java 21 LTS.

## 1. Injeção Estrita via Construtor (Constructor Injection)

Todas as dependências entre camadas (`Controller` → `Service` → `Repository`) devem ser injetadas exclusivamente via construtor:

```java
@Service
public class ContaService {

    private final ContaRepository repository;
    private final NotificadorService notificador;

    // Construtor explícito: dispensável @Autowired no Spring moderno
    public ContaService(ContaRepository repository, NotificadorService notificador) {
        this.repository = Objects.requireNonNull(repository, "repository não pode ser nulo");
        this.notificador = Objects.requireNonNull(notificador, "notificador não pode ser nulo");
    }
}
```

### Regras de Ouro:
1. **Campos Obrigatórios `final`:** Todos os colaboradores injetados devem ser declarados como `private final`. Isso garante imutabilidade e thread-safety.
2. **Proibição de `@Autowired` em Campos Privados:**
   - ❌ **ERRADO:** `@Autowired private ContaRepository repo;` (Injeção por reflexão: esconde dependências, impede instanciação manual em testes unitários e acopla ao container).
   - ✅ **CORRETO:** Injeção via construtor com parâmetros explícitos.
3. **Zero Service Locators ou Singletons Estáticos:** Classes de negócio nunca devem invocar métodos estáticos para obter instâncias (`ApplicationContextProvider.getBean()`).

## 2. Separação Estrita de Responsabilidades em Camadas

```text
[ @RestController ]  ──(DTOs / Records)──►  [ @Service ]  ──(Records / Domain)──►  [ @Repository ]  ──►  [ SQLite ]
  Camada HTTP/REST                           Regras de Negócio & Cálculos              Persistência JDBC Puro
```

1. **Controller:** Apenas recebe DTOs, aciona validação (`@Valid`) e despacha para o Service. Zero SQL ou cálculo de juros.
2. **Service:** Orquestra transações, regras financeiras e validações de negócio. Não conhece detalhes HTTP (como `HttpServletRequest`).
3. **Repository:** Executa SQL parametrizado via JDBC puro. Não possui lógica visual ou regras de negócio.

## 3. Testabilidade Unitária Pura (Sem Subir Container)

Graças à injeção via construtor, os testes unitários do backend (`JUnit 5 + AssertJ`) instanciam os services diretamente na memória em poucos milissegundos, sem precisar carregar o contexto pesado do Spring (`@SpringBootTest`):
```java
@Test
void deveCalcularAcrescimoQuandoVencimentoAtrasado() {
    ContaRepository mockRepo = mock(ContaRepository.class);
    ContaService service = new ContaService(mockRepo, new NotificadorFake());
    // Execução instantânea e determinística
}
```
