---
name: project-architecture-map
description: >
  Mapa estrutural e arquitetura oficial definitiva do Sistema de Contas a Pagar
  (Chaveiro Universal). Descreve o fluxo dos 5 Botões do Menu, a Navbar Global
  e a esteira completa: Electron -> TypeScript/HTML/CSS -> Spring Boot 3.3 REST -> SQLite WAL.
triggers:
  - "arquitetura"
  - "mapa de arquitetura"
  - "fluxo de navegação"
  - "menu principal"
  - "navbar"
origin: "Padrões Arquiteturais Oficiais Chaveiro Universal"
license: "Autoral / Propriedade do Projeto Chaveiro Universal"
---

# Mapa Arquitetural & Fluxo Oficial do Sistema

Este documento define a arquitetura consolidada, fluxo de navegação e esteira de camadas do **Sistema de Contas a Pagar — Chaveiro Universal**.

---

## 1. Fluxo dos 5 Botões Principais & Navegação Global

```text
[ MENU PRINCIPAL (5 Botões Gigantes Neobrutalistas) ]
  │
  ├── 1. INSERIR CONTA (Amarelo #FFE600) ──► Formulário direto em 2 etapas
  │
  ├── 2. CONTROLE (Azul #38BDF8) ──────────► Submenu Controle:
  │                                           ├── TODAS AS CONTAS (Tabela com baixa rápida PAGO / NÃO PAGO)
  │                                           ├── CONTAS RECORRENTES (Fixas mensais/anuais)
  │                                           └── PAGOS (Histórico exclusivo de contas liquidadas)
  │
  ├── 3. CADASTROS (Laranja #FF8400) ──────► Submenu Cadastros:
  │                                           ├── TODOS OS CADASTROS (Abas: Empresas / Pagadores / Bancos)
  │                                           └── NOVO CADASTRO (Formulários: Nova Empresa / Novo Pagador / Novo Banco)
  │
  ├── 4. MENSAGENS (Rosa #FF5E89) ─────────► Quadro de recados e avisos internos da loja
  │
  └── 5. GRÁFICOS (Ciano/Verde #00FF66) ───► Resumo visual de despesas com impressão direta
```

### Componente de Navbar Global:
- **Telas filhas:** Apresentam barra fixa superior (≥900px) ou menu hambúrguer com véu escurecedor (<900px).
- **Identidade cromática:** Os botões possuem fundo branco por padrão e destacam com a cor oficial do módulo respectivo no hover.
- **Botão VOLTAR:** Possui pilha de histórico em `sessionStorage` com fallback seguro para o Menu Principal.

---

## 2. Arquitetura Oficial do Sistema (Desktop Híbrido 100% Offline)

A aplicação adota separação estrita em 3 camadas desacopladas:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. CAMADA DESKTOP & SHELL (Electron 33+)                                    │
│    - Janela BrowserWindow com show:false + foco reforçado (ready-to-show)   │
│    - contextIsolation: true, nodeIntegration: false, will-navigate bloqueado│
│    - Preload estrito (preload.js) expondo window.finDesk via contextBridge  │
│    - Orquestra subprocesso Java via child_process.spawn com porta dinâmica  │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ IPC (Navegação & Config)
┌──────────────────────────────────────▼──────────────────────────────────────┐
│ 2. CAMADA FRONTEND (TypeScript Puro + Tailwind CSS + esbuild)               │
│    - Vanilla TS sem frameworks (zero React, Vue ou Angular)                 │
│    - Roteamento leve multipáginas disparado por body[data-tela]             │
│    - Manipulação segura do DOM (createElement, textContent, sem innerHTML)  │
│    - Comunicação HTTP local assíncrona via fetch nativo                     │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ HTTP REST (127.0.0.1:<porta>)
                                       │ Header obrigatório: X-FinDesk-Token
┌──────────────────────────────────────▼──────────────────────────────────────┐
│ 3. CAMADA BACKEND REST (Spring Boot 3.3.x + Java 21 LTS + SQLite 3)         │
│    ├── @RestController  (Transporte HTTP, DTOs em Java 21 record, BeanVal) │
│    ├── @Service          (Regras de negócio, cálculos de datas, transações) │
│    ├── @Repository       (JDBC puro com PreparedStatements parametrizados)  │
│    └── SQLite 3          (Modo WAL, PRAGMA foreign_keys=ON, busy_timeout)   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Invariantes Críticos de Operação e Segurança

1. **Subprocesso Java Único:** O backend Spring Boot é iniciado uma única vez no boot do Electron e encerrado no evento `before-quit`.
2. **Porta Dinâmica e Localhost:** A porta é alocada dinamicamente (`net.createServer().listen(0)`), escutando estritamente em `127.0.0.1`.
3. **Token Efêmero Forte:** A cada execução, o Electron gera um token criptográfico de 24 bytes (`crypto.randomBytes(24).toString("hex")`), validado pelo Spring Boot via filtro HTTP. O token **nunca** é registrado em logs ou commitado.
4. **Isolamento Absoluto do Banco Operacional:** O banco oficial (`contas_a_pagar.db` em `%LOCALAPPDATA%`) **nunca** é utilizado por suítes de teste. Testes automatizados utilizam obrigatoriamente bancos temporários via variável de ambiente `FINDESK_DB_PATH`.
5. **Backups Atômicos:** Snapshots do banco em modo WAL são gerados unicamente via comando SQL `VACUUM INTO` ou SQLite Online Backup API. Cópia simples de arquivos com o banco aberto é estritamente proibida.
6. **Operação 100% Offline:** Zero dependência de internet ou serviços remotos em tempo de execução.

---

## 4. Contexto Histórico da Transição Arquitetural

* **Fase Inicial (Protótipo Legado):** O projeto foi concebido originalmente em JavaFX 21 (FXML + CSS nativo `-fx-*`). Essa estrutura foi integralmente preservada na tag Git `legado-javafx` (commit `d1558b3`).
* **Fase Atual (Produção):** Migrada com sucesso para a arquitetura híbrida Electron + TypeScript + Spring Boot REST, proporcionando maior flexibilidade de interface, layout responsivo e desacoplamento nativo entre UI e persistência de dados.
