# Briefing Técnico & Arquitetural: Sistema Contas a Pagar (Chaveiro Universal)

> **Instrução para o Gemini:** Analise criticamente este briefing de projeto de software sem condescendência (sem apenas concordar comigo). Traga múltiplos pontos de vista técnicos, avalie os prós, contras e riscos ocultos das decisões de arquitetura e me ajude a escolher o caminho definitivo.

---

## 1. Visão Geral do Produto e Restrições Rígidas

* **Nome do Sistema:** Contas a Pagar - Chaveiro Universal
* **Objetivo:** Gestão financeira local (contas em aberto, contas fixas/recorrentes, histórico de pagamentos, cadastros de fornecedores/bancos e quadro de recados).
* **Perfil do Usuário Final:** Funcionários e atendentes extremamente leigos em tecnologia. O sistema precisa ser blindado contra erros humanos, com interface autoexplicativa, botões grandes e fluxos simples.
* **Infraestrutura e Execução:**
  * **100% OFFLINE:** Não pode depender de conexão com internet para funcionar.
  * **Executável Desktop (`.exe`):** Deve rodar no Windows com inicialização simples (idealmente sem exigir instalações complexas de runtimes por parte do usuário final).
  * **Persistência de Dados:** Banco de dados local em arquivo único (ex: SQLite), sem necessidade de instalar servidores externos de banco.

---

## 2. O Design Feito no Google Stitch

O design foi concebido na ferramenta **Stitch with Google** (Projeto: `SISTEMA CONTAS A PAGAR CHAVEIRO`).

* **Identidade Visual:** Neobrutalismo (Cores de alto contraste: Amarelo Primário `#FFE600`, Azul `#2563EB`, Verde `#10B981`, Roxo `#9333EA`; bordas sólidas pretas de 3px a 4px; sombras duras sem desfoque `4px 4px 0px #000`; tipografia *Space Grotesk*).
* **Código Base Gerado no Stitch:** Telas em HTML estruturado com utilitários **Tailwind CSS**.
* **Mapeamento de Fluxo (29 Telas):**
  1. **Menu Principal (5 Botões Gigantes):**
     * `1. INSERIR CONTA` ➔ Formulário direto em 2 etapas (Valor/Vencimento ➔ Categoria/Fornecedor/NF).
     * `2. CONTROLE` ➔ Submenu com 3 opções claras:
       * *Todas as Contas* ➔ Tabela com botão de baixa rápida (`PAGO` / `NÃO PAGO`) e painel de edição.
       * *Contas Recorrentes* ➔ Submenu: Tabela de recorrentes ou Cadastro Roxo de recorrência.
       * *Pagos* ➔ Tabela verde com histórico exclusivo do que já foi quitado.
     * `3. CADASTROS (Centro)` ➔ Submenu:
       * *Todos os Cadastros* ➔ Tabela multi-filtro (Empresas, Pagadores, Bancos).
       * *Novo Cadastro* ➔ 3 opções: Cadastrar Empresa (2 etapas), Cadastrar Pagador, Cadastrar Banco.
     * `4. MENSAGENS` ➔ Quadro de recados internos da oficina (Todas as mensagens / Criar nova).
     * `5. GRÁFICOS` ➔ Dashboard simplificado de gastos mensais com botão nativo de `🖨️ IMPRIMIR`.

---

## 3. O Dilema de Engenharia & Decisão de Stack

### Minhas preferências e momento atual:
* **Preferência por linguagens fortemente tipadas e estruturadas:** Gosto de **Java** e **C#**. Tenho forte aversão a JavaScript e Python por considerar que facilitam "gambiarras", erros de tipagem em tempo de execução e falta de rigor arquitetural em POO.
* **Estudo para Concursos Públicos:** Estou ativamente estudando para concursos de TI no Brasil, bancas que cobram massivamente **Java** e conceitos formais de POO, padrões de projeto e banco de dados.
* **Minhas preocupações com Java:**
  * O comportamento do Garbage Collector (muitas vezes citado como "limpeza de cache que atrapalha ou causa engasgos").
  * A burocracia de versões, compatibilidade e empacotamento de runtime para o usuário final.

### Pontos de tensão e contrapontos técnicos levantados:
1. **Java Desktop (JavaFX) vs. CSS do Stitch:**
   * O Stitch gera HTML + Tailwind CSS.
   * O JavaFX não interpreta CSS de navegador; ele usa uma especificação proprietária (`-fx-*`). O design do Stitch não pode ser simplesmente colado no JavaFX, exigindo reconstrução manual de estilos e componentes.
2. **C# (.NET / WPF / Avalonia) vs. Java (JavaFX):**
   * No ecossistema Windows Desktop offline, C# é nativo da plataforma Microsoft e conta com frameworks de UI muito mais modernos e integrados que o JavaFX.
3. **Distribuição do Executável (`.exe`):**
   * O empacotamento de Java com `jpackage` gera instaladores de 100MB+ por embutir a JRE mínima.
   * Em C#, o Single File Publish (`dotnet publish -r win-x64 --self-contained`) gera um `.exe` direto e enxuto.
4. **Web Desktop Offline (Tauri / Electron):**
   * Vantagem: Aproveita 100% do HTML/Tailwind já gerado no Stitch sem redesenhar nada.
   * Desvantagem: Envolve JavaScript/TypeScript no frontend (tecnologia que desejo evitar se possível).
5. **Foco no Concurso vs. Produto:**
   * Concursos de TI cobram Java em nível de backend (POO, Collections, Streams, SQL, SOLID, Spring), e praticamente nunca cobram interfaces gráficas desktop em JavaFX.

---

## 4. O que preciso que o Gemini analise:

1. **Veredito de Linguagem/Stack:** Considerando o requisito inegociável de ser um `.exe` offline para Windows e minha preferência por tipagem estática e POO (Java vs C# vs alternativas), qual é a recomendação técnica mais racional e sem rodeios?
2. **Viabilidade do Design:** Como transpor o layout do Stitch (Tailwind Neobrutalista) para a stack recomendada com o menor atrito possível?
3. **Estrutura de Persistência:** Como desenhar a camada de dados local (SQLite com JDBC / Entity Framework / Dapper) para garantir que seja à prova de corrupção caso o usuário simplesmente desligue o computador da tomada?
4. **Plano de Ação:** Qual deve ser o passo a passo para iniciar o código com base nessa arquitetura?
