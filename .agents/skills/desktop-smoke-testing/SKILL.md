---
name: desktop-smoke-testing
description: >
  Diretrizes para testes de ponta a ponta e fumaça em aplicações desktop Electron + Java.
  Cobre testes sintéticos rápidos (smoke.js), testes reais de mouse e teclado via PowerShell
  SendInput (smoke-real.js), isolamento obrigatório de banco de teste via FINDESK_DB_PATH
  e testes de persistência entre ciclos de reinicialização.
triggers:
  - "smoke test"
  - "teste e2e"
  - "teste de mouse"
  - "entrada real"
  - "teste persistencia"
  - "findesk_db_path"
origin: "Autoral / Metodologia de Testes Desktop do Projeto Chaveiro Universal"
license: "Autoral / Propriedade do Projeto Chaveiro Universal"
---

# Desktop Smoke & Real Input Testing

Diretrizes para validação automatizada de interfaces desktop Electron com backend Spring Boot e banco SQLite.

## 1. Isolamento Estrito do Banco de Testes

> **REGRA PERMANENTE DO PROJETO:** Testes automatizados NUNCA devem tocar no banco SQLite operacional da empresa (`contas_a_pagar.db` oficial em `%LOCALAPPDATA%`).

1. Todo script de teste deve definir a variável de ambiente `FINDESK_DB_PATH` apontando para um diretório temporário isolado:
   ```javascript
   const dbTemp = path.join(os.tmpdir(), `findesk-teste-${Date.now()}.db`);
   process.env.FINDESK_DB_PATH = dbTemp;
   ```
2. Ao final da suíte de testes, o arquivo temporário deve ser removido de forma segura.

## 2. Testes de Entrada Real do SO (SendInput via PowerShell)

Testes de interface injetados via JavaScript puro no DOM (como `element.click()`) não detectam falhas críticas de foco do sistema operacional, overlays invisíveis ou janelas que subiram sem ativação no Windows.

### Estratégia de Teste Real (`smoke-real.js`):
1. O teste inicializa o aplicativo Electron de forma autônoma.
2. Invoca o script auxiliar PowerShell (`entrada-real.ps1`), que utiliza a API nativa do Windows `[User32]::SendInput` para:
   - Mover o cursor físico do mouse para as coordenadas reais do elemento na tela.
   - Disparar cliques reais (`MOUSEEVENTF_LEFTDOWN` / `MOUSEEVENTF_LEFTUP`).
   - Disparar digitação física no teclado (incluindo TAB, BACKSPACE, caracteres especiais).
   - Testar interação com hover de mouse sobre botões.
3. Se um campo não receber foco real ou o clique cair em outra janela, o teste falha imediatamente.

## 3. Testes de Persistência em Ciclo Completo

Para verificar que os dados são realmente persistidos e recuperados após o aplicativo ser fechado:
1. Subir a aplicação com backend e banco de teste.
2. Inserir um registro fictício via interface ou API REST.
3. Encerramento forçado do processo Electron e Java.
4. Reabrir a aplicação do zero (cold start).
5. Consultar a tela/API e confirmar que o registro continua presente e íntegro.
6. Limpar o registro fictício.

