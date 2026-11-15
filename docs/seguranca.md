# Auditoria de segurança — 2026-11-15 (versão 1.3.7)

Relatório em linguagem simples. Resumo: **não foi encontrada nenhuma falha grave**. O sistema já tinha uma base boa (só funciona dentro do próprio computador, exige uma "senha" aleatória em toda conversa entre a tela e o banco, e todo SQL é parametrizado). Foram corrigidos 12 pontos de risco baixo/médio e criados 32 testes JUnit novos que provam as correções.

## 1. Ferramentas usadas (e por quê)

| Ferramenta | O que faz | Por que foi escolhida |
|---|---|---|
| **Revisão manual guiada por OWASP Top 10 / ASVS** | Lista de verificação mundial de segurança de aplicações | Padrão de referência da OWASP (organização sem fins lucrativos) |
| **Semgrep** (regras oficiais `semgrep/semgrep-rules`) | Procura padrões perigosos no código Java/TS/JS | Ferramenta aberta muito usada; regras mantidas pela própria Semgrep |
| **SpotBugs + Find Security Bugs 1.14** | Analisa o Java compilado atrás de SQL injection, XSS, caminhos de arquivo etc. | Plugin de segurança mais conhecido para Java (regras OWASP) |
| **npm audit** | Procura falhas conhecidas (CVE) nas bibliotecas JavaScript | Já vem com o Node, usa a base de avisos do GitHub |
| **OSV-Scanner** (Google), no GitHub Actions | Procura CVEs no `package-lock.json` e no `pom.xml` | Base pública OSV; cobre npm **e** Maven |
| **Skills da Trail of Bits** (`github.com/trailofbits/skills`) | Roteiros de auditoria para o Claude Code | Empresa de segurança reconhecida; usada como referência de método (não foi instalada no projeto) |

O **OWASP Dependency-Check** não foi usado: ele precisa baixar a base NVD (lenta e com limite de acesso sem chave); o OSV-Scanner cobre o mesmo papel.

## 2. O que NÃO existe neste sistema

Este é o sistema **Contas a Pagar**. Ele **não tem** login, PIN, cadastro de usuário/admin, recuperação de senha por e-mail, configuração de SMTP/senha de app, importação de planilha nem envio de e-mail — esses itens são do projeto irmão (Garantias). Aqui, "e-mail" é só: (a) um campo de texto no cadastro de empresa e (b) abrir o Chrome no Gmail ao ligar o computador (endereço fixo em `configuracoes.json`, aceito só se começar com `http`/`https`). Por isso não há o que testar de força bruta em PIN nem envio em massa de e-mail.

## 3. Campos e rotas auditados

| Tela / rota | Campos | Na tela | No servidor | Risco encontrado | Correção |
|---|---|---|---|---|---|
| Inserir Conta / Todas as Contas — `POST/PUT /api/contas` | empresa (2–120), pagador (1–120), categoria (60), documento (60), valor, vencimento, PF/PJ, forma | máscaras + `maxlength` | tamanho, listas fechadas, 2 casas | **Valor sem teto**: R$ 1 bilhão era aceito; valor gigante dava "erro interno" | Teto R$ 999.999.999,99 na API **e** no banco (v18) |
| Nota fiscal (anexo) — mesmas rotas | arquivo até 10 MB | extensão + tamanho | **tipo real pelos primeiros bytes** (PDF/JPG/PNG/WEBP/DOCX), DOCX sem macro, limite de descompactação | PDF com JavaScript **disfarçado** (`/J#61vaScript`) ou **escondido em trecho compactado** passava | Busca também dentro dos trechos compactados e desfaz o disfarce |
| Nome do anexo | até 200, sem `\ / : * ? " < > \|` e sem caracteres de controle | — | renomeado com a extensão do tipo real | Download montava o cabeçalho à mão | Cabeçalho montado pelo Spring (RFC 6266) — sem injeção de cabeçalho |
| `GET /api/contas/{id}/anexo` | — | — | `Content-Type` pelo conteúdo | sem `nosniff` | `X-Content-Type-Options: nosniff` + `Cache-Control: no-store` em tudo |
| Baixa / estorno — `/api/contas/{id}/pagamento`, `PUT /api/pagamentos/{id}` | data, valor pago, banco | máscaras | transação única + gatilhos v17 | valor sem teto | Teto na API e no banco |
| Contas fixas — `/api/recorrentes` | empresa, pagador, categoria, documento, valor, dia 1–31, periodicidade | máscaras | tamanhos, CHECKs | **sem auditoria** (gera 12 contas de uma vez) | Auditoria automática (v18) |
| Banco — `/api/bancos` | instituição (2–120), chave Pix (77, sem espaço) | `maxlength` | igual | — | — |
| Pagador — `/api/pagadores` | nome (2–120), CPF (dígitos verificadores), função (100) | máscara CPF | igual | — | — |
| Empresa — `/api/empresas` | CNPJ (inclui alfanumérico), razão social, representante, e-mail (120), endereço, telefones | máscaras | igual | — | — |
| Mensagens — `/api/avisos` | datas, dias da semana, título (2–100), mensagem (2–500) | `maxlength` | igual | — | — |
| Gráficos — `GET /api/dashboard/resumo?de=&ate=` | datas | seletor | `LocalDate.parse` | data errada dava **"erro interno" 500** | Agora 400 |
| Todas as rotas | — | — | `TokenFilter` | rota inexistente / método errado / id não numérico davam 500 | Agora 404 / 405 / 415 / 400 |
| Todas as rotas | token | — | `TokenFilter` | token vazio seria aceito se o Electron não o passasse | Backend **não sobe** sem token de ≥ 16 caracteres |
| Todas as rotas | corpo | — | — | sem limite de tamanho do corpo | 413 acima de 15 MB; 411 sem tamanho declarado; tetos de conexões |
| Backup (`VACUUM INTO`) | caminho do arquivo | — | — | caminho montado como texto no SQL | Caminho vai como parâmetro |
| Backup no Google Drive | — | — | — | (pedido do usuário) garantir que nunca apaga arquivo alheio | Só apaga arquivo comum com nome exato `Contas a Pagar - dados AAAA-MM-DD.xlsx` direto na subpasta; recusa subpasta-atalho |
| `npm run publicar` (pasta de atualizações no Drive) | — | — | — | apagava pelo nome sem conferir se era arquivo | Só apaga arquivo comum com o nome exato do instalador |
| Electron (IPC) | — | — | — | qualquer página poderia pedir o token | Só páginas de `frontend/html` são atendidas; `sandbox` explícito; permissões (câmera etc.) negadas; "abrir nota" só abre `.pdf/.jpg/.png/.webp/.docx` |

**XSS (texto virando código na tela):** todos os dados da API entram por `textContent`. Os três `innerHTML` do código (`navbar.ts`, `submenu.ts`, `form-empresa.ts`) usam só modelos fixos — falso positivo do Semgrep, marcado com comentário. A CSP de todas as telas proíbe scripts de fora.

## 4. SQL Injection

Todo SQL de `repository/` usa `PreparedStatement` com `?`. Os dois lugares que juntam texto (`ContaRepository.listar/atualizar`) juntam **só trechos fixos do código**. Prova: `SqlInjectionApiTest` manda 8 ataques (`' OR 1=1 --`, `'; DROP TABLE contas_a_pagar; --`, `UNION SELECT`, `ATTACH DATABASE`…) em **todos os campos de texto de todos os cadastros** e confere que o texto é gravado exatamente como digitado, que o filtro `?status=' OR 1=1 --` devolve 0 contas, que nenhuma tabela some e que o `integrity_check` continua `ok`.

## 5. Banco de dados

- Baixa/estorno, recorrência (12 contas) e exclusões já eram transações únicas (v17). Conta paga não pode ser excluída; status coerente com o pagamento; auditoria somente-inclusão.
- **Nova migração v18** (só acrescenta): auditoria de `boletos_recorrentes` e teto de valor por gatilho em contas, pagamentos e recorrências.

## 6. Rede, força bruta e DDoS — o risco real

- O backend escuta **só em 127.0.0.1** (testado ao vivo: pelo IP da rede a conexão é recusada). Ninguém da internet nem da rede da loja alcança a API.
- Toda rota exige o token aleatório de 48 caracteres gerado a cada abertura (testado em todas as 42 rotas com 5 tokens errados). Adivinhar esse token por tentativa é inviável (2¹⁹² possibilidades).
- **DDoS (derrubar o sistema com excesso de acessos):** para um app desktop offline o risco é **praticamente nulo** — não há porta aberta para fora. O único "atacante" possível seria um programa já rodando no próprio computador, e esse programa já teria acesso aos arquivos. Mesmo assim foram postos tetos baratos (20 threads, 100 conexões, 15 s de espera, corpo de 15 MB) para que um erro ou programa mal-comportado não esgote a memória.
- A única saída para a internet é o Google Drive (sincronizado pelo próprio app do Google) e abrir o Gmail no Chrome.

## 7. Dependências

| Item | Antes | Depois | Situação |
|---|---|---|---|
| Spring Boot | 3.3.5 (sem suporte desde 06/2025) | **3.5.16** | Atualizado; 176 testes verdes |
| sqlite-jdbc | 3.45.2.0 | **3.54.1.0** | Atualizado |
| esbuild | 0.24.2 (aviso só do servidor de desenvolvimento, não usado) | **0.25.12** | Atualizado |
| pdf-lib (vai no sistema instalado) | 1.17.1 | — | `npm audit --omit=dev`: **0 falhas** |
| **Electron** | 33.4.11 | **não atualizado** | 46 avisos (14 altos). Quase todos exigem recursos que o sistema não usa (webview, extensões, pop-ups, protocolos próprios) **ou** um ataque XSS anterior — e o sistema só abre arquivos locais com CSP rígida. Mesmo assim é a pendência nº 1: a troca de versão grande pode trazer de volta o bug de foco dos inputs e precisa dos testes de entrada real no Windows. |
| electron-builder | 25.1.8 | **não atualizado** | avisos em `tar` e afins: só na hora de **gerar** o instalador, com arquivos do próprio projeto. Atualizar junto com o Electron. |

## 8. Pendências (decisão do usuário)

1. **Atualizar o Electron** (33 → versão atual) numa entrega própria, com smoke-real, smoke-dev e CRUD real no Windows.
2. **Assinatura das atualizações:** hoje o sistema confere o SHA-256 do instalador, mas o `versao.json` fica na mesma pasta do Drive. Quem tiver permissão de **edição** nessa pasta poderia trocar os dois. Proposta: assinar o `versao.json` com uma chave que só o PC de desenvolvimento tem (Ed25519, nativo do Node). Enquanto isso, **compartilhe a pasta de atualizações só com quem precisa**.

## 9. Placar dos testes (nuvem, Linux)

| Teste | Resultado |
|---|---|
| `npm run typecheck` + `npm run build` | passou |
| JUnit (`mvn package`) | **178 passaram, 0 falharam** (eram 146; +32 novos) |
| `npm run test:frontend` | máscaras 65/65 · filtros 22/22 · automações 26/26 |
| SpotBugs + Find Security Bugs | passou (exceções justificadas em `backend/spotbugs-exclusoes.xml`) |
| `npx electron desktop/smoke.js` | **336/336** (Linux com tela virtual) |
| `node desktop/teste-persistencia.js` | **11/11** |
| `npx electron desktop/smoke-boot.js` | 10 verificações OK, depois parou: usa função só do Windows (`dipToScreenPoint`) e PowerShell — vai rodar no GitHub Actions (Windows) |
| smoke-real, smoke-dev, CRUD real | não deu para rodar na nuvem (precisam do mouse/teclado do Windows); estão no GitHub Actions como informativos |
| Teste ao vivo do jar | sem token → 401 · IP da rede → recusado · 20 MB → 413 · sem tamanho → 411 · sem token configurado → não sobe |

Observação: na nuvem o JUnit precisa de `LANG=C.UTF-8` (um teste usa nome de arquivo com acento); no Windows e no GitHub Actions isso já é o padrão.
