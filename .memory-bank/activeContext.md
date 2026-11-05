# Active Context

## Foco Atual
Reinício total do código da interface: todo o `src/` anterior (18 telas, controllers, FXML, services, banco) foi **apagado por comando do usuário**. Resta apenas a **Tela de Menu Principal** reconstruído do zero em JavaFX puro (sem FXML), fiel ao sketch (tela 09 de `telas_referencia/`).

## Estrutura Atual (pós-reinício)
- `src/main/java/com/chaveiro/App.java` — única classe Java: `Application` que monta o Menu em código (banner "MENSAGENS DO DIA" + grade 3x3 com os 5 cards gigantes).
- `src/main/resources/styles/neobrutalism.css` — CSS Neobrutalista exclusivo da Tela de Menu (só especificação JavaFX `-fx-*`).
- `pom.xml` inalterado (mainClass `com.chaveiro.App`, Java 21, JavaFX 21). `EXECUTAR_SISTEMA.bat` continua válido (`mvn javafx:run`).

## Diretrizes de Design (vigentes)
- **Fonte de verdade visual**: `telas_referencia/*.png` (Sketch Stitch — nota: agente não lê imagens; layout reconstruído a partir do briefing + FXML anterior validado).
- **Regra de ouro**: somente propriedades `-fx-*`; proibido CSS web/Tailwind.
- **Bordas**: pretas sólidas `4px` (`#1C1B1B`); **sombras duras**: `dropshadow(three-pass-box, #1C1B1B, 0, 0, 6, 6)` sem blur.
- **Paleta dos 5 cards**: `#FFE600` (Inserir Conta), `#38BDF8` (Controle), `#FF8400` (Cadastros), `#FF5E89` (Mensagens), `#00FF66` (Gráficos); fundo `#FCF9F8`; tipografia Space Grotesk (peso 900).
- Clique nos cards exibe `Alert` de módulo "a conectar" (teste de interação).

## Decisões Recentes
* Descarte total do código anterior (inclui arquivos não commitados) — comando explícito do usuário.
* Menu reconstruído sem FXML/Controller: UI montada em Java dentro de `App` (menos arquivos, roda imediatamente).
* `mvn clean compile` OK; smoke test `mvn javafx:run` por 35s sem exceções no stderr.

## Próximos Passos
1. Validação visual do usuário (`EXECUTAR_SISTEMA.bat` ou `mvn javafx:run`).
2. Aprovação do layout do Menu antes de reconstruir os demais fluxos.
3. Recriar fluxos restantes (Inserir Conta, Controle, Cadastros, Mensagens, Gráficos) sobre esta base.
