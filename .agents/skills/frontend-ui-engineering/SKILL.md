---
name: frontend-ui-engineering
description: >
  Diretrizes de engenharia de interface de alta qualidade, responsiva e acessível.
  Evita estética genérica de IA através de tokens de design semânticos, estados
  assíncronos obrigatórios (carregando, vazio, erro), contraste visual WCAG 2.1 AA
  e formulários amigáveis.
triggers:
  - "criar interface"
  - "ui"
  - "formulário"
  - "responsivo"
  - "estilo"
  - "acessibilidade"
origin: "Adaptado de addyosmani/agent-skills (Repositório Público GitHub addyosmani/agent-skills, licença MIT confirmada)"
license: "MIT (Addy Osmani / agent-skills)"
---

# Frontend UI Engineering

Diretrizes para desenvolvimento de interfaces de usuário funcionais, atraentes e consistentes.

## 1. Princípio Fundamental: Fuja da "Estética de IA Genérica"

UIs geradas por IA tendem a ter espaçamentos gigantescos, fontes minúsculas, contrastes baixos e layouts sem densidade prática de trabalho.
- Use tipografia legível e contraste alto (WCAG 2.1 AA).
- Utilize **tokens de design semânticos** (ex.: classes Tailwind semânticas em vez de cores arbitrárias soltas).
- Mantenha densidade adequada para sistemas operacionais de ponto de venda / gestão financeira comercial.

## 2. Três Estados Obrigatórios para Todo Fluxo Assíncrono

Nunca deixe uma interface em branco durante operações assíncronas:
1. **Estado de Carregamento (Loading):** Desabilite botões de envio e exiba indicador visual de processamento ou skeleton loader.
2. **Estado Vazio (Empty State):** Mensagem clara quando não houver registros, instruindo o próximo passo (ex.: "Nenhum banco cadastrado. Clique no botão acima para adicionar").
3. **Estado de Erro com Recuperação (Error State):** Feedback contextual indicando exatamente o que falhou e permitindo tentar novamente sem perder os dados já digitados.

## 3. Acessibilidade e Formulários Robustos

1. **Labels Semânticos:** Todo `<input>` deve ter um `<label>` associado via atributo `for="id"`.
2. **Navegação por Teclado:** A sequência de foco por tecla TAB deve ser lógica e linear.
3. **Erros por Campo:** Erros de validação devem destacar visualmente a borda do campo (`border-red-500`) e exibir o texto explicativo imediatamente abaixo do input.
4. **Proteção Contra Perda de Dados (Dirty Form):**
   - Rastrear alterações nos campos do formulário.
   - Ao tentar sair (tecla ESC, botão Voltar, fechar modal), confirmar ação do usuário se houver dados não salvos.

## 4. Responsividade e Breakpoints Oficiais

Garantir boa exibição nas 3 faixas de resolução suportadas pelo projeto:
* **Desktop Padrão (≥ 900px):** Navbar expandida, visualização completa em grade ou tabela larga.
* **Tablet / Janela Reduzida (768px):** Menu condensado ou hambúrguer, formulários em coluna única ou dupla compacta.
* **Compacto / Mínimo (480px):** Espaçamentos enxutos, largura 100%, sem quebras horizontais de rolagem indesejadas.

