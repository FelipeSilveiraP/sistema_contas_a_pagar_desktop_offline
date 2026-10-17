package com.chaveiro.controller;

import com.chaveiro.service.ContaService;
import javafx.event.ActionEvent;
import javafx.fxml.FXML;
import javafx.scene.control.Button;

/**
 * Controller fino do Menu Principal.
 * Responsável apenas por escutar os cliques nos 5 botões principais e navegar.
 */
public class MenuController {

    private final ContaService contaService;

    @FXML private Button btnInserirConta;
    @FXML private Button btnControle;
    @FXML private Button btnCadastros;
    @FXML private Button btnMensagens;
    @FXML private Button btnGraficos;

    public MenuController(ContaService contaService) {
        this.contaService = contaService;
    }

    public MenuController() {
        this(null);
    }

    public ContaService getContaService() {
        return contaService;
    }

    @FXML
    public void initialize() {
        // Inicialização limpa da tela
    }

    @FXML
    private void onInserirConta(ActionEvent event) {
        System.out.println("Navegando para: Inserir Conta (Formulário em 2 etapas)");
        // Chamará a transição para a tela de formulário
    }

    @FXML
    private void onControle(ActionEvent event) {
        System.out.println("Navegando para: Submenu Controle (Todas as Contas / Recorrentes / Pagos)");
        // Chamará o submenu de 3 botões
    }

    @FXML
    private void onCadastros(ActionEvent event) {
        System.out.println("Navegando para: Submenu Cadastros (Empresas / Pagadores / Bancos)");
    }

    @FXML
    private void onMensagens(ActionEvent event) {
        System.out.println("Navegando para: Mensagens e Lembretes da Oficina");
    }

    @FXML
    private void onGraficos(ActionEvent event) {
        System.out.println("Navegando para: Dashboard de Gráficos e Relatórios");
    }
}
