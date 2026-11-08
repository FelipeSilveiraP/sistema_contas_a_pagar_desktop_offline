---
name: gsd-verify-work
description: >
  [DESATIVADA / RECOMENDADA PARA EXCLUSÃO] Antiga skill de verificação conversacional do Claude Code GSD.
  Substituída oficialmente por desktop-smoke-testing e debugging-and-error-recovery.
  Preservada no repositório apenas para registro histórico.
triggers: []
origin: "Port legado do Claude Code (Incompatível com OpenCode)"
status: "desativada"
---

# [DESATIVADA] GSD Verify Work

> ⚠️ **AVISO DE DESATIVAÇÃO:** Esta skill dependia de utilitários externos e arquivos de template do Claude Code ausentes no ambiente OpenCode.

## Substituição Oficial
Para a verificação e testes automatizados de ponta a ponta no **Sistema de Contas a Pagar — Chaveiro Universal**, utilize as skills ativas:
* [`desktop-smoke-testing`](../desktop-smoke-testing/SKILL.md): Testes automatizados de interface (smoke sintético) e testes de entrada real de mouse e teclado via PowerShell `SendInput`, com isolamento de banco de testes (`FINDESK_DB_PATH`).
* [`debugging-and-error-recovery`](../debugging-and-error-recovery/SKILL.md): Framework sistemático de 5 etapas para triagem e resolução de defeitos pela causa raiz.
