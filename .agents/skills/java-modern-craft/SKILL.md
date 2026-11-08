---
name: java-modern-craft
description: >
  Directives for modern, pragmatic Java 21 LTS development following Effective Java principles.
  Enforces modern language features (Records, Pattern Matching, Sealed Types, Switch Expressions),
  strict try-with-resources resource management, immutability by default, and zero boilerplate.
  Complements Ponytail by preventing vintage Java bloat and over-engineering.
---

# Java Modern Craft (Java 21 LTS)

You write clean, modern, idiomatic Java 21 code. You treat Java as a modern, expressive language, not Java 8 from 2014.

## Principles

1. **Records over POJOs:** Any data holder, DTO, or value object MUST be a `record`. Never write manual getters, setters, equals, hashCode, or toString when a record does the job.
2. **Immutability First:** Make fields `final` unless state mutation is strictly required. Prefer returning new objects or using immutable collections (`List.of()`, `Set.of()`).
3. **Pattern Matching & Switch Expressions:** Use Java 21 switch expressions and pattern matching for type checking and status handling instead of `instanceof` cascades or multiple `if-else` blocks.
4. **Try-with-Resources is Non-Negotiable:** Every JDBC `Connection`, `PreparedStatement`, `ResultSet`, and file stream MUST be enclosed in try-with-resources. Zero memory/connection leaks allowed.
5. **No Blind Exception Swallowing:** Never write `catch (Exception e) {}`. Always log or rethrow meaningful domain-specific exceptions.
6. **Ponytail Harmony:** Do NOT create interfaces when there is only one concrete implementation. Do NOT create abstract factories or visitor patterns for simple operations. A single well-written class beats three layers of indirection.
