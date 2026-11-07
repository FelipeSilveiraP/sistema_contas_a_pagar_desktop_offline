package com.chaveiro.database;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.sql.Statement;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Fabrica de conexoes SQLite com modo WAL para resiliencia contra desligamento subito.
 * O banco fica em diretorio persistente do usuario Windows (%LOCALAPPDATA%), nunca
 * dentro do instalador ou em pastas temporarias.
 */
@Component
public class ConnectionFactory {

    private static final Logger log = LoggerFactory.getLogger(ConnectionFactory.class);

    private final Path caminhoBanco;

    public ConnectionFactory(@Value("${findesk.db.path:}") String caminhoSobrescrito) {
        this.caminhoBanco = resolverCaminho(caminhoSobrescrito);
        try {
            Files.createDirectories(caminhoBanco.getParent());
        } catch (IOException erro) {
            throw new IllegalStateException("Nao foi possivel criar o diretorio de dados", erro);
        }
        try {
            Class.forName("org.sqlite.JDBC");
        } catch (ClassNotFoundException erro) {
            throw new IllegalStateException("driver SQLite JDBC ausente no classpath", erro);
        }
        log.info("banco SQLite em {}", caminhoBanco);
    }

    private static Path resolverCaminho(String sobrescrito) {
        if (sobrescrito != null && !sobrescrito.isBlank()) {
            return Path.of(sobrescrito.trim()).toAbsolutePath().normalize();
        }
        String localAppData = System.getenv("LOCALAPPDATA");
        Path base = (localAppData != null && !localAppData.isBlank())
                ? Path.of(localAppData)
                : Path.of(System.getProperty("user.home"), "AppData", "Local");
        return base.resolve("ChaveiroUniversal").resolve("ContasAPagar").resolve("contas_a_pagar.db");
    }

    public Connection getConnection() throws SQLException {
        Connection conexao = DriverManager.getConnection("jdbc:sqlite:" + caminhoBanco);
        try (Statement stmt = conexao.createStatement()) {
            stmt.execute("PRAGMA journal_mode = WAL;");
            stmt.execute("PRAGMA synchronous = NORMAL;");
            stmt.execute("PRAGMA foreign_keys = ON;");
            stmt.execute("PRAGMA busy_timeout = 5000;");
        }
        return conexao;
    }

    public Path getCaminhoBanco() {
        return caminhoBanco;
    }

    public Path getDiretorioDados() {
        return caminhoBanco.getParent();
    }
}
