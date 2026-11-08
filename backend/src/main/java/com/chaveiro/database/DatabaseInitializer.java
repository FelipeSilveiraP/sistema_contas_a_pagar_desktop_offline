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
    private static final int VERSAO_ATUAL = 6;

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
            case 2 -> new String[] {
                // Cadastro de Banco reduzido a instituicao + chave Pix: reconstrucao da
                // tabela preservando id, instituicao e chave_pix dos cadastros existentes.
                """
                CREATE TABLE bancos_v2 (
                    id_banco INTEGER PRIMARY KEY AUTOINCREMENT,
                    instituicao TEXT NOT NULL,
                    chave_pix TEXT
                )
                """,
                "INSERT INTO bancos_v2 (id_banco, instituicao, chave_pix)"
                        + " SELECT id_banco, instituicao, chave_pix FROM bancos",
                "DROP TABLE bancos",
                "ALTER TABLE bancos_v2 RENAME TO bancos",
                "CREATE INDEX IF NOT EXISTS idx_bancos_instituicao ON bancos(instituicao)",
            };
            case 3 -> new String[] {
                """
                CREATE TABLE IF NOT EXISTS pagadores (
                    id_pagador INTEGER PRIMARY KEY AUTOINCREMENT,
                    nome TEXT NOT NULL,
                    cpf TEXT NOT NULL,
                    funcao TEXT
                )
                """,
            };
            case 4 -> new String[] {
                // CPF passa a opcional (validado apenas quando preenchido) e funcao
                // aceita ate 100 caracteres: reconstrucao preservando os cadastros.
                """
                CREATE TABLE pagadores_v4 (
                    id_pagador INTEGER PRIMARY KEY AUTOINCREMENT,
                    nome TEXT NOT NULL,
                    cpf TEXT,
                    funcao TEXT
                )
                """,
                "INSERT INTO pagadores_v4 (id_pagador, nome, cpf, funcao)"
                        + " SELECT id_pagador, nome, cpf, funcao FROM pagadores",
                "DROP TABLE pagadores",
                "ALTER TABLE pagadores_v4 RENAME TO pagadores",
            };
            case 5 -> new String[] {
                // Empresas/fornecedores + telefones (1FN), conforme DER legado.
                """
                CREATE TABLE IF NOT EXISTS empresas (
                    id_empresa INTEGER PRIMARY KEY AUTOINCREMENT,
                    cnpj TEXT UNIQUE,
                    razao_social TEXT NOT NULL,
                    nome_representante TEXT,
                    email TEXT,
                    logradouro TEXT,
                    data_cadastro TEXT DEFAULT (date('now'))
                )
                """,
                """
                CREATE TABLE IF NOT EXISTS telefones_empresa (
                    id_telefone INTEGER PRIMARY KEY AUTOINCREMENT,
                    id_empresa INTEGER NOT NULL,
                    numero TEXT NOT NULL,
                    tipo TEXT DEFAULT 'Comercial',
                    FOREIGN KEY (id_empresa) REFERENCES empresas(id_empresa) ON DELETE CASCADE
                )
                """,
            };
            case 6 -> new String[] {
                // Indices para as ordenacoes das listas (consultas sob demanda).
                "CREATE INDEX IF NOT EXISTS idx_pagadores_nome ON pagadores(nome)",
                "CREATE INDEX IF NOT EXISTS idx_empresas_razao ON empresas(razao_social)",
            };
            default -> throw new IllegalStateException("migracao desconhecida: " + versao);
        };
    }
}
