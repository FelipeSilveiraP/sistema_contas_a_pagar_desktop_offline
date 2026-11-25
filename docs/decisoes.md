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

## Automações e atualização (2026-11-12)

- **2026-11-12 — O sistema instalado abre sozinho com o Windows e, nesse início automático, abre o Chrome no e-mail.** Usa `app.setLoginItemSettings` com o marcador `--inicio-automatico`; aberto à mão, o e-mail não abre. Configurável em `configuracoes.json`, ao lado do banco. O arquivo aceita BOM e nunca é sobrescrito se estiver ilegível, e o endereço só pode ser http(s). Em desenvolvimento e nos testes nada é registrado no Windows. `desktop/automacoes.js`, teste em `desktop/teste-automacoes.js`.
- **2026-11-12 — Atualização pelo Google Drive (substitui "sem atualização automática").** `npm run publicar` põe o instalador e o `versao.json` (com SHA-256) em `Meu Drive\Chaveiro Universal - Atualizacoes`. Ao abrir, o Menu oferece ATUALIZAR se a versão for maior e o hash conferir. O instalador roda 3 s depois de o sistema fechar, e o NSIS reabre o sistema. Não há servidor nem internet própria: o transporte é o Drive que já sincroniza na loja.

## Emblema, release enxuto e limpeza (2026-11-12)

- **2026-11-12 — Emblema do sistema: cadeado laranja sobre placa amarela com contorno e sombra dura.** Gerado por `instalador/gerar-icone.py` (Pillow) em `instalador/icone.ico` (16 a 256 px) e `frontend/assets/icone.png`. Aparece na janela, na barra de tarefas (`setAppUserModelId`), no instalador e no `.exe`. O ícone e as propriedades do `.exe` (nome, versão, empresa) são gravados no `afterPack` com `resedit`, porque `signAndEditExecutable` segue desligado.
- **2026-11-12 — `release/` contém só o instalador da versão atual.** O empacotamento acontece em `build/empacotamento/` (apagada a cada execução), e `etapa()` passou a esperar cada passo terminar.
- **2026-11-12 — Hambúrguer alinhado em todas as telas.** `#nav-global` ocupa a largura toda (`align-self: stretch`) mesmo em telas com `items-center`, como Inserir Conta. O `.sr-only` do botão » ficou preso ao botão, porque esticava a página. Conferido nas 17 telas, em 760 e 480 px.
- **2026-11-12 — Limpeza.** Saíram do projeto `EXECUTAR_SISTEMA.bat` (substituído pelo instalador e pelo `npm run dev`), `docs/menu-principal.png` (sem uso), `.env.example` e os scripts locais do Stitch (fase encerrada), as pastas `docs/diagnostico-*` (o `smoke-dev` agora grava na pasta temporária) e 3 funções da API sem uso. Ficam: `telas_referencia/` e `docs/stitch/` (fonte do design), `vba/` (legado a importar) e `BRIEFING_PROJETO.md`.

## Navbar com INSERIR CONTA (2026-11-13)

- **2026-11-13 — Barra e menu do hambúrguer ganham INSERIR CONTA (amarelo, a cor dele no Menu); MENU PRINCIPAL passa a vermelho `#FF3B30` (substitui o amarelo da decisão de 2026-11-08).** Ao passar o mouse no amarelo, o ícone fica preto, não branco. Com 7 botões, a barra aparece a partir de **1024 px** de janela (antes 851) e usa botões compactos até 1279 px. Abaixo de 1024 px entra o hambúrguer.
- **2026-11-13 — Hambúrguer alinhado com a borda MAIS À ESQUERDA do conteúdo (antes: o primeiro elemento com borda).** O cálculo é refeito quando a janela ou o conteúdo muda (ResizeObserver e MutationObserver) e de novo 250 ms depois, porque estados intermediários deixavam o botão deslocado. O teste `desktop/teste-hamburguer.js` abre cada tela larga e a estreita passo a passo, do jeito que o usuário faz (17 telas × 12 larguras).
- **2026-11-13 — Hambúrguer FIXO no canto superior esquerdo, numa faixa fixa no topo (substitui "alinhado com o conteúdo", decidido no mesmo dia).** Abaixo de 1024 px, `#nav-global` vira uma faixa `position: fixed` de 84 px, da cor do fundo e com linha preta embaixo. O botão fica sempre a 16 px da esquerda e 12 px do topo, em todas as telas, mesmo rolando a página, e o conteúdo começa logo abaixo da faixa. Motivos: é o padrão de apps e sites, o menu abre da esquerda e o lugar fica previsível para o futuro uso no celular. O cálculo de alinhamento saiu do `navbar.ts`. `desktop/teste-hamburguer.js` confere posição, rolagem, conteúdo abaixo da faixa e ausência de rolagem lateral (17 telas × 10 larguras).

## Nota fiscal visível no Controle (2026-11-13)

- **2026-11-13 — A nota fiscal aparece logo abaixo da área de edição em Todas as Contas.** Foto (JPG, PNG, WEBP) aparece como imagem; PDF aparece no visualizador do Chromium (`<embed>` de um `blob:`); Word (.docx) aparece como um cartão com o nome, porque não dá para desenhá-lo. Clicar na nota (ou Enter/Espaço) abre um pop-up com IMPRIMIR, SALVAR NO COMPUTADOR e CANCELAR (`escolher()` em `dialogos.ts`, terceira resposta `textoAlternativa`). IMPRIMIR com foto gera a folha A4 com a imagem. Com PDF ou Word, o arquivo é gravado em Downloads e aberto no programa padrão (Ctrl+P), sem a janela nativa de impressão. SALVAR grava em `Downloads\Chaveiro Universal - Notas Fiscais`.
- **2026-11-13 — TROCAR/ANEXAR NOTA e EXCLUIR NOTA na mesma área.** Trocar usa o PUT que já existia (`anexoPdfBase64`) e pede confirmação se já havia nota. Excluir usa `DELETE /api/contas/{id}/anexo`, que apaga só o arquivo (nome e bytes) e deixa a conta "Não anexada". A regra "nota obrigatória" continua valendo só ao INSERIR a conta.
- **2026-11-13 — Visualizador de PDF sem eventos de mouse e foco.** O `<embed>` recebe `pointer-events: none` e `tabindex=-1`: o clique vai para o quadro, e o leitor de PDF nunca rouba o foco dos inputs (bug histórico). A CSP de `todas-as-contas.html` passou a liberar `frame-src blob:`, `object-src blob:`, `img-src blob:` e os 2 estilos internos do visualizador pelo hash (`'unsafe-hashes'` + sha256). Se uma versão nova do Electron mudar esses estilos, o PDF aparece pequeno, e o console mostra os hashes novos para trocar.
- **2026-11-13 — Prévia da nota também no Inserir Conta.** Ao escolher ou arrastar o arquivo, a nota aparece logo abaixo da área de anexo (mesmo desenho do Controle, com 24 rem de altura) e ganha o botão REMOVER. A montagem da prévia (foto, PDF ou cartão do Word) fica em `frontend/ts/nota-previa.ts`, usada pelas duas telas; `inserir-conta.html` recebeu as mesmas liberações de CSP.
- **2026-11-13 — Lição: o atalho "Contas a Pagar" da área de trabalho abre a versão INSTALADA (`%LOCALAPPDATA%\Programs\findesk`), não o código do projeto.** Mudança só aparece ali depois de `npm run instalador` e de instalar (ou de `npm run publicar` e ATUALIZAR). Para ver o código atual sem instalar, use `npm run dev`.
- **2026-11-13 — Selos de situação viram pílulas arredondadas (`.selo`), e o cabeçalho da área de edição deixa de ser amarelo (substitui "cabeçalho amarelo" de 2026-11-12).** NÃO/SIM, VENCE HOJE, PJ, BOLETO e afins eram retângulos com borda grossa, iguais a botões, e confundiam o usuário. Agora têm cantos redondos, borda fina e nenhuma sombra (a regra global de cantos retos, `border-radius: 0 !important`, passou a ignorar `.selo`); botões continuam retangulares com sombra. Vale para Todas as Contas, Recorrentes, Mensagens e o Menu. O cabeçalho "… SELECIONADO" ficou branco com linha preta embaixo em todas as telas; o amarelo marca só a linha escolhida na tabela. Versão 1.3.4, sem testes automáticos a pedido do usuário.
- **2026-11-13 — Emblema: só o cadeado, sem a placa amarela de fundo (substitui o emblema de 2026-11-12).** Na barra de tarefas o desenho antigo ficava pequeno, porque a placa ocupava o espaço. Agora o cadeado preenche a imagem toda: haste amarela, corpo laranja, fechadura e contorno pretos (o contorno faz o ícone aparecer na barra clara e na escura). Gerado por `instalador/gerar-icone.py`; entra na versão 1.3.4.
- **2026-11-13 — Área de edição mais limpa: sai a linha de resumo e o selo de situação do cabeçalho (substitui "cabeçalho com resumo" de 2026-11-12).** O cabeçalho mostra só "… SELECIONADO", o nome do registro e FECHAR. A tabela logo acima já traz vencimento, valor, situação e o resto; a nota fiscal tem quadro próprio. Vale para as 5 áreas de edição (Contas, Pagos, Recorrentes, Mensagens e Cadastros).
- **2026-11-14 — Abrir com o Windows: cadastro gravado pelo INSTALADOR e conferido com `reg.exe` a cada abertura (substitui `app.setLoginItemSettings`).** No PC de desenvolvimento o sistema registrava "ligado" no log, mas não aparecia na inicialização do Windows. Achados: no Electron 33, `setLoginItemSettings` grava o caminho sem aspas (e o caminho tem espaços), e `getLoginItemSettings` ignora o `name`, então nunca dava para conferir. Agora o `instalador/instalador.nsh` grava `HKCU\…\Run\Contas a Pagar - Chaveiro Universal` = `"<exe>" --inicio-automatico` já na instalação, inclusive na atualização silenciosa, e só apaga na desinstalação de verdade (`isUpdated`). O sistema confere e regrava a cada abertura (`desktop/automacoes.js`, `registroWindows`) e registra no log "presente/ausente". Respeita `abrirAoLigarComputador: false`. Conferido no Windows real: instalar sem abrir já cadastra; abrir e fechar mantém; o comando da inicialização abre o sistema e o Chrome no e-mail. Versão 1.3.5.

## Segurança no banco: gatilhos e transações (2026-11-14)

- **2026-11-14 — Migração v17: gatilhos de segurança no SQLite (pedido do usuário).** Ela só acrescenta: nenhum dado existente muda (o banco da loja estava coerente: 0 contas PAGO sem pagamento e 0 PENDENTE com pagamento).
  - `trg_conta_paga_nao_exclui` — **corrigiu uma perda de dados**: o `ON DELETE CASCADE` de `pagamentos` fazia "excluir conta paga" apagar o pagamento junto, sem aviso. Agora o banco recusa, o repositório converte em 409 e a tela mostra "desfaça o pagamento antes".
  - `trg_conta_nasce_pendente`, `trg_status_pago_exige_pagamento`, `trg_status_pendente_sem_pagamento` e `trg_pagamento_nao_troca_conta` — o status da conta fica sempre coerente com a tabela `pagamentos`, mesmo com SQL feito à mão. Um importador futuro tem de gravar a conta PENDENTE e depois o pagamento.
  - **Trilha de auditoria implementada (resolve a pendência "auditoria: implementar ou descartar").** `auditoria_operacoes` recebe, por gatilho, toda inclusão, alteração e exclusão em `contas_a_pagar` e `pagamentos`, com o antes e o depois em JSON (sem o arquivo da nota: só `tem_nota`). Alteração sem mudança real não é registrada. A tabela é somente-inclusão: gatilhos recusam UPDATE e DELETE.
- **2026-11-14 — Transações: recorrência atômica e modo IMMEDIATE.** Cadastrar recorrência gravava a recorrência e cada uma das 12 contas em transações separadas; uma falha no meio deixava parte gravada. Agora é uma transação só (`ConnectionFactory.emTransacao`), e o mesmo vale para "gerar próximos meses". Todas as conexões usam `transaction_mode=IMMEDIATE`: a transação de escrita reserva o banco no BEGIN, o que evita o `SQLITE_BUSY` sem espera entre duas escritas. Testes em `SegurancaBancoTest` (7), incluindo a falha simulada no meio da recorrência e a migração de um banco v16 sem perder dados. Versão 1.3.6.

## Auditoria de segurança (2026-11-15)

- **2026-11-15 — Auditoria completa (OWASP Top 10, Semgrep, SpotBugs + Find Security Bugs, npm audit, OSV).** Relatório e tabela campo a campo em `docs/seguranca.md`. Nenhuma falha grave; 12 correções de risco baixo/médio, 32 testes JUnit novos (`SqlInjectionApiTest`, `SegurancaApiTest`, PDF disfarçado, Drive). Versão 1.3.7.
- **2026-11-15 — Teto de valor R$ 999.999.999,99** em conta, pagamento e conta fixa, na API e no banco (migração v18, gatilhos `trg_*_valor_maximo_*`). A v18 também audita `boletos_recorrentes`.
- **2026-11-15 — Porta de entrada da API endurecida (`TokenFilter`).** Backend não sobe sem token ≥ 16 caracteres; corpo > 15 MB → 413; corpo sem tamanho → 411; `nosniff` e `no-store` em toda resposta; tetos do Tomcat (20 threads, 100 conexões). Erros do Spring viram 400/404/405/415 em vez de 500.
- **2026-11-15 — PDF: busca de JavaScript/Launch também dentro dos trechos compactados e com nomes disfarçados (`#xx`).** Antes só a busca simples, que um PDF 1.5+ escapava.
- **2026-11-15 — Electron: IPC só responde a páginas de `frontend/html`**, `sandbox: true` explícito, pedidos de permissão negados, "abrir nota" só para `.pdf/.jpg/.png/.webp/.docx`. Electron 33 **mantido** nesta entrega (troca grande, risco de voltar o bug de foco): pendência própria.
- **2026-11-15 — Backup no Drive nunca apaga arquivo do usuário (pedido do usuário).** `BackupDriveService` só apaga arquivo comum (não pasta, não link) com nome exato `Contas a Pagar - dados AAAA-MM-DD.xlsx`, direto na subpasta `Chaveiro Universal - Backup` (conferida com `toRealPath`), nunca recursivo; recusa subpasta que seja atalho. `npm run publicar` só apaga arquivo comum com o nome exato do instalador. `desktop/automacoes.js` não apaga nada no Drive (só lê e copia o instalador para a pasta temporária); a limpeza trimestral das notas só mexe no banco.
- **2026-11-15 — Dependências:** Spring Boot 3.3.5 → 3.5.16 (a 3.3 não tem mais correções), sqlite-jdbc 3.45.2.0 → 3.54.1.0, esbuild 0.24 → 0.25.12. electron-builder fica para a entrega do Electron.
- **2026-11-15 — GitHub Actions (`.github/workflows/testes.yml`).** Windows: typecheck, build, JUnit, frontend, smoke, smoke-boot e persistência (bloqueiam). Entrada real (smoke-real, smoke-dev, CRUD real) roda como informativo: a sessão gráfica do servidor não é a de um usuário. Linux: npm audit de produção e SpotBugs bloqueiam; npm audit completo, OSV-Scanner e Semgrep são informativos.

## Instalador e atualização pelo GitHub, Enter nos formulários (2026-11-16)

- **2026-11-16 — O GitHub é o backup do código E o lugar de onde a loja baixa o instalador (decisão do usuário).** `.github/workflows/instalador.yml` roda `npm run instalador` num Windows do GitHub a cada envio para a `main`, com versão automática (`X.Y` do package.json + número da execução), e publica o `.exe` em Releases.
- **2026-11-16 — Atualização automática pelo GitHub.** `desktop/automacoes.js` procura a versão nova nos Releases; só aceita o instalador com o nome exato, baixado do próprio repositório e com SHA-256 conferido depois do download. Sem internet, usa a pasta do Drive. Mesmo código do Sistema de Garantias.
- **2026-11-16 — Nenhum registro perdido na atualização:** `AtualizacaoSemPerdaTest` monta o banco de cada versão antiga (v1 a v17), enche as tabelas, roda a abertura da versão nova (backup + migrações, inclusive as que reconstroem tabelas) e confere registro por registro (campo a campo a partir da v8; v1–v7 eram do desenvolvimento e a v8 converteu de propósito o formato das contas), `foreign_key_check`, `integrity_check` e o backup pré-migração. Conferido que o teste falha se uma migração estragar um dado.
- **2026-11-16 — Enter = botão de enviar visível em todos os formulários** (`frontend/ts/enter-envia.ts`, ligado pelo `main.ts`): no Inserir Conta e no Form Empresa (com etapas) o Enter faz PRÓXIMA na etapa 1 e SALVAR na última; nas tabelas, APLICAR do painel de edição. Área de texto (mensagem), Shift/Ctrl+Enter e botões não mudam. Testado com tecla real no smoke.
- **2026-11-16 — Início automático espera o computador ficar folgado (pedido do usuário).** Com `--inicio-automatico`, `main.js` só cria a janela e sobe o Java depois de `esperarComputadorFolgado` (Windows ligado há ≥ 3 min e CPU ≤ 35%, conferindo a cada 15 s, no máximo 10 min); o Java desse início roda com prioridade abaixo do normal; o atalho clicado durante a espera abre na hora (`second-instance`).
- **2026-11-16 — Mais leve (pedido do usuário: os sistemas pesavam no PC da loja).** Java do servidor com `-Xms16m -XX:+UseSerialGC -Xss512k -XX:TieredStopAtLevel=1 -XX:ReservedCodeCacheSize=32m -XX:MaxMetaspaceSize=128m` (medido: ~200 MB → ~126 MB por servidor, e pronto mais rápido); teto `-Xmx256m` mantido (planilhas/PDFs); `lazy-initialization` e teto 128m não ganharam nada. `app.disableHardwareAcceleration()`: sem o processo de GPU do Chromium.
- **2026-11-16 — Emblema maior e mais destacado (pedido do usuário):** placa azul com o cadeado laranja, borda preta grossa, ocupando o ícone inteiro (antes era só o desenho, sem fundo, e sumia no papel de parede em 32/48 px). Garantias = vermelho/chave, Contas a Pagar = azul/cadeado. `instalador/gerar-icone.py`.
- **2026-11-16 — Atualização pelo GitHub: o GitHub troca os espaços do nome do instalador por pontos** (`Nome.-.Chaveiro.Universal.-.Instalador.X.Y.Z.exe`); `NOME_INSTALADOR` aceita os dois jeitos. Sem isso o aviso de ATUALIZAR nunca aparecia (as versões até 1.4.12 / 1.3.12 precisam ser instaladas à mão uma vez). Conferido contra o GitHub de verdade (encontra, baixa 185 MB e confere o SHA-256).
- **2026-11-16 — Versão sempre igual no instalador, no programa e no Release (pedido do usuário):** o GitHub define a versão uma vez (`npm version`), e o instalador, o `package.json` dentro do programa (rodapé do Menu) e o Release usam esse mesmo número; o passo "Conferir que instalador e programa tem a mesma versao" do `instalador.yml` lê a versão de dentro do `app.asar` e NÃO publica se for diferente.
- **2026-11-16 — Enter nos pop-ups = continuar (pedido do usuário, igual ao Garantias):** foco e Enter no botão de continuar; em EXCLUIR (tom "perigo") e DESFAZER PAGAMENTO (`enterCancela`) o Enter cancela e o foco fica em CANCELAR, para um Enter sem querer nunca apagar registro nem desfazer pagamento. Smoke com tecla real.

## Contas com PIN e tabelas de 5 linhas, como no Sistema de Garantias (2026-11-16)

- **2026-11-16 — "Quem está usando?" com bolinhas e PIN (pedido do usuário: "assim como na Netflix, todas com PIN, assim como o sistema de garantias").** O sistema abre em `perfis.html` (faixa **BEM-VINDO AO SISTEMA DE CONTAS A PAGAR** no topo, na 1ª conta e nas bolinhas); o Menu sem perfil volta para lá. Mesmo código do Garantias (`UsuarioService`, `Cripto`, `Carteiro`, `UsuarioController`, `perfis.ts`, `conta-menu.ts`); a tela de administração chama `usuarios` (em "contas" ficaria confuso com as contas a pagar). 1ª abertura cria o administrador; ele cadastra as outras contas em MINHA CONTA.
- **2026-11-16 — Segurança das contas:** login e e-mail cifrados (AES-256-GCM), PIN em PBKDF2 com sal e chave fora do banco (`chave-contas.key`, na pasta de dados: sem ele os logins ficam ilegíveis — entra no backup manual); 5 PINs errados bloqueiam e o bloqueio dobra no dia; "Esqueci meu PIN" manda código pelo Gmail da loja (senha de app em MINHA CONTA) com limite de envios; sessão no header `X-Contas-Sessao`; o servidor confere o admin em cada pedido.
- **2026-11-16 — Banco v19 (só acrescenta):** `usuarios`, `acessos_usuario` (histórico somente-inclusão), `codigos_redefinicao`, gatilhos "nunca ficar sem administrador", foto até 1 MB, auditoria das contas (sem segredos) e das configurações (`manutencao`, só a chave). As contas a pagar, pagamentos e cadastros não mudam.
- **2026-11-16 — Na barra de navegação a conta aparece só como bolinha + seta** (o Contas tem 7 botões; o nome inteiro não cabia na faixa de 1152 px). No Menu, botão com bolinha + nome no canto de cima.
- **2026-11-16 — Testes automáticos entram com a conta "TESTE ADMIN" (PIN 2468)** criada só no banco temporário: `desktop/entrar-teste.js` (smoke-boot, smoke-real, CRUD real, layout, hambúrguer); o smoke cria pela tela e testa PIN errado/certo com Enter; o smoke-dev entra digitando de verdade.
- **2026-11-16 — Tabelas mostram só 5 linhas + botão EXPANDIR TABELA (seta para baixo) em Todas as contas, Pagos, Recorrentes (as duas), Cadastros e Mensagens** (`frontend/ts/tabela-recolhivel.ts`). As outras linhas só ficam escondidas: pesquisa, filtros, totais e impressão continuam valendo para todas; a linha selecionada nunca some.
- **2026-11-16 — ATUALIZAR com barra de carregamento e avisos no meio da tela (pedido do usuário, igual ao Garantias):** a versão nova aparece num pop-up no centro (ATUALIZAR / AGORA NÃO); ao atualizar, pop-up com barra "Baixando... 45% (83 de 185 MB)" até o sistema fechar e abrir sozinho (`findesk:progresso-atualizacao`). As notificações curtas saíram do canto e vão para o meio da tela.

## ATUALIZAR que funciona de verdade (2026-11-17)

- **2026-11-17 — Causa do ATUALIZAR que fechava e nao reabria:** o sistema entregava o instalador a um PowerShell escondido (`Start-Sleep; Start-Process`). Ensaiado no Windows do GitHub com o codigo das versoes 1.3.16 e 1.3.20: o instalador nunca roda. Essas versoes nao conseguem se atualizar sozinhas (a loja instala a 1.3.31+ uma vez, a mao).
- **2026-11-17 — Novo jeito (desde a 1.3.22):** o sistema abre o instalador direto com `--updated` (como o atualizador do electron-builder); o instalador fecha o sistema, instala e o abre de novo (runAfterFinish). O sistema so fecha se o instalador abriu; se o Windows barrar, continua aberto e avisa.
- **2026-11-17 — Trava obrigatoria antes de publicar (pedido do usuario: "todos os testes"):** `desktop/ensaio-atualizacao-tela.js` no workflow do instalador instala a ultima versao publicada no Windows, abre o programa e, pela janela (playwright-core via DevTools), confere: pop-up "Nova versao" no centro com ATUALIZAR/AGORA NAO, pop-up de carregamento no centro, barra avancando sem voltar com % e MB, aviso de instalacao, programa fecha sozinho, versao nova instalada, programa abre de novo sozinho, rodape com a versao nova e sem oferecer atualizar de novo. Fotos no artefato `ensaio-atualizacao-fotos`. Falhou = nao publica. Primeira aprovacao: 1.3.31 (16/16).

## Marcar como pago: banco e data (2026-11-18)

- **2026-11-18 — Pop-up ao marcar PAGO (pedido do usuario):** no centro da tela, `escolherPagamento` (dialogos.ts) pede o **banco que pagou** e, na frente, a **data do pagamento** (vem com hoje; digitada ou pelo calendario, pode ter sido outro dia). Banco obrigatorio, data valida e nao no futuro; CANCELAR nao paga. Vale para o PAGO da linha e o do painel de edicao. Grava em `pagamentos.id_banco` e `pagamentos.data_pagamento` (colunas que ja existiam; antes ia sempre hoje e sem banco). A regra fica no pop-up (unico lugar que marca pago); o servidor continua aceitando banco vazio para os pagamentos antigos.
- **2026-11-18 — Todas as Contas: coluna "PAGO EM / BANCO"** (data · instituicao do banco; "SEM BANCO" nos antigos; "—" se pendente).

## Conta recorrente sem duplicata (2026-11-18)

- **2026-11-18 — Recorrente igual nao entra duas vezes (pedido do usuario):** igual = mesma empresa (sem ligar para maiuscula/espacos nas pontas), mesmo valor, mesmo dia e mesma frequencia. Tres camadas: o formulario grava uma vez so (botao SALVAR travado enquanto salva — o clique duplo no intervalo de 1,2 s antes de voltar criava a copia, com as 12 contas de novo), o servidor responde 409 com o aviso, e o banco v20 tem gatilhos que recusam (`RECORRENTE_DUPLICADA`) inclusive dois salvamentos ao mesmo tempo. Editar para ficar igual a outra tambem e recusado. Duplicatas antigas nao sao apagadas sozinhas: o usuario exclui a copia em "Todas contas recorrentes" (as contas pendentes dela saem junto; as pagas ficam).

## Tudo em MAIUSCULAS (2026-11-18)

- **2026-11-18 — Todo texto digitado e gravado em MAIUSCULAS (pedido do usuario, nos dois sistemas):** a regra fica no servidor (`service/Texto.maiusculas`, pt-BR: ç → Ç), na normalizacao de cada cadastro: contas e recorrentes (empresa, pagador, categoria, documento), empresas (razao social, representante, endereco), bancos (instituicao), pagadores (nome, funcao) e recados (titulo, mensagem). Fora (quebrariam): e-mail, PIN, senha de app, chave Pix, nomes de arquivo, codigos internos (forma de pagamento, tipo de telefone). Nas telas, CSS `text-transform: uppercase` em campos de texto (menos e-mail, senha e chave Pix). Registros antigos ficam como estavam ate serem editados.

## 2026-11-18 — Menu: os botões têm prioridade sobre "Mensagens do dia"
- O painel mostra só as 2 contas mais urgentes (atrasadas primeiro, depois por vencimento); o total e "mais N em EXPANDIR" ficam no rodapé.
- A faixa "Recados de hoje" só aparece quando há recado (1 no painel; todos no EXPANDIR).
- O nome do botão (faixa branca) nunca encolhe: quem encolhe é o quadrado do ícone. Coberto pelo smoke 12c (7 contas, 5 resoluções).
- Mensagens que não cabem no painel (mais de 2 contas ou mais de 1 recado): ao entrar com o PIN o pop-up EXPANDIR abre sozinho (uma vez por entrada, pelo token da sessão); ao fechar, o painel fica recolhido numa faixa "MENSAGENS URGENTES" (rosa se há atrasada) que reabre o pop-up. O aviso de versão nova espera o pop-up fechar.

## 2026-11-18 — Contas recorrentes: uma tabela só e edição geral
- A tela "Todas contas recorrentes" mostra só as contas fixas (vencimento "todo dia N", empresa, valor, conta, formato, pagador, frequência, ações). As contas de cada mês ficam em Todas as Contas (lá se edita um mês só).
- Editar a conta fixa (PUT /api/recorrentes/{id}) muda, na mesma transação, todas as contas dela ainda NÃO pagas, de todos os meses; as pagas ficam como estão. Só os campos que mudaram são copiados (ajuste de um mês só continua, a não ser que o mesmo campo seja mudado na fixa). Dia novo = mesmo mês, dia novo (mês sem o dia: último dia). A resposta traz `contasAlteradas`.
- A frequência não muda pela edição (mudaria quais meses existem): exclua e cadastre de novo.

## 2026-11-18 — Dica ao parar o mouse + todas as tabelas com 5 linhas
- `frontend/ts/dicas.ts` (igual no Garantias): todo botão/link ganha `title` (dica do Windows). Ordem: title escrito à mão > DESCRICOES do main.ts (telas principais, com explicação) > aria-label/texto (+ descrição do cartão) > ícone. Refeita sozinha quando o texto do botão muda.
- `tabela-recolhivel.ts` vale também para listas `<ul>` (itens com `data-vazio="true"` não contam); agora também na tabela de usuários e nos históricos de acesso.

## 2026-11-18 — Pop-ups iguais aos do Sistema de Garantias (referência visual)
- Causa do PIN pequeno: o bloco de formulários (`.entrada-form`) estava DEPOIS do `.entrada-pin` no CSS e apagava o tamanho grande. Agora fica antes, na mesma ordem do Garantias (conferido: as 26 peças do pop-up do PIN têm o mesmo tamanho nos dois sistemas).
- Copiados do Garantias: cabeçalhos sucesso/erro, `.dialogo__lista`, `.dialogo--grande` e `.entrada-form--erro`. Regra: estilo de pop-up/formulário novo nasce no Garantias e vem igual para cá.

## 2026-11-18 — Tabelas com rolagem por dentro, pop-ups grandes e rolagem automática (2 sistemas)
- Tabelas: sem o botão EXPANDIR TABELA. Altura fixa de 5 linhas e rolagem DENTRO da tabela, cabeçalho parado no topo (`tabela-recolhivel.ts`, `.tabela-rolagem`; igual nos dois sistemas). Todas as linhas ficam na página (pesquisa, totais e impressão valem para todas).
- Pop-ups: todos maiores. Confirmações, exclusões e alertas de risco no MEIO da tela; avisos de "deu certo" (notificações) GRANDES no canto INFERIOR DIREITO (substitui a decisão de 2026-11-16 de tudo no meio).
- `rolagem.ts` (igual nos dois): clicar num registro leva a tela até "Alterar um campo" (não à nota fiscal); abrir uma caixa de seleção perto do pé da tela sobe a tela para a lista aparecer inteira.
- `docs/analise-banco.md`: tabelas e colunas usadas e mortas dos dois sistemas; nada apagado sem aprovação.
- PAGO: pop-up grande com BANCO, FORMA DE PAGAMENTO (lista para escolher OU escrever: PIX, BOLETO, DINHEIRO, CARTÃO DE CRÉDITO/DÉBITO, TRANSFERÊNCIA, DÉBITO AUTOMÁTICO; vem com o formato da conta) e DATA. v21: `pagamentos.forma_pagamento` (texto livre, 2 a 40, MAIÚSCULAS). Aparece em PAGO EM / BANCO e em Pagos (editável).
- Todas as Contas: filtro ESTE MÊS (vencimento no mês de hoje, pagas ou não).

## 2026-11-19 — Correção da rolagem das caixas de seleção
- O `<body>` (altura 100%) é quem rola nas telas, não a janela. A versão anterior punha um marcador na JANELA: criava uma 2ª rolagem por fora, empurrava a tela e deixava faixa branca embaixo (Cadastrar Garantia, MODELO e PRODUTO). Agora `rolagem.ts` rola só a área que já rola e, no fim da página, põe o espaço extra DENTRO dela (some ao sair do campo). Smoke do Garantias reproduz as fotos do usuário.

## 2026-11-19 — Programa reabre sozinho depois da atualização
- Na loja o programa não reabria após atualizar. Causas possíveis: (1) o jeito padrão do NSIS abre pelo atalho do Menu Iniciar via Explorer (`ExecShellAsUser`), que pode falhar calado; (2) o programa novo abria enquanto o antigo ainda fechava e, sem a "instância única", fechava sozinho.
- Agora: `instalador.nsh` (customInstall, só em atualização) abre o exe DIRETO com `--reabrir-depois-da-atualizacao`; com essa marca o programa tenta a instância única a cada 0,5 s por até 40 s em vez de desistir (`desktop/main.js`). Se o atalho também abrir, um dos dois fica e o outro sai quieto.
- Ensaio do GitHub: além do processo, exige a JANELA aberta e ainda aberta 15 s depois.

## 2026-11-19 — Todas as Contas: caixa MÊS
- Caixa de seleção MÊS (os 12 meses do ano de hoje + meses de outros anos que têm contas + TODOS OS MESES); abre SEMPRE no mês de hoje. Os botões (TODOS, A VENCER, VENCEM HOJE, ATRASADOS, PAGOS, NA PASTA) ficaram menores e valem DENTRO do mês escolhido. O botão ESTE MÊS saiu (a caixa faz isso). A impressão diz o mês.

## 2026-11-19 — Fim da lista pequena do Windows (datalist)
- `caixa-sugestoes.ts`: todo `<input list>` vira sozinho a caixa de digitar ou escolher neobrutalista (classes `caixa-busca__*`, iguais às do Garantias): lista grande, filtra ao digitar, aceita texto livre, setas/Enter/Esc. Vale para CATEGORIA DA CONTA (Inserir Conta) e FORMA DE PAGAMENTO (pop-up do PAGO). Regra: não usar `<datalist>` nativo à vista.

## 2026-11-19 — Contas recorrentes: ações também na área de edição
- Como nas outras tabelas, a área que abre ao clicar na conta fixa tem "Ações": GERAR PRÓXIMOS MESES e EXCLUIR (mesmo pop-up de confirmação da linha).

## 2026-11-19 — REGRA PERMANENTE: nunca gerar nem imprimir documento fiscal
- Ordem do usuário (vale para os dois sistemas): só mandamos a requisição ao sistema fiscal de fora; emitir, desenhar e imprimir nota/cupom é dele. Regra no CLAUDE.md e no AGENTS.md.

## 2026-11-23 — Pop-up O QUE MUDOU depois de cada atualização (os dois sistemas)
- Pedido do usuário: depois de atualizar, mostrar o que foi feito (ele fica dias sem ir à loja e esquece).
- A lista sai dos commits `feat:` (NOVO), `fix:` (CORRIGIDO) e `perf:` (MAIS RÁPIDO); commits de bastidor (testes, CI, SpotBugs) ficam de fora. `instalador/empacotar.js` grava `desktop/novidades.json` (fora do Git) e o CI faz checkout com o histórico inteiro (`fetch-depth: 0`). No `npm run dev`, a lista sai do git na hora.
- O "já visto" fica ao lado do banco (`novidades-vistas.json`: versão + data da última mudança vista). Instalação nova (banco ainda não existia) não mostra nada; na 1ª vez com o recurso, mostra os últimos 30 dias. No máximo 60 itens; ENTENDI marca como visto.
- No Menu: O QUE MUDOU primeiro, depois as mensagens/aviso de versão nova (um pop-up por vez). O ensaio do ATUALIZAR no CI confere o pop-up e o ENTENDI. Código igual nos dois sistemas: `desktop/novidades.js`, `frontend/ts/novidades.ts`, `desktop/teste-novidades.js`.
- **Por isso: escrever o assunto dos commits `feat:`/`fix:` em português simples, para a loja entender.**

## 2026-11-23 — Revisão de gatilhos, auditoria e transações (banco v22)
- Pedido do usuário: revisar triggers, "procedures" e transações nos dois sistemas.
- **Furo encontrado:** a forma de pagamento (v21) não entrava no histórico dos pagamentos; `bancos`, `pagadores`, `empresas`, `telefones_empresa` e `avisos` não eram auditados. Corrigido.
- Datas só do calendário (AAAA-MM-DD) em vencimento, pagamento e mensagens (fim não antes do início); 0/1 e PF/PJ conferidos; limite de tamanho dos textos com folga sobre o da API (dias da semana da mensagem até 100: "SEGUNDA,TERCA,..."); planilha antiga imutável; código de "Esqueci o PIN" usado não volta a valer.
- Testes que montam bancos antigos "de mentira" (`AvisoServiceTest`, `PagadorServiceTest`, `SegurancaBancoTest`) ganharam as tabelas/colunas que um banco real dessas versões já tem.
- **Transações (as duas iguais):** trocar o PIN agora grava o PIN novo e o registro no histórico de acessos numa transação só (antes eram duas: o PIN podia mudar sem registro). A primeira conta (admin + e-mail da loja + entrada) e o Gmail + senha de app também gravam juntos (ou nada). As demais gravações de várias etapas já estavam em transações `IMMEDIATE` (levantamento feito em todos os repositories e services).
- **SQLite não tem "procedures"**: o papel delas fica nos métodos dos repositories com `emTransacao` (várias etapas, tudo ou nada) e nos gatilhos (regras que o próprio banco confere em qualquer gravação).
- **Erro de gatilho na tela:** `api/RegraDoBanco` (igual nos dois sistemas) transforma o `RAISE(ABORT, 'CODIGO: motivo')` em 409 com mensagem clara, em vez de "erro interno" 500.
- Auditoria nova usa `json_object` completo (nunca `json_patch`, que apaga do histórico os campos vazios).
- Regras de UPDATE só disparam quando a coluna MUDA (`NEW.x IS NOT OLD.x`): linhas antigas gravadas antes da regra continuam editáveis.

## 2026-11-24 — Filtro forte de duplicidade no Inserir Conta (contas recorrentes)
- Pedido do usuário: contas que já estão nas CONTAS RECORRENTES eram cadastradas de novo à mão. Agora o Inserir Conta também compara com as recorrentes ATIVAS (mesmo documento, ou nome de empresa parecido: um contém o outro), em qualquer mês, além da regra do VBA (contas do mesmo mês).
- Pop-up 1 "ESTA CONTA JÁ ESTÁ NAS CONTAS RECORRENTES" / "ESTA CONTA JÁ EXISTE": recorrente (dia, frequência, valor) e a conta do mês (vencimento, valor, situação). **SIM, EDITAR A QUE JÁ EXISTE** abre Todas as Contas no mês dela, com a conta selecionada na edição (ou a tabela de recorrentes, se a conta do mês ainda não foi gerada). **NÃO** → pop-up 2 "CADASTRAR UMA DUPLICATA?" (Enter cancela; só grava clicando em SIM).
- Servidor: `PossivelDuplicataException` leva `existente` (pode faltar) + `recorrente`; `ContaRepository.recorrentesAtivas()` / `contaDaRecorrenteNoMes()`. Tela de destino recebe o id por `frontend/ts/abrir-registro.ts` (sessionStorage, lido uma vez).

## 2026-11-25 — Duplicidade: o valor não conta mais, só documento ou data próxima
- Foto da loja: STAM de R$ 1.056,49 vencendo dia 12 travava porque já havia STAM com o mesmo valor no dia 29 (regra do VBA: mesma empresa no mês + valor até R$ 150 de diferença). Era outro boleto.
- Regra nova (contas do mês e contas recorrentes): mesmo número de documento, OU nome de empresa parecido E vencimento até 3 dias de distância (para a recorrente, do dia dela no mês). O valor não entra. Boleto da mesma empresa em outro dia grava direto.
- Detalhes dos pop-ups com uma informação por linha (`white-space: pre-line`).
