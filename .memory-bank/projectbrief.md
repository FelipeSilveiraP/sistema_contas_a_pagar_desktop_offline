# Project Brief: Sistema Contas a Pagar (Chaveiro Universal)

## Visão Geral
Sistema desktop financeiro 100% offline, desenhado no Google Stitch (29 telas) com identidade visual Neobrutalista, desenvolvido em Java 21 LTS e JavaFX com persistência em SQLite local e empacotamento executável (.exe para Windows).

## Objetivos Centrais
1. Substituir a planilha legado em Excel com 90KB de código VBA (`vba/CONTAS-A-PAGAR-2026 - Melhorado2.xlsm`).
2. Blindar a operação contra erros humanos para usuários e atendentes leigos: botões grandes, fluxos simples e confirmações visuais táteis.
3. Garantir resiliência total contra desligamentos súbito de energia (modo SQLite WAL).
4. Servir como projeto de referência para estudos de alto nível para concursos públicos de TI (Clean Architecture, GoF patterns, Pure DI, TDD e JDBC puro).
