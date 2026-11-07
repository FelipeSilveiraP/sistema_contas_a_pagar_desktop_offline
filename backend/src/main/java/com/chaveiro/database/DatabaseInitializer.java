package com.chaveiro.database;

import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Evolucao versionada do esquema SQLite via PRAGMA user_version.
 * Migracoes sao incrementais e nunca recriam tabelas destrutivamente:
 * cadastros existentes sao preservados entre versoes.
 */
@Component
public class DatabaseInitializer {

    private static final Logger log = LoggerFactory.getLogger(DatabaseInitializer.class);
    private static final int VERSAO_ATUAL = 1;

    private final ConnectionFactory conexao;

    public DatabaseInitializer(ConnectionFactory conexao) {
        this.conexao = conexao;
    }

    public int getVersaoAtual() {
        return VERSAO_ATUAL;
    }

    public int lerVersao() throws SQLException {
        try (Connection conn = conexao.getConnection();
             Statement stmt = conn.createStatement()) {
            var rs = stmt.executeQuery("PRAGMA user_version;");
            return rs.next() ? rs.getInt(1) : 0;
        }
    }

    /**
     * Aplica as migracoes pendentes dentro de transacao unica.
     */
    public void inicializar() {
        try {
            int versao = lerVersao();
            if (versao >= VERSAO_ATUAL) {
                log.info("esquema SQLite ja esta na versao {}", versao);
                return;
            }
            log.info("aplicando migracoes SQLite: versao {} -> {}", versao, VERSAO_ATUAL);
            try (Connection conn = conexao.getConnection()) {
                conn.setAutoCommit(false);
                try (Statement stmt = conn.createStatement()) {
                    for (int v = versao + 1; v <= VERSAO_ATUAL; v++) {
                        for (String comando : migracao(v)) {
                            stmt.execute(comando);
                        }
                        stmt.execute("PRAGMA user_version = " + v + ";");
                        log.info("migracao para a versao {} aplicada", v);
                    }
                    conn.commit();
                } catch (SQLException erro) {
                    conn.rollback();
                    throw erro;
                } finally {
                    conn.setAutoCommit(true);
                }
            }
        } catch (SQLException erro) {
            log.error("falha ao inicializar o banco SQLite", erro);
            throw new IllegalStateException("Falha na inicializacao do banco de dados", erro);
        }
    }

    private static String[] migracao(int versao) {
        return switch (versao) {
            case 1 -> new String[] {
                """
                CREATE TABLE IF NOT EXISTS bancos (
                    id_banco INTEGER PRIMARY KEY AUTOINCREMENT,
                    instituicao TEXT NOT NULL,
                    codigo_banco TEXT NOT NULL,
                    agencia TEXT NOT NULL,
                    conta TEXT NOT NULL,
                    chave_pix TEXT
                )
                """,
                "CREATE INDEX IF NOT EXISTS idx_bancos_instituicao ON bancos(instituicao)",
            };
            default -> throw new IllegalStateException("migracao desconhecida: " + versao);
        };
    }
}
