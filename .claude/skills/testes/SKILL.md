---
name: testes
description: Como testar neste projeto — JUnit 5 + AssertJ sobre SQLite temporário, MockMvc, smoke tests Electron (sintético, boot, entrada real SendInput, cenário npm run dev) e teste de persistência em cold start. Use ao escrever testes, ao validar uma entrega ou quando um teste falhar.
---

# Testes

Consolida `tdd-junit5-assertj` e `desktop-smoke-testing`.

## Isolamento (inegociável)

Todo teste usa um banco temporário:
- **JUnit:** `@TempDir`, ou o `findesk.db.path` aleatório em `backend/target/banco-testes/` definido em `src/test/resources/application.properties`;
- **scripts Node/Electron:** definem `process.env.FINDESK_DB_PATH` em `os.tmpdir()` antes de subir o app.

Nunca rode teste contra o banco operacional.

## Backend (JUnit 5 + AssertJ)

```bash
mvn -f backend/pom.xml test
mvn -f backend/pom.xml test -Dtest=ContaServiceTest
mvn -f backend/pom.xml test -Dtest=ContaServiceTest#nomeDoMetodo
```

- **Testes de service** (`src/test/.../service/`): instancie à mão sobre o SQLite temporário, sem Mockito e sem `@SpringBootTest`.
- **Testes de API** (`src/test/.../api/`): MockMvc com o token de teste (`token-teste-unitario`). Cubra 201/200/204/400/404/409 e 401 sem token.
- **Nome descreve cenário e resultado:** `deveManterContasPagasAoExcluirRecorrencia()`. Estrutura dado/quando/então com `assertThat(...)`.
- **Prioridade:** dinheiro, datas, recorrência, status e duplicidade. Para cada bug corrigido, um teste que falhava antes.

## Desktop

Antes de rodar: `mvn -f backend/pom.xml package` (gera o jar) e `npm run build`.

| Script | Como rodar | O que garante |
|---|---|---|
| `desktop/smoke.js` | `npx electron desktop/smoke.js` | Navegação, navbar, layout em 7 resoluções, diálogos (a11y/ESC/foco), zero erro de console, offline. Regera as capturas em `docs/responsivo/`. |
| `desktop/smoke-boot.js` | `npx electron desktop/smoke-boot.js` | Tempo de boot, tela de carregamento, interação imediata |
| `desktop/smoke-real.js` | `npx electron desktop/smoke-real.js` | Clique, digitação, TAB e hover **reais** do Windows (`entrada-real.ps1`, SendInput) |
| `desktop/smoke-dev.js` | `node desktop/smoke-dev.js` | Reproduz o `npm run dev` com entrada real. **Regressão obrigatória do bug de foco dos inputs.** |
| `desktop/teste-persistencia.js` | `node desktop/teste-persistencia.js` | Grava, mata o processo, reabre a frio e confere os dados |
| `desktop/teste-crud-real.js` | `npx electron desktop/teste-crud-real.js` | O sistema usado como um funcionário: clique e digitação reais, dados concretos, e criar, ler, editar e excluir em todas as telas (inclusive baixa, desfazer pagamento, PDF da nota e impressão). Banco, Downloads e PDFs em `%TEMP%`. |
| `desktop/teste-filtros.js` | `npm run test:filtros` | Período, ordenação, busca por texto/valor e "hoje" no horário local. |
| `desktop/teste-mascaras.js` | `npm run test:mascaras` | Funções puras das máscaras: formatação, cursor, Backspace sobre separador, CPF/CNPJ (inclusive alfanumérico), `paraCentavos` e datas. Roda sem Electron. |
| `desktop/medir-layout.js` | `npx electron desktop/medir-layout.js --capturas` | Rolagem e centralização das 18 telas em 3 resoluções. É uma ferramenta de inspeção, sem aprovado/reprovado. |

- `smoke.js`, `smoke-boot.js` e `smoke-real.js` dependem de `require("electron")`, então **rodam com `npx electron`, não com `node`**.
- `smoke-real` e `smoke-dev` movem o mouse e o teclado de verdade. Ninguém pode usar o PC durante, senão há falso negativo.
- **Por que a entrada real?** `element.click()` via JS não detecta janela sem foco no Windows nem overlay invisível. Foi assim que o bug de foco passou despercebido.
- **Para ler o resultado:** cada linha começa com `[OK]` ou `[FALHA]`. Reporte o total (X/Y) e nunca esconda uma falha.
