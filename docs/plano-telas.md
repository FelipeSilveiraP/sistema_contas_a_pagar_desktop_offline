# FinDesk — Plano das Demais Telas (Etapa 2 — planejamento corrigido)

> Escopo: análise e planejamento. **Nenhuma tela nova foi implementada quando este documento foi criado.**
> Revisão v2 (correções solicitadas): contagem reconciliada (14 telas funcionais = 14 entradas),
> inventário técnico com **IDs completos** das 29 telas, requisitos **obrigatórios × não aplicáveis**
> por tela (submenus não exigem SQLite nem regras financeiras) e plano incremental **uma tela por entrega**.
> Revisão v3 (Entrega 2 — navegação e submenus agrupados): todos os submenus do Menu implementados
> em uma única entrega; variantes Stitch mapeadas definitivamente (§1.2/§1.4); novo mapa de destinos
> com status (§2.3); estratégia de entregas agrupadas (§5).
> Fontes: API Google Stitch (projeto `5659178840976603476` — 29 telas listadas em 2026-11-05),
> `BRIEFING_PROJETO.md`, `telas_referencia/` (28 PNGs), `vba/cod_vba_contas_a_pagar.txt`, `.memory-bank/`.
> A tela `Relatório de Mapeamento de Telas e Navegação` do próprio Stitch foi usada como fonte
> primária do mapa de navegação.
> Nota técnica de acesso: a API Stitch (`https://stitch.googleapis.com/mcp`) exige a chave no
> header `X-Goog-Api-Key` (o parâmetro `?key=` foi descontinuado e retorna 404).

---

## 1. Inventário técnico das telas do Stitch (IDs completos)

IDs no formato `projects/5659178840976603476/screens/<id>`, conforme retornado por `list_screens`.
A numeração de `telas_referencia/` é a ordem de download antiga — o vínculo estável é o **título + ID**.

**Reconciliação: 14 telas funcionais + 4 telas de template de submenu + 11 telas de apoio = 29 telas.**

### 1.1 Telas funcionais (14 páginas — 14 entradas)

| # | Tela (página) | ID completo Stitch | Módulo |
|---|---------------|--------------------|--------|
| 1 | Menu Principal — 5 Botões (Padrão Dado com Cadastros) | `projects/5659178840976603476/screens/adcf32359e714384b2c6f4846670ebb8` | Menu |
| 2 | Inserir Conta — Formulário em 2 Etapas (Página 1 e 2) | `projects/5659178840976603476/screens/9df40cc16ffc44aba8045d92a6d6946a` | Inserir Conta |
| 3 | Controle — Seleção de Modo (3 Botões com Pagos) | `projects/5659178840976603476/screens/049aa4909b834dc09c04c3f75d2b01e2` | Controle (submenu) |
| 4 | Controle de Boletos — Ações e Baixa Rápida | `projects/5659178840976603476/screens/13599600802999775538` | Controle (Todas as Contas) |
| 5 | Controle de Boletos — Tabela Reduzida | `projects/5659178840976603476/screens/16e24aa05e2043b9aeca7b3c1367a7e8` | Recorrentes |
| 6 | Cadastrar Conta Recorrente — Formulário Roxo | `projects/5659178840976603476/screens/b7a6314cdb2446619231dce47e6ebd31` | Recorrentes |
| 7 | Controle de Contas Pagas — Tabela Verde | `projects/5659178840976603476/screens/3cba937b69fc414da70edf3ba6cd9d8b` | Pagos |
| 8 | Todos os Cadastros — Filtros Empresas, Pagadores e Bancos | `projects/5659178840976603476/screens/bab754cf15d94fcd91b52c32118507fb` | Cadastros |
| 9 | Inserir Novo Cadastro — Formulário em 2 Etapas (Empresa) | `projects/5659178840976603476/screens/2c0b2a322cc64b168974297f912eec7d` | Cadastros |
| 10 | Inserir Novo Cadastro — Pagador (Simplista) | `projects/5659178840976603476/screens/95a6d0816253465a911c7ae1b0f56f7b` | Cadastros |
| 11 | Inserir Novo Cadastro — Banco (Simplista) | `projects/5659178840976603476/screens/b928f8839cc7421bad7b4ec90f6332f8` | Cadastros |
| 12 | Todas as Mensagens — Tabela e Controle | `projects/5659178840976603476/screens/47b7f0e6a9c344858291696dcabc7a6c` | Mensagens |
| 13 | Criar Nova Mensagem — Formulário Simplista | `projects/5659178840976603476/screens/a61a7b2b300d4682b56fc3658f5e8989` | Mensagens |
| 14 | Gráficos Financeiros — Visão Simplista | `projects/5659178840976603476/screens/a5d5b9a72a244ef0bda0db140ec53c17` | Gráficos |

### 1.2 Telas de template de submenu (4 — não são páginas próprias)

Instanciadas como **um único componente de submenu** (TS/CSS) parametrizado por módulo.
Mapeamento definitivo das variantes (verificado por conteúdo do `htmlCode` + amostragem de pixels
das capturas oficiais na Entrega 2):

| Tela Stitch | ID completo | Conteúdo real | Submenu implementado |
|-------------|-------------|---------------|----------------------|
| Controle — Seleção de Modo (Identidade Neobrutalista) | `projects/5659178840976603476/screens/799674509841813500` | TODAS AS MENSAGENS / CRIAR NOVA MENSAGEM (rosa `#ec4899`, rosa-escuro `#f43f5e`) | Submenu Mensagens |
| Controle — Seleção de Modo (Identidade Neobrutalista) | `projects/5659178840976603476/screens/11751738951453484401` | TODOS OS CADASTROS / NOVO CADASTRO (laranja `#ea580c`, âmbar `#f59e0b` — cores renderizadas; o `style` inline do Stitch prevalece sobre a classe) | Submenu Cadastros |
| Controle — Seleção de Modo (Identidade Neobrutalista) | `projects/5659178840976603476/screens/16202825301358498490` | TODAS CONTAS RECORRENTES / CADASTRAR NOVA CONTA RECORRENTE (azul `#38bdf8`, roxo `#7c3aed`) | Submenu Recorrentes |
| Controle — Seleção de Modo (3 Botões com Pagos) | `projects/5659178840976603476/screens/1921131218837161257` | **conteúdo divergente do título**: EMPRESA (`#f59e0b`) / PAGADOR (`#dc2626`) / BANCO (`#16a34a`) | Submenu Novo Cadastro |

### 1.3 Telas de apoio (11 — não implementadas como página)

| Tipo | ID completo | Tratamento |
|------|-------------|------------|
| Ícone Cadastrar Conta Recorrente | `projects/5659178840976603476/screens/c446202961744384916c577688a0eaa9` | asset de botão/submenu |
| Ícone Neobrutalista Pagador | `projects/5659178840976603476/screens/911070ad139a48e5a10d904d53c263fa` | asset de botão/submenu |
| Ícone Novo Cadastro Neobrutalista | `projects/5659178840976603476/screens/2413b3564fa74c6e9e295fcb752845f7` | asset de botão/submenu |
| Ícone Neobrutalista Banco | `projects/5659178840976603476/screens/40bc6c7386154242b12b95ac731f8e13` | asset de botão/submenu |
| Ícone Neobrutalista Pagos | `projects/5659178840976603476/screens/d11fcac5fb7e44bc9f9d79ffca28ac23` | asset de botão/submenu |
| Ícone Contas Recorrentes Neobrutalista | `projects/5659178840976603476/screens/522ba26f872444088fc1b395cf6bf165` | asset de botão/submenu |
| Ícone Todas as Mensagens | `projects/5659178840976603476/screens/26d7988d40994270aaf356fa2e4a6f8b` | asset de botão/submenu |
| Ícone Neobrutalista Empresa | `projects/5659178840976603476/screens/a02eb15602924160bf000016ebc67296` | asset de botão/submenu |
| Ícone Todos os Cadastros Neobrutalista | `projects/5659178840976603476/screens/ebeea5f1303f46bea4f2c2ed881f99a1` | asset de botão/submenu |
| Ícone Nova Mensagem | `projects/5659178840976603476/screens/47ea150a5bc74f30aaed6d91a6cee734` | asset de botão/submenu |
| Relatório de Mapeamento de Telas e Navegação | `projects/5659178840976603476/screens/387f30aab610404cb2f8f14295584167` | documentação (fonte deste plano) |

### 1.4 Variantes duplicadas — diferenças verificadas

Diff de pixels das capturas baixadas (não são cópias idênticas):

| Par (`telas_referencia/`) | Resultado | Conclusão |
|---------------------------|-----------|-----------|
| Identidade A (`01`) vs B (`04`) | 38,9% dos pixels diferentes | mesmo template, conteúdo/cores distintos |
| Identidade A (`01`) vs C (`16`) | alturas diferentes (610 vs 635) | layouts distintos |
| 3 Botões A (`02` = `049aa490…`) vs B (`23` = `19211312…`) | 53,1% dos pixels diferentes | **título igual, conteúdo diferente**: A = Controle (Todas as Contas/Recorrentes/Pagos); B = Novo Cadastro (Empresa/Pagador/Banco) — ver §1.2 |

**Decisão (confirmada na Entrega 2):** construir **um único componente de submenu** (TS/CSS)
instanciado por módulo (rótulos/cores por parâmetro — `frontend/ts/submenus-config.ts`), em vez de
replicar páginas. O mapeamento variante → módulo está em §1.2. A variante canônica do Submenu
Controle é `049aa4909b834dc09c04c3f75d2b01e2` (3 botões: TODAS AS CONTAS / CONTAS RECORRENTES / PAGOS).

---

## 2. Mapa de navegação

### 2.1 Hierarquia

```text
[ MENU PRINCIPAL (5 botões) ]
 ├── INSERIR CONTA ──────── [Form Inserir Conta — Etapa 1 → Etapa 2 → Salvar → Menu]
 ├── CONTROLE ───────────── [Submenu Controle: 3 botões]
 │    ├── TODAS AS CONTAS ─ [Boletos: tabela + baixa rápida PAGO/NÃO PAGO + edição]
 │    ├── CONTAS RECORRENTES → [Submenu Recorrentes: 2 botões]
 │    │    ├── TODAS AS RECORRENTES ─ [Tabela Reduzida de contas fixas]
 │    │    └── NOVA RECORRENTE ─────── [Form Roxo: periodicidade mensal/bimestral/trimestral/anual]
 │    └── PAGOS ─────────── [Tabela Verde: histórico de quitadas]
 ├── CADASTROS ──────────── [Submenu Cadastros: 2 botões]
 │    ├── TODOS OS CADASTROS ─ [Tabela multi-filtro: Empresas/Pagadores/Bancos + edição]
 │    └── NOVO CADASTRO ──── [Submenu tipo: 3 botões]
 │         ├── EMPRESA ──── [Form 2 etapas]
 │         ├── PAGADOR ──── [Form simplista]
 │         └── BANCO ────── [Form simplista]
 ├── MENSAGENS ──────────── [Submenu Mensagens: 2 botões]
 │    ├── TODAS AS MENSAGENS ─ [Tabela de avisos + filtros + edição]
 │    └── CRIAR NOVA MENSAGEM [Form de recado → Salvar → Tabela]
 └── GRÁFICOS ───────────── [Dashboard: KPIs + filtros de período + IMPRIMIR]
```

Todo submenu e tela secundária possui `← VOLTAR` (para a tela anterior) e caminho de volta ao Menu.

### 2.2 Tabela de navegação (botão → destino)

| Origem | Botão | Destino |
|--------|-------|---------|
| Menu | INSERIR CONTA | Inserir Conta (2 etapas) |
| Menu | CONTROLE | Submenu Controle |
| Menu | CADASTROS | Submenu Cadastros |
| Menu | MENSAGENS | Submenu Mensagens |
| Menu | GRÁFICOS | Gráficos Financeiros |
| Inserir Conta | AVANÇAR PARA ETAPA 2 / VOLTAR PARA ETAPA 1 | Etapas do mesmo formulário |
| Inserir Conta | INSERIR CONTA (final) | Salva → Menu |
| Inserir Conta | ← VOLTAR | Menu |
| Submenu Controle | TODAS AS CONTAS | Controle de Boletos (baixa rápida) |
| Submenu Controle | CONTAS RECORRENTES | Submenu Recorrentes |
| Submenu Controle | PAGOS | Tabela Verde |
| Submenu Recorrentes | TODAS CONTAS RECORRENTES | Tabela Reduzida |
| Submenu Recorrentes | CADASTRAR NOVA RECORRENTE | Form Roxo |
| Boletos | PAGO / NÃO PAGO | Baixa na própria linha (transação) |
| Boletos | linha clicada | Painel de edição inferior |
| Boletos | DELETAR BOLETO | Exclusão com confirmação |
| Submenu Cadastros | TODOS OS CADASTROS | Tabela multi-filtro |
| Submenu Cadastros | NOVO CADASTRO | Submenu Novo Cadastro |
| Submenu Novo Cadastro | EMPRESA / PAGADOR / BANCO | Formulários respectivos |
| Tabela Cadastros | filtro EMPRESAS/PAGADORES/BANCOS | Reconfigura colunas da tabela |
| Tabela Cadastros | linha clicada | Painel de edição inferior |
| Submenu Mensagens | TODAS AS MENSAGENS | Tabela de avisos (filtros: TODOS/ATIVOS/DIAS ÚTEIS/EXPIRADOS/CRONOLÓGICO) |
| Submenu Mensagens | CRIAR NOVA MENSAGEM | Form de recado |
| Form Mensagem | SALVAR MENSAGEM | Tabela de Mensagens |
| Form Mensagem | CANCELAR | Submenu Mensagens |
| Gráficos | filtros ESTE MÊS/ÚLTIMOS 3/ESTE ANO | Recalcula KPIs e gráficos |
| Gráficos | IMPRIMIR | `window.print()` |
| Qualquer tela | ← VOLTAR | Tela anterior (pilha) |

### 2.3 Status dos destinos (Entrega 2 — todos os botões com comportamento definido)

Regra: se a tela de destino existe, o botão **navega**; caso contrário apresenta **resposta provisória**.

| Tela | Botão | Destino (conforme §2.2) | Comportamento |
|------|-------|------------------------|---------------|
| Menu | INSERIR CONTA | Inserir Conta (2 etapas) | Provisório |
| Menu | CONTROLE | Submenu Controle | **Navega** |
| Menu | CADASTROS | Submenu Cadastros | **Navega** |
| Menu | MENSAGENS | Submenu Mensagens | **Navega** |
| Menu | GRÁFICOS | Gráficos Financeiros | Provisório |
| Submenu Controle | TODAS AS CONTAS | Controle de Boletos (baixa rápida) | Provisório |
| Submenu Controle | CONTAS RECORRENTES | Submenu Recorrentes | **Navega** |
| Submenu Controle | PAGOS | Tabela Verde | Provisório |
| Submenu Cadastros | TODOS OS CADASTROS | Tabela multi-filtro | Provisório |
| Submenu Cadastros | NOVO CADASTRO | Submenu Novo Cadastro | **Navega** |
| Submenu Novo Cadastro | CADASTRAR NOVA EMPRESA | Form Empresa (2 etapas) | Provisório |
| Submenu Novo Cadastro | CADASTRAR NOVO PAGADOR | Form Pagador | Provisório |
| Submenu Novo Cadastro | CADASTRAR NOVO BANCO | Form Banco | Provisório |
| Submenu Mensagens | TODAS AS MENSAGENS | Tabela de avisos | Provisório |
| Submenu Mensagens | CRIAR NOVA MENSAGEM | Form de recado | Provisório |
| Submenu Recorrentes | TODAS CONTAS RECORRENTES | Tabela Reduzida | Provisório |
| Submenu Recorrentes | CADASTRAR NOVA CONTA RECORRENTE | Form Roxo | Provisório |

---

## 3. Requisitos por tela — obrigatórios × não aplicáveis

**Regra fixa: telas que são apenas submenus (navegação pura) NÃO exigem integração SQLite nem
regras financeiras.** Para elas valem somente Interface + Navegação.

### 3.1 Matriz de aplicabilidade

| Tela | Interface | Navegação | API | SQLite | Regras financeiras |
|------|-----------|-----------|-----|--------|--------------------|
| Menu Principal | Obrigatório (pronto) | Obrigatório (pronto) | Obrigatório (pronto) | Obrigatório (fase financeira) | Obrigatório (alerta de vencimento) |
| Submenu Controle | Obrigatório | Obrigatório | **Não aplicável** | **Não aplicável** | **Não aplicável** |
| Submenu Cadastros | Obrigatório | Obrigatório | **Não aplicável** | **Não aplicável** | **Não aplicável** |
| Submenu Novo Cadastro | Obrigatório | Obrigatório | **Não aplicável** | **Não aplicável** | **Não aplicável** |
| Submenu Mensagens | Obrigatório | Obrigatório | **Não aplicável** | **Não aplicável** | **Não aplicável** |
| Submenu Recorrentes | Obrigatório | Obrigatório | **Não aplicável** | **Não aplicável** | **Não aplicável** |
| Inserir Conta | Obrigatório | Obrigatório | Obrigatório | Obrigatório | Obrigatório (valor > 0, vencimento, PF/PJ) |
| Boletos (Todas as Contas) | Obrigatório | Obrigatório | Obrigatório | Obrigatório | Obrigatório (baixa atômica PAGO/NÃO PAGO) |
| Tabela Reduzida (Recorrentes) | Obrigatório | Obrigatório | Obrigatório | Obrigatório | Obrigatório (periodicidade) |
| Form Recorrente (Roxo) | Obrigatório | Obrigatório | Obrigatório | Obrigatório | Obrigatório (propagação VBA) |
| Tabela Verde (Pagos) | Obrigatório | Obrigatório | Obrigatório | Obrigatório | Obrigatório (data/valor pago, banco) |
| Todos os Cadastros | Obrigatório | Obrigatório | Obrigatório | Obrigatório | Não aplicável (validação CNPJ/CPF é regra de formulário) |
| Form Empresa (2 etapas) | Obrigatório | Obrigatório | Obrigatório | Obrigatório | Não aplicável |
| Form Pagador | Obrigatório | Obrigatório | Obrigatório | Obrigatório | Não aplicável |
| Form Banco | Obrigatório | Obrigatório | Obrigatório | Obrigatório | Não aplicável |
| Todas as Mensagens | Obrigatório | Obrigatório | Obrigatório | Obrigatório | Não aplicável (vigência é regra de dados) |
| Criar Mensagem | Obrigatório | Obrigatório | Obrigatório | Obrigatório | Não aplicável |
| Gráficos | Obrigatório | Obrigatório | Obrigatório | Obrigatório | Obrigatório (agregações por período) |

### 3.2 Detalhe das dependências (somente onde API/SQLite são obrigatórios)

Tabelas SQLite previstas (DER do `.memory-bank/systemPatterns.md`): `empresas`, `telefones_empresa`,
`pagadores`, `bancos`, `categorias_conta`, `formas_pagamento`, `contas_a_pagar`, `pagamentos`,
`notas_fiscais`, `boletos_recorrentes`, `avisos`, `auditoria_operacoes`.

| Tela | Dados necessários | Endpoints (a criar) | Tabelas | Regras obrigatórias | Situação |
|------|-------------------|---------------------|---------|---------------------|----------|
| Menu Principal | contas do dia (vencimentos) | `GET /api/contas` (mock existe) | `contas_a_pagar` | alerta de vencimento | **Interface pronta**; dados simulados |
| Inserir Conta | categorias, empresas, pagadores, bancos | `POST /api/contas` | `contas_a_pagar`, `notas_fiscais`, `categorias_conta` | valor > 0, vencimento obrigatório, PF/PJ | Não iniciada |
| Boletos (Todas) | contas em aberto | `GET /api/contas?status=`, `PATCH .../status` | `contas_a_pagar` | baixa atômica PAGO/NÃO PAGO | Não iniciada |
| Tabela Reduzida (Recorrentes) | boletos fixos | `GET /api/recorrentes` | `boletos_recorrentes` | periodicidade | Não iniciada |
| Form Recorrente (Roxo) | dias, valores, pagadores | `POST /api/recorrentes` | `boletos_recorrentes` | propagação mensal/bimestral/trimestral/anual (VBA `PropagarBoletoNosMeses`) | Não iniciada |
| Tabela Verde (Pagos) | histórico quitado | `GET /api/contas?status=PAGO` | `contas_a_pagar`, `pagamentos` | data/valor pago, banco | Não iniciada |
| Todos os Cadastros | empresas/pagadores/bancos | `GET /api/empresas\|pagadores\|bancos` | `empresas`, `pagadores`, `bancos` | validação CNPJ/CPF | Não iniciada |
| Form Empresa (2 etapas) | contatos, endereço | `POST /api/empresas` | `empresas`, `telefones_empresa` | — | Não iniciada |
| Form Pagador | nome, CPF, função | `POST /api/pagadores` | `pagadores` | validação CPF | Não iniciada |
| Form Banco | febraban, agência, conta, Pix | `POST /api/bancos` | `bancos` | — | Não iniciada |
| Todas as Mensagens | avisos + vigência | `GET /api/avisos` | `avisos` | dias úteis, expiração | Não iniciada |
| Criar Mensagem | texto, vigência, dias | `POST /api/avisos` | `avisos` | — | Não iniciada |
| Gráficos | agregados por período | `GET /api/dashboard/resumo` | consultas agregadas | totais por categoria/mês | Não iniciada |
| (transversal) | auditoria | em cada mutação | `auditoria_operacoes` | trilha atômica ACID | Não iniciada |
| (transversal) | backup | rotina local | arquivo `.db` | backup como no VBA `Workbook_BeforeClose` | Não iniciada |

Submenus (Controle, Cadastros, Novo Cadastro, Mensagens, Recorrentes): **sem dados, sem endpoints,
sem tabelas, sem regras** — telas de navegação pura (ver §3.1).

Regras do VBA que devem virar Services Java: `VerificarVencimentosAoAbrir` (alertas), `PropagarBoletoNosMeses`
(recorrência), `AtualizarStatus`/`cmdPago`/`cmdNaoPago` (baixa), `cmdCriarAnoNovo`/`ReimportarPadroesAnoNovo`
(rollover anual), `RealizarBusca` (pesquisa), backup automático. Exclusões deliberadas: integrações SAT e
Gmail (dependem de internet/perfil local — fora do escopo offline).

---

## 4. Arquitetura de navegação (TypeScript puro + Electron seguro)

**Opção adotada: multi-página com roteador mínimo.** Cada tela = 1 arquivo HTML + 1 módulo TS.
Navegação via `loadFile` do Electron (sem `fetch` de parciais — bloqueado em `file://`), estilos
compartilhados pelo mesmo `tailwind.css`/`fonts.css`.

```text
frontend/
├── html/            # menu.html + telas (uma por página; submenus são cascas finas)
├── ts/
│   ├── navegacao.ts # pilha de histórico + irPara()/voltar()/menuPrincipal()
│   ├── componentes.ts # botão-voltar, resposta provisória, atalhos, tabela neobrutalista, diálogo
│   ├── submenus-config.ts # configuração central dos submenus (rótulos, cores, ícones, destinos)
│   ├── api.ts       # cliente REST (já existe; estender)
│   └── telas/*.ts   # menu.ts + submenu.ts (componente genérico instanciado por config)
```

| Requisito | Solução |
|-----------|---------|
| Voltar à tela anterior | pilha em `sessionStorage` (`Navegacao.voltar()`) |
| Voltar ao Menu | `Navegacao.menuPrincipal()` (sempre disponível) |
| Alterações não salvas | `Navegacao.irPara()` consulta `temAlteracoesNaoSalvas()` e exige confirmação |
| Navegação segura no Electron | preload expõe apenas `config()` e `navegar(tela)`; o processo principal valida a chave da tela contra uma **whitelist** de arquivos antes de `loadFile`; o renderer **não** recebe caminhos nem acesso a `fs` |
| Isolamento preservado | `contextIsolation: true` e `nodeIntegration: false` mantidos; `will-navigate` e `window.open` bloqueados; CSP mantida em cada HTML |
| Consistência visual | `componentes.ts` + mesmos utilitários Tailwind |
| Testabilidade | cada `telas/*.ts` puro (sem tocar DOM global no teste); navegação mockável |
| Separação de regras | frontend nunca calcula finanças — só chama Services Java via API |

Alternativa descartada por ora: SPA com parciais embutidos (mais hidratação, mesmo ganho).

---

## 5. Plano de implementação incremental (estratégia agrupada)

**Nova estratégia (a partir da Entrega 2):** agrupar em uma mesma entrega tarefas semelhantes que
compartilham componentes, layouts e testes. Submenus simples não são mais entregas isoladas.
Cada entrega segue o ciclo: **recuperar do Stitch → adaptar ao Electron → testar → apresentar →
aguardar aprovação → próxima**.

| # | Entrega | Conteúdo | Situação |
|---|---------|----------|----------|
| 1 | Estrutura de navegação + Submenu Controle | `navegacao.ts`, `componentes.ts`, navegação segura Electron, submenu Controle | **Concluída** (aprovada) |
| 2 | Navegação completa + todos os submenus | componente genérico de submenu, submenus Cadastros, Novo Cadastro, Mensagens e Recorrentes, integração de destinos (§2.3) | **Concluída** (aguardando aprovação) |
| 3 | Funcionalidades financeiras | pool abaixo — sequência a reavaliar e aprovar após a Entrega 2 | Não iniciada |

Pool de referência das funcionalidades financeiras (ordem provisória, sujeita à reavaliação):
Cadastros (Banco → Pagador → Empresa), Inserir Conta, Todas as Contas + baixa rápida, Pagos,
Contas Recorrentes (tabela/form), Mensagens (tabela/form), Gráficos e impressão. Somente essas
entregas habilitam API/SQLite/regras financeiras; telas de navegação já estão completas
(Interface + Navegação).

### Níveis de conclusão (marcar em cada entrega)

- [ ] **Interface** — layout Stitch, responsiva, offline
- [ ] **Navegação** — ir/voltar/atalhos funcionando
- [ ] **API** — endpoints + tratamento de erro *(não aplicável a submenus)*
- [ ] **SQLite** — persistência WAL + transação *(não aplicável a submenus)*
- [ ] **Regras financeiras** — testes JUnit cobrindo a regra *(não aplicável a submenus)*

Uma tela só está concluída quando todos os níveis **aplicáveis** (§3.1) estiverem marcados.
Submenus concluem-se com Interface + Navegação.

---

## 6. Critérios de aprovação de cada entrega

1. Design neobrutalista fiel ao Stitch (cores, bordas, sombras, tipografia).
2. Responsiva (3 col ≥961px, 2 col 600–960px, 1 col <600px — mesmos breakpoints do Menu).
3. Offline (sem CDN), TypeScript estrito compilando, sem erros de console.
4. `← VOLTAR` e retorno ao Menu funcionando; formulários sujam exigem confirmação.
5. Testes: typecheck + build + testes Java + smoke da API + verificação visual nas resoluções padrão.
6. Nenhum push sem autorização; nada de regra financeira no frontend.
7. Cada entrega (individual ou agrupada) é apresentada e aguarda aprovação antes de iniciar a próxima.

---

*Documento gerado como planejamento (Etapa 2); revisões v2 (correções) e v3 (entrega agrupada de submenus).*
