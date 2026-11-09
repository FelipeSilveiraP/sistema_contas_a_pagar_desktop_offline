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
    private static final int VERSAO_ATUAL = 11;

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
            case 7 -> new String[] {
                // Contas a pagar: valor em CENTAVOS (inteiro) para precisao monetaria
                // exata; status limitado aos valores do sistema legado (PENDENTE/PAGO).
                """
                CREATE TABLE IF NOT EXISTS contas_a_pagar (
                    id_conta INTEGER PRIMARY KEY AUTOINCREMENT,
                    id_empresa INTEGER NOT NULL,
                    id_pagador INTEGER,
                    categoria TEXT,
                    numero_documento TEXT,
                    valor_centavos INTEGER NOT NULL CHECK (valor_centavos > 0),
                    vencimento TEXT NOT NULL,
                    boleto_na_pasta INTEGER NOT NULL DEFAULT 0,
                    status TEXT NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE', 'PAGO')),
                    criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime')),
                    FOREIGN KEY (id_empresa) REFERENCES empresas(id_empresa) ON DELETE RESTRICT,
                    FOREIGN KEY (id_pagador) REFERENCES pagadores(id_pagador) ON DELETE SET NULL
                )
                """,
                "CREATE INDEX IF NOT EXISTS idx_contas_vencimento ON contas_a_pagar(vencimento)",
                "CREATE INDEX IF NOT EXISTS idx_contas_status ON contas_a_pagar(status)",
            };
            case 8 -> new String[] {
                // Fidelidade ao formulario Stitch "Inserir Conta": nome da empresa e
                // pagador responsavel em texto livre (regra VBA), tipo de conta PF/PJ,
                // documento de cobranca (forma de pagamento), empresa emissora opcional
                // (FK SET NULL — historico preservado ao excluir cadastro) e anexo de
                // nota fiscal (PDF) no proprio SQLite (sobrevive a backup VACUUM INTO).
                """
                CREATE TABLE contas_a_pagar_v8 (
                    id_conta INTEGER PRIMARY KEY AUTOINCREMENT,
                    nome_empresa TEXT NOT NULL,
                    id_empresa INTEGER,
                    pagador_responsavel TEXT NOT NULL,
                    tipo_pessoa TEXT NOT NULL DEFAULT 'PJ' CHECK (tipo_pessoa IN ('PF', 'PJ')),
                    forma_pagamento TEXT NOT NULL,
                    categoria TEXT,
                    numero_documento TEXT,
                    valor_centavos INTEGER NOT NULL CHECK (valor_centavos > 0),
                    vencimento TEXT NOT NULL,
                    boleto_na_pasta INTEGER NOT NULL DEFAULT 0,
                    anexo_nome TEXT,
                    anexo_pdf BLOB,
                    status TEXT NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE', 'PAGO')),
                    criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime')),
                    FOREIGN KEY (id_empresa) REFERENCES empresas(id_empresa) ON DELETE SET NULL
                )
                """,
                """
                INSERT INTO contas_a_pagar_v8
                    (id_conta, nome_empresa, id_empresa, pagador_responsavel, tipo_pessoa,
                     forma_pagamento, categoria, numero_documento, valor_centavos, vencimento,
                     boleto_na_pasta, status, criado_em)
                SELECT c.id_conta,
                       COALESCE((SELECT e.razao_social FROM empresas e WHERE e.id_empresa = c.id_empresa), 'NÃO INFORMADO'),
                       c.id_empresa,
                       COALESCE((SELECT p.nome FROM pagadores p WHERE p.id_pagador = c.id_pagador), 'NÃO INFORMADO'),
                       'PJ',
                       'boleto',
                       c.categoria,
                       c.numero_documento,
                       c.valor_centavos,
                       c.vencimento,
                       c.boleto_na_pasta,
                       c.status,
                       c.criado_em
                FROM contas_a_pagar c
                """,
                "DROP TABLE contas_a_pagar",
                "ALTER TABLE contas_a_pagar_v8 RENAME TO contas_a_pagar",
                "CREATE INDEX IF NOT EXISTS idx_contas_vencimento ON contas_a_pagar(vencimento)",
                "CREATE INDEX IF NOT EXISTS idx_contas_status ON contas_a_pagar(status)",
            };
            case 9 -> new String[] {
                // Pagamento integral unico por conta (decisao aprovada: sem parciais).
                // UNIQUE(id_conta) impede duplicidade; valor pago pode diferir do
                // original (juros/desconto, regra aprovada); banco opcional.
                """
                CREATE TABLE IF NOT EXISTS pagamentos (
                    id_pagamento INTEGER PRIMARY KEY AUTOINCREMENT,
                    id_conta INTEGER NOT NULL UNIQUE,
                    data_pagamento TEXT NOT NULL,
                    valor_pago_centavos INTEGER NOT NULL CHECK (valor_pago_centavos > 0),
                    id_banco INTEGER,
                    criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime')),
                    FOREIGN KEY (id_conta) REFERENCES contas_a_pagar(id_conta) ON DELETE CASCADE,
                    FOREIGN KEY (id_banco) REFERENCES bancos(id_banco) ON DELETE SET NULL
                )
                """,
                "CREATE INDEX IF NOT EXISTS idx_pagamentos_data ON pagamentos(data_pagamento)",
            };
            case 10 -> new String[] {
                // Contas recorrentes (form roxo do Stitch). O dia configurado e
                // preservado; em meses sem o dia, gera no ultimo dia do mes.
                """
                CREATE TABLE IF NOT EXISTS boletos_recorrentes (
                    id_recorrente INTEGER PRIMARY KEY AUTOINCREMENT,
                    nome_empresa TEXT NOT NULL,
                    id_empresa INTEGER,
                    pagador_responsavel TEXT NOT NULL,
                    categoria TEXT,
                    numero_documento TEXT,
                    valor_centavos INTEGER NOT NULL CHECK (valor_centavos > 0),
                    dia INTEGER NOT NULL CHECK (dia BETWEEN 1 AND 31),
                    periodicidade TEXT NOT NULL CHECK (periodicidade IN ('MENSAL','BIMESTRAL','TRIMESTRAL','ANUAL')),
                    forma_pagamento TEXT,
                    ativo INTEGER NOT NULL DEFAULT 1,
                    criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime')),
                    FOREIGN KEY (id_empresa) REFERENCES empresas(id_empresa) ON DELETE SET NULL
                )
                """,
                "ALTER TABLE contas_a_pagar ADD COLUMN id_recorrente INTEGER",
            };
            case 11 -> new String[] {
                // Mensagens/avisos internos (vigencia por periodo + dia da semana).
                """
                CREATE TABLE IF NOT EXISTS avisos (
                    id_aviso INTEGER PRIMARY KEY AUTOINCREMENT,
                    data_inicio TEXT NOT NULL,
                    data_fim TEXT NOT NULL,
                    dia_semana TEXT NOT NULL DEFAULT 'TODOS'
                        CHECK (dia_semana IN ('TODOS','DOMINGO','SEGUNDA','TERCA','QUARTA','QUINTA','SEXTA','SABADO')),
                    titulo TEXT NOT NULL,
                    mensagem TEXT NOT NULL,
                    criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime'))
                )
                """,
                "CREATE INDEX IF NOT EXISTS idx_avisos_vigencia ON avisos(data_inicio, data_fim)",
            };
            default -> throw new IllegalStateException("migracao desconhecida: " + versao);
        };
    }
}
