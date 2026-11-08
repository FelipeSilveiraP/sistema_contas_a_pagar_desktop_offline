---
name: desktop-electron-java-bridge
description: >
  Padrão de integração híbrida entre Electron e Spring Boot (Java 21).
  Gerenciamento do processo filho Java, alocação dinâmica de porta, geração
  de token efêmero por execução, verificação de prontidão (/api/status),
  tratamento de falhas e encerramento limpo sem processos órfãos no Windows.
triggers:
  - "inicialização electron"
  - "backend java"
  - "porta dinâmica"
  - "token api"
  - "processo filho"
  - "processo orfao"
  - "spring boot electron"
origin: "Autoral / Arquitetura Própria Chaveiro Universal baseada em Node.js child_process e Spring Boot"
license: "Autoral / Propriedade do Projeto Chaveiro Universal"
---

# Desktop Electron + Java (Spring Boot) Bridge

Diretrizes arquiteturais para orquestrar o backend Java Spring Boot como processo filho gerenciado pelo processo principal do Electron.

## 1. Alocação Dinâmica de Porta

Nunca fixar a porta `8080` para evitar colisões com outros serviços na máquina do usuário:
```javascript
function portaLivre() {
  return new Promise((resolver, rejeitar) => {
    const servidor = net.createServer();
    servidor.listen(0, "127.0.0.1", () => {
      const p = servidor.address().port;
      servidor.close(() => resolver(p));
    });
    servidor.on("error", rejeitar);
  });
}
```

## 2. Token de Autenticação Efêmero por Execução

Para impedir que processos externos no computador do usuário chamem a API REST local:
1. O Electron gera um token criptográfico forte no boot:
   ```javascript
   const token = crypto.randomBytes(24).toString("hex");
   ```
2. O token é injetado via variável de ambiente para o processo filho:
   `FINDESK_API_TOKEN: token`.
3. O Spring Boot valida o cabeçalho `X-FinDesk-Token` em todas as requisições (exceto `/api/status` no probe).
4. O token **nunca** é gravado em disco ou impresso em logs.

## 3. Inicialização e Monitoramento do Processo Filho

```javascript
const proc = spawn("java", ["-jar", jarPath], {
  env: { ...process.env, SERVER_PORT: String(porta), FINDESK_API_TOKEN: token },
  stdio: ["ignore", "pipe", "pipe"],
  windowsHide: true,
});
```

- Registrar saída de log com prefixo claro `[backend]`.
- Tratar evento `exit`: distinguir encerramento voluntário do app de encerramento anômalo inesperado.

## 4. Verificação de Prontidão (Healthcheck Probe)

Aguardar confirmação explícita da API com timeout seguro (60s):
```javascript
async function aguardarBackend() {
  const inicio = Date.now();
  while (Date.now() - inicio < 60000) {
    try {
      const resp = await fetch(`http://127.0.0.1:${porta}/api/status`, {
        headers: { "X-FinDesk-Token": token }
      });
      if (resp.ok) {
        const dados = await resp.json();
        if (dados.inicializado === "true") return;
      }
    } catch {
      // Backend ainda em subida
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error("O backend Java não respondeu no tempo limite.");
}
```

## 5. Encerramento Limpo e Prevenção de Processos Órfãos (Windows)

No Windows, processos filhos podem sobreviver se o pai fechar abruptamente:
1. Registrar handlers em `before-quit` e `window-all-closed`:
   ```javascript
   function encerrarBackend() {
     encerrando = true;
     if (processoBackend && processoBackend.exitCode === null) {
       processoBackend.kill();
     }
   }
   app.on("before-quit", encerrarBackend);
   ```
2. Caso necessário em encerramento forçado, disparar terminação de árvore no Windows:
   `taskkill /pid <PID> /T /F`.

