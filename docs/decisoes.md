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

## Entrega de auditoria (2026-11-10)

- **2026-11-10 — "Mensagens do dia" no Menu com dados reais.** A tabela mostra as contas atrasadas de 1 a 15 dias e as que vencem de hoje até 10 dias, como na regra `VerificarVencimentosAoAbrir` do VBA, com pasta e pagador. O rodapé traz os recados vigentes hoje. Quando não há nada pendente, aparece "Tudo em dia!". Endpoint: `GET /api/contas/alertas`.
- **2026-11-10 — Pop-ups enxutos em 3 tipos (pesquisa: SweetAlert2/sonner/WAI-ARIA/NN/g).** **Confirmação** (`dialogos.ts`, `role=alertdialog`, botão com o verbo da ação, foco no Cancelar) só para sair sem salvar, excluir, desfazer pagamento e conta parecida. **Notificação** (`notificacoes.ts`) para o resultado de uma ação: sucesso some em 5 s, erro só fecha quando o usuário fecha. **Erro junto ao campo** para o que foi digitado. Os modais de "sucesso", "informação" e "erro" foram removidos, e todos os textos ganharam acento e linguagem simples.
- **2026-11-10 — Conta recorrente guarda PF/PJ (migração v12, aditiva) e aceita "débito automático".** Antes, o PF escolhido era descartado e "Débito" virava "Transferência". O domínio de formas de pagamento é único para contas e recorrências: boleto, pix, cartão, transferência, dinheiro e débito.
- **2026-11-10 — Contas fixas podem ser regeradas ou excluídas na tela de Recorrentes.** "Gerar próximos meses" completa os 12 meses à frente, sem duplicar. Excluir remove só as contas não pagas.
- **2026-11-10 — Nota fiscal anexada pode ser baixada (Todas as Contas › detalhe).** O PDF vai direto para `Downloads\Chaveiro Universal - Notas Fiscais`, sem a janela nativa "Salvar como" (risco de bug de foco), e a notificação oferece o botão "Abrir".
- **2026-11-10 — Correções da auditoria.**
  - Editar uma conta não apaga mais o vínculo com a empresa emissora.
  - CNPJ duplicado mostra o aviso no campo em vez de "erro interno".
  - Categoria voltou a ser texto livre com sugestões, conforme a decisão de 2026-11-08.
  - Os campos de pagador sugerem os pagadores cadastrados.
  - A tabela de empresas mostra telefone e endereço.
  - As mensagens ganharam o status AGENDADO.

## Fase 4 — filtros, gráficos e impressão (2026-11-10)

- **2026-11-10 — Filtros avançados em Todas as Contas, Pagos e Recorrentes.** Período (todo, este mês, mês passado, próximo mês, este ano) e ordenação (data, valor, empresa A-Z). A busca aceita texto sem acento ou **valor** ("150" acha R$ 150,00 e R$ 1.150,00), como o `RealizarBusca` do VBA. Também entraram os filtros do Stitch que faltavam: PF/PJ nas Recorrentes e DIAS ÚTEIS nas Mensagens. Módulo `filtros.ts`, testado em `desktop/teste-filtros.js`.
- **2026-11-10 — "Hoje" é calculado no horário local.** O `toISOString()` usava UTC, e das 21h à meia-noite as contas que vencem hoje apareciam como atrasadas.
- **2026-11-10 — Gráficos consolidados.** O fluxo mostra sempre os últimos 6 meses, com pago × pendente por mês, independente do período escolhido. Entraram os 5 maiores fornecedores do período e a quantidade de contas pagas e pendentes nos indicadores.
- **2026-11-10 — Impressão por PDF, sem a janela nativa de impressão.** O botão IMPRIMIR (Gráficos) e IMPRIMIR LISTA (Todas as Contas) geram um PDF da tela em `Downloads\Chaveiro Universal - Relatórios` e o abrem no leitor padrão, onde o usuário imprime. O CSS `@media print` esconde navbar, botões e editores.

## Fase 5 — logs, instalador e atualização (2026-11-10)

- **2026-11-10 — Logs em arquivo com rotação, na pasta `logs` ao lado do banco.** O `app.log` (Electron) vira um novo arquivo a cada 5 MB e mantém os 3 anteriores. O `backend.log` (Spring) também roda a cada 5 MB, com limite de 50 MB. Nos testes, os logs ficam ao lado do banco temporário. O token da API nunca é registrado.
- **2026-11-10 — Instalador com electron-builder (NSIS) e Java mínimo via `jlink`.** O planejado era Electron Forge + `jpackage`, mas como o backend é um processo filho do Electron, o `jlink` do JDK local, sem download, gera só o runtime necessário (cerca de 50 MB), e o NSIS do electron-builder instala por usuário, sem administrador, com atalhos. O instalador final tem cerca de 143 MB e é gerado por `npm run instalador`.
- **2026-11-10 — Sem assinatura digital do `.exe`.** Não há certificado; o Windows mostra "O Windows protegeu o computador" na primeira vez (documentado em `docs/instalacao.md`).
- **2026-11-10 — Atualização = rodar o instalador novo por cima.** Os dados ficam em `%LOCALAPPDATA%` e não são tocados, e o backup automático pré-migração protege as mudanças de estrutura. Não há atualização automática pela internet, porque o sistema é offline.
- **2026-11-10 — JSON ilegível na API devolve 400 ("dados invalidos"), não 500.**

## Testes reais e isolamento (2026-11-10)

- **2026-11-10 — `smoke-real`, `smoke-boot` e `smoke-dev` passaram a usar banco temporário.** Eles rodavam contra o banco operacional, violando a regra de ouro. A data do arquivo mostrou que não houve gravação. Todo teste novo define `FINDESK_DB_PATH` antes de subir o app.
- **2026-11-10 — Teste de CRUD real (`desktop/teste-crud-real.js`).** Usa clique e digitação reais do Windows, dados concretos e todos os campos, e faz criar, ler, editar e excluir em cada tela, além de baixa, desfazer pagamento, PDF da nota e impressão. O banco, os Downloads e os PDFs ficam em `%TEMP%`.
- **2026-11-10 — Notificações nunca bloqueiam a tela.** São compactas e no máximo 2. O corpo deixa o clique passar e só os botões ABRIR e × recebem clique. O teste real mostrou que as notificações cobriam os botões PAGO e APLICAR.
- **2026-11-10 — Inserir Conta mostra só os erros da etapa atual, e o erro some quando o campo é corrigido.**

## Neobrutalismo à risca (2026-11-10)

- **2026-11-10 — Cantos sempre retos.** Uma regra no CSS base zera o `border-radius` de tudo. Os selos (status, pasta, PF/PJ, alertas do Menu) passaram de pílulas arredondadas para quadrados com borda preta de 2 px.
- **2026-11-10 — Painéis com borda grossa e sombra dura.** As telas de tabela (Todas as Contas, Pagos, Recorrentes, Mensagens) tinham painéis com borda de 1 px e sem sombra; agora têm borda de 3 px e sombra `4px 4px 0 #1c1b1b`. Os botões [HOJE] e [DIAS ÚTEIS] também ganharam borda de 2 px e sombra.
- **2026-11-10 — Nova chave de carregamento (substitui a chave 3D girando no próprio eixo).** O desenho 2D chapado mostra uma chave laranja com contorno preto grosso e sombra dura entrando no cadeado amarelo; o cadeado "estala" e abre (a haste sobe, com riscos de impacto) e o ciclo recomeça. É feita só com CSS, sem timers, e com `prefers-reduced-motion` a animação fica parada.

## Ajustes de uso pedidos pelo usuário (2026-11-11)

- **2026-11-11 — Chave de carregamento entra PELA FECHADURA (substitui "desenhada atrás do cadeado").** A chave fica na frente do cadeado e a lâmina é cortada (`clip-path`) na borda do buraco da fechadura, dando a impressão de entrar nele.
- **2026-11-11 — Painéis com borda simples de 2 px em volta, sem sombra dura (substitui "painéis com borda grossa e sombra" de 2026-11-10).** Vale para painéis, tabelas e cartões de formulário. Botões, navbar, Menu e submenus mantêm a sombra.
- **2026-11-11 — Sem "Período" e "Ordenar" nas tabelas.** Foram removidos de Todas as Contas, Pagos e Recorrentes. A ordem é fixa: vencimento (contas) e pagamento mais recente (pagos). `noPeriodo` e `montarControlesAvancados` saíram de `filtros.ts`.
- **2026-11-11 — Todas as Contas mostra só as colunas principais.** São Vencimento, Empresa, Valor, Na pasta, Status, Pago e Não pago. O botão » no cabeçalho mostra Documento, Conta (PF/PJ), Cobrança e Pagador (`tabela-colunas.ts`, classe `.col-extra`).
- **2026-11-11 — Uma única área de edição.** O painel "Detalhe da conta" e o botão ESTORNAR (igual ao NÃO PAGO) foram removidos. A área de edição tem as ações PAGO, NÃO PAGO, IMPRIMIR CONTA, BAIXAR NOTA e EXCLUIR, e "Alterar um campo". O aviso "Nenhum … selecionado" fica fora da tabela, no lugar onde a área surge (também em Pagos, Recorrentes e Mensagens).
- **2026-11-11 — Impressão = documento formal, não foto da tela.** IMPRIMIR LISTA gera uma relação em tabela com o filtro e o total. IMPRIMIR CONTA gera uma "Ficha de conta a pagar" (campos + assinaturas); a nota vai na página 2 (foto como imagem, PDF juntado com `pdf-lib` no processo principal; Word só é citado). Gráficos continua imprimindo a tela.
- **2026-11-11 — Nota fiscal obrigatória na conta nova: arquivo OU marca "Conta sem nota fiscal" (migração v13, `sem_nota_fiscal`; substitui "anexo opcional em PDF até 15 MB").** São aceitos PDF, JPG, PNG, WEBP e Word .docx até **10 MB**, o padrão mais comum nas fontes pesquisadas. O backend decide o tipo pelo conteúdo (magic bytes), não pela extensão, e recusa .doc/.docm, .docx com macro, PDF com `/JavaScript` ou `/Launch` e zip-bomb. O nome é salvo com a extensão real (`AnexoNotaFiscal.java`). Contas antigas e geradas por recorrência não são bloqueadas.
- **2026-11-11 — Tabelas de recepção do legado separadas (migração v14).** As tabelas `legado_lancamentos` (abas JANEIRO..DEZEMBRO: DATA, NRO DOCTO, FORNECEDOR, VALOR, PAGOS, OBSERVAÇÕES, QUEM VAI PAGAR), `legado_padroes` (Config_Padroes) e `legado_avisos` (Config_Avisos) guardam o texto bruto e a origem (arquivo, aba, linha, `UNIQUE`). `id_conta_migrada` liga cada linha à conta que ela gerar. Ainda não há importador nem tela; isso fica para quando os dados forem enviados. A aba `Temp_Boletos_Aviso` é derivada e não é importada.
- **2026-11-11 — Navbar estreita: o hambúrguer alinha com a margem do conteúdo e o menu lateral abre colado logo abaixo dele (posição calculada em `navbar.ts`).** O bloco de conteúdo ganhou largura explícita (`width:100%`) e não fica mais maior que a janela por causa de tabelas largas.
- **2026-11-11 — Menu: clicar no painel "Mensagens do dia" abre Todas as Contas.**

## Segunda rodada de ajustes (2026-11-12)

- **2026-11-12 — Migração v15: `avisos` recriada sem o CHECK antigo de dia da semana.** Bancos criados com a primeira versão da v11 (commit `3f11ca7`, depois editada no lugar) aceitavam só UM dia, e por isso a tela não conseguia salvar mensagens com vários dias ("SEGUNDA,TERCA,..."). A tabela é recriada e os dados copiados; a antiga fica guardada como `avisos_antes_v15`, sem DROP. Lição: nunca editar uma migração já aplicada; criar uma nova.
- **2026-11-12 — Uma única área de edição em todas as telas (Contas, Pagos, Recorrentes, Mensagens e Cadastros).** O cabeçalho é amarelo ("… SELECIONADO"), com resumo, AÇÕES e "Alterar um campo". `editor-registro.ts` monta os campos e mostra caixa de texto com máscara, caixa de seleção (listas fechadas) ou painel próprio (telefones da empresa); DESFAZER volta ao valor gravado. Cadastros deixou o formulário inteiro e passou a editar um campo por vez. Isso corrigiu o bug do painel de Banco que mostrava campos de Empresa.
- **2026-11-12 — Pagador responsável é caixa de seleção com os pagadores cadastrados (`pagadores.ts`).** Vale para Inserir Conta, Conta Recorrente e os editores. Um nome antigo digitado à mão continua como opção "(não cadastrado)". No editor de Pagos, o banco também virou caixa de seleção.
- **2026-11-12 — "Mensagens do dia" com botões EXPANDIR e VER NO CONTROLE (substitui "clicar no painel inteiro").** EXPANDIR abre um pop-up de tela cheia com todas as contas e todos os recados (Esc ou FECHAR). Os recados de hoje ganharam bloco próprio (até 2 no Menu, o resto no pop-up), e o rodapé virou um resumo.
- **2026-11-12 — Agente pode trabalhar direto na `main` e enviar (`git push`) sem pedir de novo (substitui a regra "main intocável / push só com ordem").** Foi um pedido explícito do usuário. A condição é ter os testes obrigatórios verdes. Continuam proibidos force-push e reescrever histórico publicado (`AGENTS.md` §5).

## Limpeza das notas e backup no Google Drive (2026-11-12)

- **2026-11-12 — Limpeza trimestral das notas fiscais (migração v16).** Ao abrir, se a última limpeza foi há 3 meses ou mais, o sistema apaga o ARQUIVO da nota das contas **pagas** com vencimento há mais de 3 meses e roda `VACUUM`. A conta e os dados ficam, e `anexo_removido_em` registra a data. As contas **pendentes** mantêm a nota, que ainda serve para pagar. A data da última limpeza fica na tabela `manutencao`. Foi um pedido explícito do dono, por isso é exceção consciente à "regra de ouro". `LimpezaAnexosService`.
- **2026-11-12 — Backup "quebra-galho" em planilha no Google Drive.** A cada abertura, em segundo plano, grava `Contas a Pagar - dados AAAA-MM-DD.xlsx` em `<Meu Drive>\Chaveiro Universal - Backup`, que o Google Drive para computador sincroniza. São só os dados (7 abas, sem os arquivos das notas), uma planilha por dia e as 30 últimas mantidas. A pasta é detectada ("Meu Drive"/"My Drive" em qualquer unidade) ou definida por `FINDESK_PASTA_DRIVE`. Com banco de teste nunca escreve no Drive real. Se falhar, o Menu avisa uma vez. O `.xlsx` é gerado sem biblioteca (`PlanilhaXlsx`). Os backups locais `VACUUM INTO` continuam.
