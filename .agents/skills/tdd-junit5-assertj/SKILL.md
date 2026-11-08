---
name: tdd-junit5-assertj
description: >
  Testing directives for financial rules and business logic using JUnit 5 Jupiter and AssertJ.
  Enforces writing unit tests for critical business rules (calculations, overdue dates, recurring bills,
  status transitions) with clear Given-When-Then structure and fluent assertions.
---

# TDD & Testing Standards (JUnit 5 + AssertJ)

Financial applications cannot afford math or calendar bugs. Critical business logic must have regression protection.

## Standards

1. **Test Scope:** Focus unit tests on `service/` classes and financial algorithms (calculations, date intervals, recurrence generation, status changes). Do not test pure getters/setters or framework glue.
2. **Naming Convention:** Method names MUST describe the scenario and expected outcome clearly in Portuguese or English:
   - `deveCalcularContaAtrasadaQuandoVencimentoForPassado()`
   - `deveManterContasPagasAoExcluirRecorrencia()`
3. **Given-When-Then / AAA Structure:**
   - Arrange (Dado): Set up the model records and input state.
   - Act (Quando): Execute the service method.
   - Assert (Entao): Use AssertJ fluent assertions (`assertThat(resultado).isEqualTo(...)`).
4. **Fast and Offline:** Unit tests must run in milliseconds in-memory without external dependencies or internet.
