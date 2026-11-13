# Sistema de Contas a Pagar — Chaveiro Universal

Aplicativo desktop para Windows que substitui a planilha Excel/VBA de contas a pagar do Chaveiro Universal. Funciona **100% sem internet**, com interface de alto contraste (neobrutalista, desenhada no Google Stitch) pensada para usuários leigos, e regras financeiras centralizadas e testadas num backend Java.

> **Status (novembro/2026):** versão **1.3.0**. Todas as fases estão concluídas e o sistema está em uso na loja, com instalador próprio, backup no Google Drive e atualização pelo Drive. Detalhes em [Status](#status).

---

## Sumário

- [Funcionalidades](#funcionalidades)
- [Tecnologias](#tecnologias)
- [Arquitetura](#arquitetura)
- [Como executar](#como-executar)
- [Testes](#testes)
- [Estrutura de pastas](#estrutura-de-pastas)
- [API REST local](#api-rest-local)
- [Segurança e dados](#segurança-e-dados)
- [Status](#status)
- [Licença](#licença)

---

## Funcionalidades

O Menu Principal tem 5 botões (também acessíveis pelas teclas de atalho), e uma barra de navegação global aparece em todas as telas internas.

| Módulo | O que faz |
|---|---|
| **Inserir Conta** | Formulário em 2 etapas (fornecedor, pagador, valor, vencimento, categoria, forma de pagamento). A **nota fiscal é obrigatória**: um arquivo (PDF, foto ou Word de até 10 MB) ou a marca "conta sem nota fiscal". Alerta de **possível duplicidade** com a mesma regra do VBA: mesma conta no mesmo mês de vencimento. |
| **Controle** | **Todas as Contas** com colunas recolhíveis, baixa de pagamento e impressão formal (lista ou ficha da conta com a nota); **Contas Pagas**, com edição do pagamento; **Contas Recorrentes**, cada uma gerando 12 competências automáticas sem duplicar. A área de edição é a mesma em todas as telas. |
| **Cadastros** | Empresas/fornecedores (CNPJ e telefones), pagadores (CPF) e bancos (chave Pix), mais uma tela **Todos os Cadastros** com filtros e edição. |
| **Mensagens** | Quadro de avisos com período de validade e dias da semana. |
| **Gráficos** | Totais pago / a vencer / em atraso, fluxo mensal, gastos por categoria e impressão. |

Rotinas automáticas:
- **ao ligar o computador**, o sistema abre sozinho e abre o Chrome no e-mail da firma (configurável em `configuracoes.json`);
- **a cada abertura**, grava uma planilha Excel com os dados (sem as notas) na pasta do Google Drive, como backup;
- **a cada 3 meses**, apaga o arquivo das notas fiscais de contas pagas há mais de 3 meses (a conta fica);
- **atualizações** chegam pelo Google Drive: o Menu mostra "Nova versão" com o botão ATUALIZAR.

Recursos gerais:
- máscaras de moeda, CPF, CNPJ (inclusive o novo CNPJ alfanumérico), telefone, CEP e data;
- pop-ups próprios do sistema para confirmação, erro e sucesso;
- aviso antes de sair de um formulário com alterações não salvas;
- layout responsivo de 480 px até 1920 px de largura; a partir de 1366×768 as telas cabem sem rolar.

Regras financeiras importantes:
- **um pagamento por conta**, que pode ter valor diferente da conta (juros ou desconto);
- **baixa e estorno são atômicos**: o pagamento e o status da conta mudam juntos ou não mudam;
- o status de uma conta (PENDENTE/PAGO) só muda por baixa ou estorno, nunca por edição comum;
- valores em dinheiro são guardados em centavos (inteiros) no banco e manipulados como `BigDecimal` no Java, nunca como ponto flutuante.

## Tecnologias

| Camada | Tecnologia |
|---|---|
| Desktop | Electron 33 |
| Interface | HTML + **TypeScript puro** (sem React/Vue/Angular) + Tailwind CSS 3 (gerado localmente) |
| Build do frontend | esbuild (com code splitting) + `tsc` em modo estrito |
| Backend | Java 21 + Spring Boot 3.3 (API REST) |
| Banco de dados | SQLite 3 em modo WAL, JDBC puro com consultas parametrizadas |
| Build Java | Maven |
| Testes | JUnit 5 + AssertJ + MockMvc; smoke tests em Electron com entrada real do Windows |

## Arquitetura

```text
┌───────────────────────────────────────────┐
│ Electron (desktop/main.js)                │  abre a janela, inicia e encerra o backend,
│   └── preload.js (ponte segura, IPC)      │  sorteia a porta e o token a cada execução
├───────────────────────────────────────────┤
│ Interface (frontend/)                     │  1 HTML + 1 módulo TS por tela,
│   HTML + TypeScript + Tailwind            │  sem nenhuma regra financeira
└───────────────────┬───────────────────────┘
                    │ HTTP em 127.0.0.1 + header X-FinDesk-Token
┌───────────────────▼───────────────────────┐
│ Backend Spring Boot (backend/)            │  controllers → services → repositories
│                                           │  todas as regras de negócio e validações
└───────────────────┬───────────────────────┘
                    │ JDBC
              ┌─────▼──────┐
              │ SQLite WAL │  %LOCALAPPDATA%\ChaveiroUniversal\ContasAPagar\contas_a_pagar.db
              └────────────┘
```

- **Interface e regras separadas:** o frontend só consome a API, e o backend não conhece o Electron. Isso permite uma futura versão web sem reescrever o backend.
- **Processo único:** fechar a janela encerra o backend; não é possível abrir duas instâncias.
- **Inicialização real:** a tela de carregamento só some quando o banco e a API estão de fato prontos.

## Como executar

**Pré-requisitos:** Windows 10/11, JDK 21, Maven 3.9+, Node.js 20+ e Git.

```bash
git clone https://github.com/FelipeSilveiraP/sistema_contas_a_pagar_desktop_offline.git
cd sistema_contas_a_pagar_desktop_offline

npm install                      # dependências do frontend/desktop
mvn -f backend/pom.xml package   # compila o backend e gera backend/target/findesk-backend-0.1.0.jar
npm run dev                      # compila o frontend e abre o aplicativo
```

**Instalador para o computador da loja:** `npm run instalador` gera `release/Contas a Pagar - Chaveiro Universal - Instalador <versão>.exe`, que já leva o Java dentro. A pasta `release/` fica só com o instalador da versão atual. Para mandar a versão para a loja pelo Google Drive, use `npm run publicar -- "o que mudou"`. Instalação, atualização, local dos dados e logs estão em [docs/instalacao.md](docs/instalacao.md).

| Comando | Para quê |
|---|---|
| `npm run dev` | Compila o frontend e abre o app |
| `npm run app` | Abre o app sem recompilar |
| `npm run build` | Typecheck + CSS + bundle JS em `frontend/dist/` |
| `npm run typecheck` | Só a checagem de tipos do TypeScript |
| `npm run instalador` | Gera o instalador Windows em `release/` |
| `npm run publicar -- "novidades"` | Põe o instalador na pasta de atualizações do Google Drive |
| `python instalador/gerar-icone.py` | Regera o emblema (`instalador/icone.ico` e `frontend/assets/icone.png`) |

## Testes

```bash
mvn -f backend/pom.xml test               # testes do backend (JUnit 5)
mvn -f backend/pom.xml test -Dtest=ContaServiceTest   # uma classe de teste
npm run typecheck

npx electron desktop/smoke.js             # navegação, layout e diálogos em várias resoluções
npx electron desktop/smoke-boot.js        # tempo de inicialização
npx electron desktop/smoke-real.js        # cliques e teclado reais do Windows
node desktop/smoke-dev.js                 # cenário real do `npm run dev` (regressão do bug de foco)
node desktop/teste-persistencia.js        # os dados sobrevivem a fechar e reabrir o app
npm run test:frontend                     # máscaras, filtros e automações (sem Electron)
npx electron desktop/teste-crud-real.js   # criar, ler, editar e excluir em todas as telas (entrada real)
npx electron desktop/medir-layout.js      # mede rolagem e centralização das telas em 3 resoluções
```

- **Banco isolado:** todos os testes usam um banco temporário, definido pela variável `FINDESK_DB_PATH`, e nunca tocam o banco real da empresa.
- **Pré-requisito:** os smoke tests precisam do backend já compilado (`mvn package`) e do frontend já buildado (`npm run build`).
- **Mouse e teclado:** `smoke-real` e `smoke-dev` movem o mouse e digitam de verdade. Não use o computador enquanto eles rodam.

## Estrutura de pastas

```text
├── backend/              # API Spring Boot (Java 21)
│   └── src/main/java/com/chaveiro/
│       ├── api/          # controllers REST
│       ├── service/      # regras de negócio
│       ├── repository/   # acesso ao SQLite (JDBC)
│       ├── model/        # records de domínio
│       ├── database/     # conexão, migrações e inicialização do banco
│       └── web/          # filtro de token e CORS
├── desktop/              # processo Electron (main.js, preload.js, automacoes.js) e testes
├── instalador/           # empacotar.js, publicar.js, gerar-jre.js, emblema (icone.ico)
├── frontend/
│   ├── html/             # uma página por tela
│   ├── ts/               # TypeScript (main.ts despacha para ts/telas/<tela>.ts)
│   ├── css/  assets/     # Tailwind de entrada e fontes locais
│   └── dist/             # gerado pelo build (não versionado)
├── docs/
│   ├── estado-atual.md   # foco atual e pendências (curto, reescrito a cada entrega)
│   ├── decisoes.md       # registro de decisões de negócio e arquitetura
│   ├── plano-telas.md    # plano das telas e da navegação
│   ├── stitch/           # HTML de referência de cada tela do design
│   └── responsivo/       # capturas geradas pelos smoke tests
├── telas_referencia/     # imagens PNG do design Stitch
├── .claude/skills/       # skills para agentes de IA (Claude Code / OpenCode)
├── AGENTS.md / CLAUDE.md # instruções para agentes de IA
└── BRIEFING_PROJETO.md   # briefing original do projeto
```

O protótipo antigo em JavaFX foi removido da pasta e continua disponível na tag Git `legado-javafx`.

## API REST local

Todas as rotas ficam em `http://127.0.0.1:<porta>` e exigem o header `X-FinDesk-Token`; sem ele a resposta é `401`.

| Recurso | Rotas |
|---|---|
| Status | `GET /api/status`, `GET /api/backup-drive` (resultado do backup no Drive) |
| Contas | `GET/POST /api/contas`, `GET/PUT/DELETE /api/contas/{id}`, `GET /api/contas/{id}/anexo`, `GET /api/contas/alertas` |
| Pagamentos | `GET/POST/DELETE /api/contas/{id}/pagamento` (baixa e estorno), `GET /api/pagamentos`, `PUT /api/pagamentos/{id}` |
| Recorrentes | `GET/POST /api/recorrentes`, `GET/PUT/DELETE /api/recorrentes/{id}`, `POST /api/recorrentes/{id}/gerar` |
| Empresas | `GET/POST /api/empresas`, `GET/PUT/DELETE /api/empresas/{id}` |
| Pagadores | `GET/POST /api/pagadores`, `GET/PUT/DELETE /api/pagadores/{id}` |
| Bancos | `GET/POST /api/bancos`, `GET/PUT/DELETE /api/bancos/{id}` |
| Avisos | `GET/POST /api/avisos`, `GET/PUT/DELETE /api/avisos/{id}` |
| Gráficos | `GET /api/dashboard/resumo` |

Os erros voltam em JSON padronizado: `400` para dados inválidos (com o erro de cada campo), `404` para recurso inexistente e `409` para conflito ou possível duplicidade. Detalhes internos nunca são expostos.

## Segurança e dados

- **Offline:** fontes e CSS são locais e o sistema não faz nenhuma chamada à internet. O backup e as atualizações usam só a pasta local do Google Drive, que o próprio Drive sincroniza.
- **API isolada:** o servidor escuta só em `127.0.0.1`, com um token aleatório novo a cada execução que nunca é gravado em log. CSP ativa em todas as páginas e `contextIsolation` ligado no Electron.
- **Integridade do banco:**
  - transações ACID e chaves estrangeiras ativas;
  - modo WAL, que protege contra desligamento súbito;
  - migrações versionadas (`PRAGMA user_version`) que só acrescentam, nunca apagam.
- **Backups automáticos:** feitos via `VACUUM INTO`, que é a cópia segura em modo WAL. Há um backup diário e outro antes de cada migração, os últimos 8 são mantidos, e a restauração verifica a integridade antes.
- **Repositório sem dados sensíveis:** `.env`, planilhas, bancos SQLite e logs são ignorados pelo Git.

## Status

| Marco | Situação |
|---|---|
| Fase 0 — Auditoria e planejamento | Concluída |
| Fase 1 — Interface + API local | Concluída |
| Fase 2 — Navegação completa + barra global | Concluída |
| Fase 3 — Cadastros, contas, pagamentos, recorrentes, mensagens e gráficos (SQLite) | Concluída — em validação pelo usuário |
| Fase 4 — Filtros avançados, gráficos consolidados e impressão | Concluída |
| Fase 5 — Logs com rotação, instalador Windows (Electron + JRE embutido), atualização | Concluída |
| Ajustes de uso — nota obrigatória, impressão formal, edição unificada, backup e atualização pelo Drive, início automático | Concluídos (versão 1.3.0) |

Pendências conhecidas:
- validação visual final na resolução do monitor da empresa;
- o instalador não tem assinatura digital paga: o Windows mostra um aviso na primeira execução (ver [docs/instalacao.md](docs/instalacao.md)).

## Licença

Licença proprietária / source-available — Copyright (c) 2026 Felipe / Contas a Pagar Core. Todos os direitos reservados.

O código-fonte é público exclusivamente para auditoria técnica, avaliação em processos seletivos e estudo. É vedada a exploração comercial. Consulte [LICENSE.md](LICENSE.md) para os termos completos.
