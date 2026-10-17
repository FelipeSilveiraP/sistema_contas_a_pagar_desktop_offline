package com.chaveiro;

import com.chaveiro.controller.MenuController;
import com.chaveiro.database.DatabaseInitializer;
import javafx.application.Application;
import javafx.application.Platform;
import javafx.fxml.FXMLLoader;
import javafx.scene.Parent;
import javafx.scene.Scene;
import javafx.scene.control.Alert;
import javafx.scene.control.TextArea;
import javafx.scene.layout.VBox;
import javafx.stage.Stage;

import java.io.IOException;
import java.io.PrintWriter;
import java.io.StringWriter;

/**
 * Ponto de entrada da aplicação desktop JavaFX.
 * Inicializa o banco SQLite offline, configura o tratamento global de falhas
 * e carrega o Menu Principal Neobrutalista via Pure DI.
 */
public class App extends Application {

    private final AppContainer container = new AppContainer();

    @Override
    public void start(Stage stage) throws IOException {
        // 1. Configura tratamento global de erros (evita crash abrupto da aplicação)
        configurarTratamentoGlobalErros();

        // 2. Inicializa o banco de dados SQLite local com modo WAL
        DatabaseInitializer.initialize();

        // 3. Carrega a tela do Menu Principal com ControllerFactory (Pure DI)
        FXMLLoader loader = new FXMLLoader(getClass().getResource("/view/menu-principal.fxml"));
        loader.setControllerFactory(clazz -> {
            if (clazz == MenuController.class) {
                return new MenuController(container.getContaService());
            }
            try {
                return clazz.getDeclaredConstructor().newInstance();
            } catch (Exception e) {
                throw new RuntimeException("Falha ao instanciar controller: " + clazz.getName(), e);
            }
        });

        Parent root = loader.load();
        Scene scene = new Scene(root, 900, 680);
        
        stage.setTitle("Chaveiro Universal - Sistema de Contas a Pagar");
        stage.setScene(scene);
        stage.setMinWidth(800);
        stage.setMinHeight(600);
        stage.show();
    }

    private void configurarTratamentoGlobalErros() {
        Thread.setDefaultUncaughtExceptionHandler((thread, throwable) -> {
            System.err.println("Erro não capturado na thread [" + thread.getName() + "]: " + throwable.getMessage());
            throwable.printStackTrace();

            Platform.runLater(() -> exibirAlertaErroAmigavel(throwable));
        });
    }

    private void exibirAlertaErroAmigavel(Throwable throwable) {
        Alert alert = new Alert(Alert.AlertType.ERROR);
        alert.setTitle("Atenção - Ocorreu um Erro Inesperado");
        alert.setHeaderText("O sistema encontrou uma falha, mas seus dados continuam seguros.");
        alert.setContentText("Mensagem: " + throwable.getLocalizedMessage());

        StringWriter sw = new StringWriter();
        throwable.printStackTrace(new PrintWriter(sw));
        TextArea textArea = new TextArea(sw.toString());
        textArea.setEditable(false);
        textArea.setWrapText(true);
        textArea.setMaxWidth(Double.MAX_VALUE);
        textArea.setMaxHeight(Double.MAX_VALUE);

        VBox expContent = new VBox(textArea);
        alert.getDialogPane().setExpandableContent(expContent);
        alert.showAndWait();
    }

    public static void main(String[] args) {
        launch(args);
    }
}
