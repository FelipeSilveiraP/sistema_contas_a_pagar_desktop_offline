package com.chaveiro;

import javafx.application.Application;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.Scene;
import javafx.scene.control.Alert;
import javafx.scene.control.Label;
import javafx.scene.control.ScrollPane;
import javafx.scene.layout.ColumnConstraints;
import javafx.scene.layout.GridPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.RowConstraints;
import javafx.scene.layout.VBox;
import javafx.scene.paint.Color;
import javafx.scene.shape.SVGPath;
import javafx.stage.Stage;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

public class App extends Application {

    private static final String INK = "#1C1B1B";
    private static final String STYLESHEET = "/styles/neobrutalism.css";

    private static final String ICON_CONTA =
            "M5 21V3l1.5 1.5L8 3l1.5 1.5L11 3l1.5 1.5L14 3l1.5 1.5L17 3l1.5 1.5L20 3v18l-1.5-1.5L17 21l-1.5-1.5L14 21l-1.5-1.5L11 21l-1.5-1.5L8 21 6.5 19.5 5 21zm2-3.85l1-.9 1.5 1.5 1.5-1.5 1.5 1.5 1.5-1.5 1.5 1.5 1-.9V5.85l-1 .9-1.5-1.5-1.5 1.5-1.5-1.5-1.5 1.5-1.5-1.5-1 .9v11.3zM8 8h9V6H8v2zm0 4h9v-2H8v2zm0 4h6v-2H8v2z";
    private static final String ICON_CONTROLE =
            "M3 6.25L4.41 4.84L7.24 7.67L5.83 9.08L3 6.25ZM9 5H21V7H9V5ZM3 14.25L4.41 12.84L7.24 15.67L5.83 17.08L3 14.25ZM9 13H21V15H9V13ZM9 17H17V19H9V17Z";
    private static final String ICON_CADASTROS =
            "M20 7h-5V4c0-1.1-.9-2-2-2h-2c-1.1 0-2 .9-2 2v3H4c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2zm-9-3h2v5h-2V4zm1 9.5c1.38 0 2.5 1.12 2.5 2.5s-1.12 2.5-2.5 2.5-2.5-1.12-2.5-2.5 1.12-2.5 2.5-2.5zm6 7.5H6v-.5c0-2 4-3.1 6-3.1s6 1.1 6 3.1v.5z";
    private static final String ICON_MENSAGENS =
            "M21 6h-2v9H6v2c0 .55.45 1 1 1h11l4 4V7c0-.55-.45-1-1-1zm-4 6V3c0-.55-.45-1-1-1H3c-.55 0-1 .45-1 1v14l4-4h10c.55 0 1-.45 1-1z";
    private static final String ICON_GRAFICOS = "M5 9.2h3V19H5zM10.6 5h2.8v14h-2.8zM16.2 13H19v6h-2.8z";

    private static final String MINI_PLUS = "M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z";
    private static final String MINI_CONTROLE =
            "M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z";
    private static final String MINI_CADASTROS =
            "M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zM4 18V6h16v12H4zm8-10c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zm-4 8c0-1.33 2.67-2 4-2s4 .67 4 2v1H8v-1z";
    private static final String MINI_MENSAGENS =
            "M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z";
    private static final String MINI_GRAFICOS = "M21 16.5l-6-6-4 4-7.5-7.5 1.5-1.5 6 6 4-4 7.5 7.5z";
    private static final String ICON_CALENDAR_CLOCK =
            "M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm-6-8h-2v4.25l3.5 2.08.75-1.23-2.75-1.6V12z";
    private static final String ICON_BUILDING =
            "M21 10h-8.35A5.99 5.99 0 0 0 7 6c-3.31 0-6 2.69-6 6s2.69 6 6 6a5.99 5.99 0 0 0 5.65-4H13l2 2 2-2 2 2 2-2v-4zM7 15c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z";
    private static final String ICON_STORE =
            "M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z";
    private static final String ICON_SHIELD =
            "M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z";

    @Override
    public void start(Stage stage) {
        VBox root = new VBox();
        root.setAlignment(Pos.CENTER);
        root.setSpacing(22);
        root.setPadding(new Insets(24, 32, 24, 32));
        root.getStyleClass().add("menu-root");
        root.setMinHeight(720);

        root.getChildren().addAll(buildBannerMensagens(), buildGridMenus());

        ScrollPane scroll = new ScrollPane(root);
        scroll.setFitToWidth(true);
        scroll.setFitToHeight(true);
        scroll.getStyleClass().add("menu-scroll");

        Scene scene = new Scene(scroll, 1280, 820);
        scene.getStylesheets().add(getClass().getResource(STYLESHEET).toExternalForm());

        stage.setTitle("Contas a Pagar - Chaveiro Universal");
        stage.setScene(scene);
        stage.show();
    }

    private VBox buildBannerMensagens() {
        VBox container = new VBox();
        container.setMaxWidth(1040);
        container.getStyleClass().add("banner-mensagens-container");

        HBox header = new HBox();
        header.setAlignment(Pos.CENTER_LEFT);
        header.setSpacing(12);
        header.getStyleClass().add("banner-header");
        header.getChildren().addAll(
                svg(ICON_CALENDAR_CLOCK, 1.1, INK),
                label("MENSAGENS DO DIA", "banner-title"),
                spacer(),
                label(dataHoje(), "banner-subtitle"));

        VBox table = new VBox();
        table.getChildren().addAll(
                tableHeader(),
                tableRow("24/10/2023", ICON_BUILDING, "Silca Chaves do Brasil", "R$ 840,00", "SIM", "VENCE HOJE"),
                tableRow("25/10/2023", ICON_STORE, "Gold Chaves & Lâminas", "R$ 320,50", "SIM", "A VENCER"),
                tableRow("28/10/2023", ICON_SHIELD, "Aliança Cadeados & Fechaduras", "R$ 260,00", "NÃO", "A VENCER"));

        container.getChildren().addAll(header, table);
        return container;
    }

    private HBox tableHeader() {
        HBox row = new HBox();
        row.setAlignment(Pos.CENTER_LEFT);
        row.setSpacing(12);
        row.getStyleClass().add("tabela-stitch-header");
        row.getChildren().addAll(
                fixedLabel("VENCIMENTO", 130, Pos.CENTER),
                growLabel("EMPRESA", 380),
                fixedLabel("VALOR", 130, Pos.CENTER_RIGHT),
                fixedLabel("NA PASTA?", 120, Pos.CENTER),
                fixedLabel("STATUS", 130, Pos.CENTER));
        return row;
    }

    private HBox tableRow(String vencimento, String icon, String empresa, String valor, String naPasta, String status) {
        HBox row = new HBox();
        row.setAlignment(Pos.CENTER_LEFT);
        row.setSpacing(12);
        row.getStyleClass().add("tabela-stitch-row");

        Label lblVenc = fixedLabel(vencimento, 130, Pos.CENTER);
        lblVenc.getStyleClass().add("data-mono");

        HBox empresaCell = new HBox();
        empresaCell.setAlignment(Pos.CENTER_LEFT);
        empresaCell.setSpacing(8);
        empresaCell.setMinWidth(380);
        HBox.setHgrow(empresaCell, Priority.ALWAYS);
        empresaCell.getChildren().addAll(svg(icon, 0.8, INK), label(empresa, "empresa-nome"));

        Label lblValor = fixedLabel(valor, 130, Pos.CENTER_RIGHT);
        lblValor.getStyleClass().add("valor-mono");

        row.getChildren().addAll(
                lblVenc,
                empresaCell,
                lblValor,
                badgeCell(120, naPasta, naPasta.equals("SIM") ? "badge-sim" : "badge-nao"),
                badgeCell(130, status, status.equals("VENCE HOJE") ? "badge-vence-hoje" : "badge-a-vencer"));
        return row;
    }

    private HBox badgeCell(int minWidth, String text, String styleClass) {
        HBox cell = new HBox();
        cell.setAlignment(Pos.CENTER);
        cell.setMinWidth(minWidth);
        cell.getChildren().add(label(text, styleClass));
        return cell;
    }

    private GridPane buildGridMenus() {
        GridPane grid = new GridPane();
        grid.setMaxWidth(1040);
        grid.setAlignment(Pos.CENTER);
        grid.setHgap(24);
        grid.setVgap(20);

        for (int i = 0; i < 3; i++) {
            ColumnConstraints col = new ColumnConstraints();
            col.setPercentWidth(33.33);
            grid.getColumnConstraints().add(col);

            RowConstraints row = new RowConstraints();
            row.setPrefHeight(155);
            grid.getRowConstraints().add(row);
        }

        grid.add(menuCard("INSERIR CONTA", "stitch-card-amarelo", "stitch-mini-amarelo", INK, ICON_CONTA, MINI_PLUS), 0, 0);
        grid.add(menuCard("CONTROLE", "stitch-card-azul", "stitch-mini-azul", INK, ICON_CONTROLE, MINI_CONTROLE), 2, 0);
        grid.add(menuCard("CADASTROS", "stitch-card-laranja", "stitch-mini-laranja", "#FFFFFF", ICON_CADASTROS, MINI_CADASTROS), 1, 1);
        grid.add(menuCard("MENSAGENS", "stitch-card-rosa", "stitch-mini-rosa", "#FFFFFF", ICON_MENSAGENS, MINI_MENSAGENS), 0, 2);
        grid.add(menuCard("GRÁFICOS", "stitch-card-verde", "stitch-mini-verde", INK, ICON_GRAFICOS, MINI_GRAFICOS), 2, 2);

        return grid;
    }

    private VBox menuCard(String titulo, String corCard, String corMini, String fillMini, String icone, String iconeMini) {
        VBox card = new VBox();
        card.getStyleClass().addAll("stitch-card", corCard);

        VBox area = new VBox();
        area.setAlignment(Pos.CENTER);
        area.getStyleClass().add("stitch-card-area");
        VBox iconBox = new VBox();
        iconBox.setAlignment(Pos.CENTER);
        iconBox.getStyleClass().add("stitch-icon-box");
        iconBox.getChildren().add(svg(icone, 1.6, INK));
        area.getChildren().add(iconBox);
        VBox.setVgrow(area, Priority.ALWAYS);

        HBox footer = new HBox();
        footer.setAlignment(Pos.CENTER_LEFT);
        footer.getStyleClass().add("stitch-card-footer");
        footer.getChildren().addAll(
                label(titulo, "stitch-card-title"),
                spacer(),
                miniBox(corMini, iconeMini, fillMini));

        card.getChildren().addAll(area, footer);
        card.setOnMouseClicked(e -> avisoModulo(titulo));
        return card;
    }

    private VBox miniBox(String styleClass, String icone, String fill) {
        VBox box = new VBox();
        box.setAlignment(Pos.CENTER);
        box.getStyleClass().addAll("stitch-mini-box", styleClass);
        box.getChildren().add(svg(icone, 0.9, fill));
        return box;
    }

    private void avisoModulo(String modulo) {
        Alert alert = new Alert(Alert.AlertType.INFORMATION);
        alert.setTitle("Menu Principal");
        alert.setHeaderText(modulo);
        alert.setContentText("Módulo \"" + modulo + "\" será conectado na próxima etapa.");
        alert.getDialogPane().getScene().getStylesheets().add(getClass().getResource(STYLESHEET).toExternalForm());
        alert.showAndWait();
    }

    private String dataHoje() {
        LocalDate hoje = LocalDate.now();
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("d 'DE' MMMM 'DE' yyyy", new Locale("pt", "BR"));
        return "HOJE: " + formatter.format(hoje).toUpperCase(Locale.ROOT);
    }

    private Label label(String text, String styleClass) {
        Label label = new Label(text);
        label.getStyleClass().add(styleClass);
        return label;
    }

    private Label fixedLabel(String text, double width, Pos alignment) {
        Label label = new Label(text);
        label.setMinWidth(width);
        label.setPrefWidth(width);
        label.setMaxWidth(width);
        label.setAlignment(alignment);
        return label;
    }

    private Label growLabel(String text, double minWidth) {
        Label label = new Label(text);
        label.setMinWidth(minWidth);
        HBox.setHgrow(label, Priority.ALWAYS);
        return label;
    }

    private Region spacer() {
        Region region = new Region();
        HBox.setHgrow(region, Priority.ALWAYS);
        return region;
    }

    private SVGPath svg(String content, double scale, String fill) {
        SVGPath path = new SVGPath();
        path.setContent(content);
        path.setFill(Color.web(fill));
        path.setScaleX(scale);
        path.setScaleY(scale);
        return path;
    }

    public static void main(String[] args) {
        launch(args);
    }
}
