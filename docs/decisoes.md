# Registro de decisões

Cada decisão em 2–3 linhas, com data. Não reescreva entradas antigas: se uma decisão mudar, acrescente uma nova que diga qual substitui.
A ordem de autoridade das fontes é: **design** = Stitch (`docs/stitch/`), **requisitos** = briefing e `docs/plano-telas.md`, **regra de negócio** = VBA original (`vba/`), **modelagem** = DER.

## Arquitetura e segurança

- **2026-11-05 — Electron + TypeScript + Spring Boot no lugar do JavaFX.** O protótipo JavaFX foi abandonado em favor da interface web desktop; ele está preservado na tag `legado-javafx`. O frontend não tem framework (TypeScript puro + Tailwind).
- **2026-11-07 — API só local com token por execução.** O backend escuta em `127.0.0.1`, numa porta sorteada, e exige `X-FinDesk-Token` (24 bytes aleatórios a cada inicialização). O token nunca vai para log nem disco, e não existe token padrão.
- **2026-11-07 — Banco em `%LOCALAPPDATA%\ChaveiroUniversal\ContasAPagar\`.** SQLite em WAL, com `foreign_keys` e `busy_timeout`. As migrações só acrescentam, versionadas por `PRAGMA user_version`. É proibido `DROP TABLE` destrutivo.
- **2026-11-07 — Backup só por `VACUUM INTO`.** Há backup diário (mantém os últimos 8) e outro antes de cada migração. A restauração só acontece se `PRAGMA integrity_check` retornar `ok`; cópia simples do arquivo é proibida.
- **2026-11-07 — Testes nunca tocam o banco operacional.** Todo teste automatizado usa um banco temporário via `FINDESK_DB_PATH`. Nenhuma operação destrutiva no banco da empresa.
- **2026-11-07 — Janela criada oculta e mostrada em `ready-to-show`.** A janela subia sem foco nem ativação no Windows, e os inputs não respondiam. Agora ela é exibida já ativada e o foco é reforçado em `did-finish-load`.
- **2026-11-08 — Proibidos diálogos nativos (`window.alert/confirm/prompt`).** Eles eram a causa raiz dos "inputs mortos": o Chromium não refaz o foco depois de um modal nativo. Todos os pop-ups passam por `frontend/ts/dialogos.ts`, e `desktop/smoke-dev.js` é a regressão obrigatória.
- **2026-11-07 — A tela de carregamento libera por prontidão real.** O Menu só abre quando a API responde `inicializado` (SQLite e migrações prontos), sem timers fixos. Se falhar, a tela mostra "Tentar novamente" e "Fechar".

## Cadastros

- **2026-11-07 — Banco = instituição + chave Pix.** A instituição é obrigatória (2–120 caracteres) e a chave Pix é opcional (≤77, sem espaços). Código, agência e conta foram removidos a pedido do usuário (migração v2 preserva os dados).
- **2026-11-07 — Pagador = nome + CPF + função.** O nome é obrigatório; o CPF é opcional, mas, se preenchido, os dígitos verificadores são validados; a função (cargo) é opcional, até 100 caracteres. O modelo PF/PJ do DER antigo foi descartado.
- **2026-11-07 — Empresa em 2 etapas, com vários telefones.** Os telefones ficam numa tabela separada (`telefones_empresa`). CNPJ, e-mail e telefone são validados no backend.
- **2026-11-08 — Edição de cadastros no painel inferior da tela "Todos os Cadastros".** A exclusão pede confirmação. Se o cadastro estiver vinculado a contas, a API recusa com 409 e mostra uma mensagem amigável.

## Contas e pagamentos

- **2026-11-08 — Dinheiro em centavos inteiros.** É `valor_centavos INTEGER CHECK (> 0)` no SQLite e `BigDecimal` no Java; nunca `float`/`double`.
- **2026-11-08 — Categoria é texto livre com sugestões.** O campo sugere as categorias já usadas (datalist), sem cadastro próprio.
- **2026-11-08 — Inserir Conta tem pagador e a marca "boleto está na pasta".** O anexo de nota fiscal é opcional, em PDF de até 15 MB, guardado no SQLite. A empresa emissora é um vínculo opcional (FK `SET NULL`, que preserva o histórico).
- **2026-11-08 — Possível duplicidade (regra do VBA).** É duplicata se o documento for igual, ou se o nome for parecido e o vencimento estiver a ≤5 dias ou a diferença de valor for de ≤R$ 150. Só se compara dentro do **mesmo mês de vencimento**. O usuário pode cadastrar mesmo assim (`forcar`), que pula só esse filtro: as validações, FKs e CHECKs continuam valendo.
- **2026-11-08 — Pagamento integral único por conta.** Há um pagamento por conta (`UNIQUE(id_conta)`), sem pagamento parcial. O valor pago pode ser diferente da conta (juros ou desconto), e correções são feitas editando o pagamento.
- **2026-11-08 — Baixa e estorno são atômicos.** O registro em `pagamentos` e a troca do status PENDENTE/PAGO acontecem na mesma transação. O status nunca muda por PUT da conta (teste `naoDevePermitirTrocarStatusViaPut`).
- **2026-11-08 — Recorrência gera 12 competências.** O dia é preservado; se o dia não existe no mês, usa o último dia (não pula o mês). A anti-duplicação é por nome + vencimento. Excluir a recorrência remove só as contas geradas **não pagas**.
- **2026-11-08 — Alertas de vencimento (regra do VBA).** "Vencidas" são as de 1 a 15 dias atrás; "a vencer" são as de hoje até 10 dias à frente.

## Interface

- **2026-11-08 — Máscaras obrigatórias e centralizadas em `mascaras.ts`.** Cobrem moeda digitada por centavos ("123456" vira "R$ 1.234,56"), CPF, CNPJ, telefone, CEP e data dd/mm/aaaa, preservando a posição do cursor.
- **2026-11-08 — A navbar usa a cor do módulo.** O fundo é branco; no hover, o botão é pintado na cor do módulo (MENU `#FFE600`, CADASTROS `#FF8C00`, CONTROLE `#2563EB`, MENSAGENS `#FF5E89`, GRÁFICOS `#00FF66`). O botão ativo fica branco, com uma barra inferior de 5 px.
- **2026-11-09 — Os cartões dos submenus têm tamanho fixo por faixa de largura.** Ficam centralizados e quebram linha sozinhos; a quantidade de cartões não muda o tamanho deles (referência: 3 cartões da tela Controle).
- **2026-11-09 — As telas cabem na janela sem rolar a partir de 1366×768.** Em telas largas (≥1024 px), os formulários longos usam 2 colunas (Inserir Conta, Criar Mensagem, Form Recorrente), e os gráficos ficam lado a lado. No Menu, os cartões preenchem a grade em vez de seguir a proporção da largura. A verificação é feita por `desktop/medir-layout.js`.
- **2026-11-09 — Botões de ação dos formulários centralizados; navbar sempre no mesmo lugar.** A navbar tem o mesmo respiro do topo em todas as telas, e `scrollbar-gutter: stable both-edges` impede que ela se desloque quando a barra de rolagem aparece. **Navbar e conteúdo ficam juntos no centro VERTICAL da janela**, com o mesmo espaço em cima e embaixo. Isso substitui a regra anterior, que deixava os cartões a 16–60 px da navbar, colados no topo. As margens são automáticas, e por isso uma página maior que a janela continua rolando sem cortar o topo. Teste: "Navbar + cartoes centralizados na vertical" no smoke.
- **2026-11-09 — O campo de valor mostra só "1.234,56".** O "R$" fica no rótulo ao lado, para não aparecer duplicado. Apagar todos os dígitos deixa o campo vazio, e ele não trava em "0,00". Valores sem vírgula com ponto de milhar ("1.234") são lidos como milhar.
- **2026-11-09 — CNPJ alfanumérico aceito (padrão da Receita a partir de 07/2026).** São 12 caracteres A-Z/0-9 mais 2 dígitos verificadores, calculados por módulo 11 com o valor ASCII−48. A máscara converte as letras para maiúsculas, e a validação vale no frontend e no backend.
- **2026-11-09 — Máscaras com testes próprios (`desktop/teste-mascaras.js`).** Apagar sobre um separador remove o dígito vizinho em vez de travar. O "novo valor" dos editores das tabelas ganha máscara de data ou de moeda conforme o campo escolhido. O dia de vencimento aceita só 2 dígitos. CPF continua opcional também na edição.

## Contexto para agentes de IA

- **2026-11-09 — Memory bank substituído.** As regras estáveis estão em `AGENTS.md` e `CLAUDE.md`; o conhecimento técnico, em `.claude/skills/`; as decisões, neste arquivo; e o momento atual, em `docs/estado-atual.md` (≤30 linhas).
- **2026-11-09 — Skills consolidadas: 23 viraram 8, em `.claude/skills/`.** Essa pasta é lida pelo Claude Code e pelo OpenCode. A pasta `.agents/` fica só para configuração local e está fora do Git.
