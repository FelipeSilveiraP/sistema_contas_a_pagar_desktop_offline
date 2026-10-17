package com.chaveiro.database;

import java.io.File;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.sql.Statement;

/**
 * Fábrica de conexões SQLite com modo WAL para resiliência contra desligamento súbito.
 * Implementa padrão Connection Factory sem frameworks externos (JDBC puro).
 */
public final class ConnectionFactory {

    private static final String PASTA_SISTEMA = System.getProperty("user.home") + File.separator + ".chaveiro_universal";
    private static final String CAMINHO_BANCO = PASTA_SISTEMA + File.separator + "contas.db";
    private static final String URL_JDBC = "jdbc:sqlite:" + CAMINHO_BANCO;

    static {
        // Registra explicitamente o driver SQLite JDBC para evitar No suitable driver found
        try {
            Class.forName("org.sqlite.JDBC");
        } catch (ClassNotFoundException e) {
            System.err.println("Driver SQLite JDBC não encontrado no classpath: " + e.getMessage());
        }

        // Garante que o diretório base existe
        File pasta = new File(PASTA_SISTEMA);
        if (!pasta.exists()) {
            pasta.mkdirs();
        }
    }

    private ConnectionFactory() {}

    /**
     * Obtém uma conexão aberta com o SQLite aplicando as diretrizes de integridade (WAL).
     */
    public static Connection getConnection() throws SQLException {
        Connection conn = DriverManager.getConnection(URL_JDBC);
        try (Statement stmt = conn.createStatement()) {
            // WAL (Write-Ahead Logging) evita corrupção se o computador desligar
            stmt.execute("PRAGMA journal_mode = WAL;");
            stmt.execute("PRAGMA synchronous = NORMAL;");
            stmt.execute("PRAGMA foreign_keys = ON;");
        }
        return conn;
    }

    public static String getCaminhoBanco() {
        return CAMINHO_BANCO;
    }
}
