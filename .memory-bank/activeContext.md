# Active Context

## Foco Atual
**Entrega 2.1 APROVADA e PRESERVADA** (branch `feature/navbar-global`, commit de preservação local, NENHUM push):
barra de navegação global responsiva (barra desktop 6 botões + menu lateral compacto hambúrguer→X)
em todas as telas internas. Smoke 199/199 + JUnit 4/4 + build/tsc + auditoria final (0 credenciais).
Capturas: `docs/responsivo/nav-*.png` + `<tela>-*.png`. Plano revisado v4 (§4.1).
Próximo passo: Fase 3 (Entrega 3.1 — fundação SQLite + Cadastro de Banco) — NÃO iniciar sem autorização.

## Entrega 2.1 (navbar global)
- `frontend/ts/navbar.ts` — componente único: config central (destinos, ícones, cores oficiais do
  Menu `#FF8400`/`#38BDF8`/`#FF5E89`/`#00FF66`, módulo ativo), barra desktop (≥900px, ordem
  VOLTAR/MENU/CADASTROS/CONTROLE/MENSAGENS/GRÁFICOS), hambúrguer (3 linhas → X via CSS transform,
  250ms, prefers-reduced-motion), painel lateral (retângulo único, divisórias, **6 itens — VOLTAR
  incluído** conforme correção aprovada), véu
- VOLTAR sem histórico → Menu (comportamento seguro); VOLTAR/MENU PRINCIPAL/modules no painel
- Requisito crítico atendido: painel/véu são camadas `position:fixed`+`z-index` — cartões NÃO se
  movem (getBoundingClientRect idêntico antes/depois; verificado em 480/600/768 e telas 2–3 cartões)
- Fechamento: X / clique fora / ESC / auto-ao-navegar; ESC fechado = voltar (pilha sessionStorage)
- `telas/submenu.ts` monta navbar por tela; `componentes.ts` perdeu `registrarBotaoVoltar` (substituído)
- Menu Principal aprovado: intocado (sem navbar)

## Descobertas/ajustes
- Ícones da barra nas cores oficiais dos módulos (spec: "na cor laranja/azul/original do módulo");
  destaque ativo = preenchimento da cor + ícone preto (contraste)
- Breakpoint 900px = largura real necessária p/ 6 botões (medido: barra cabe em 960px sem overflow)
- Correção pós-entrega (aprovada): VOLTAR adicionado ao painel compacto (6 itens, VOLTAR primeiro)
- Flakiness do smoke resolvida: janela de teste blindada (setMovable(false) + setIgnoreMouseEvents)
  — a janela visível estava sendo arrastada/redimensionada durante os testes; resize por faixa
  (SO clampa janelas > área de trabalho 1536x864@125%)

## Git
- `feature/navbar-global` (a partir de `feature/navegacao-submenus` = `f4fcbaf`); entrega 2.1
  preservada em commit local nesta branch
- `main`/`develop` intocadas; NADA publicado (push AGUARDA autorização explícita)

## Pendências
1. Iniciar Entrega 3.1 (fundação SQLite + Cadastro de Banco) — SOMENTE após autorização do usuário
2. Push ao GitHub — AGUARDA autorização explícita
3. Sequência Fase 3 (3.2+): Pagador → Empresa → Tabela Todos os Cadastros → Inserir Conta →
   Boletos/baixa → Pagos → Recorrentes → Mensagens → Gráficos (uma entrega por vez)
