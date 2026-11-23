package com.chaveiro.database;

import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;
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
    private static final int VERSAO_ATUAL = 22;

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
        inicializarAte(VERSAO_ATUAL);
    }

    /**
     * Leva o banco ate a versao `alvo` (os testes usam para montar um banco igual ao de
     * uma versao antiga do sistema e conferir que a atualizacao nao perde nada).
     */
    void inicializarAte(int alvo) {
        try {
            int versao = lerVersao();
            if (versao >= alvo) {
                log.info("esquema SQLite ja esta na versao {}", versao);
                return;
            }
            log.info("aplicando migracoes SQLite: versao {} -> {}", versao, alvo);
            try (Connection conn = conexao.getConnection()) {
                conn.setAutoCommit(false);
                try (Statement stmt = conn.createStatement()) {
                    for (int v = versao + 1; v <= alvo; v++) {
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
                    dia_semana TEXT NOT NULL DEFAULT 'TODOS',
                    titulo TEXT NOT NULL,
                    mensagem TEXT NOT NULL,
                    criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime'))
                )
                """,
                "CREATE INDEX IF NOT EXISTS idx_avisos_vigencia ON avisos(data_inicio, data_fim)",
            };
            case 12 -> new String[] {
                // Tipo de conta (PF/PJ) escolhido no form roxo: antes era descartado e
                // as contas geradas saiam sempre PJ. Aditiva: registros antigos ficam PJ.
                "ALTER TABLE boletos_recorrentes ADD COLUMN tipo_pessoa TEXT NOT NULL DEFAULT 'PJ'",
            };
            case 13 -> new String[] {
                // Nota fiscal obrigatoria na conta nova: anexo OU a marca "veio sem nota".
                // Aditiva: contas antigas ficam 0 (nao marcadas).
                "ALTER TABLE contas_a_pagar ADD COLUMN sem_nota_fiscal INTEGER NOT NULL DEFAULT 0"
                        + " CHECK (sem_nota_fiscal IN (0, 1))",
            };
            case 14 -> new String[] {
                // Area de recepcao dos dados da planilha legada (VBA/Excel), SEPARADA das
                // tabelas do sistema: guarda cada linha como veio (texto bruto) + origem,
                // para importar e conferir depois sem misturar com as contas atuais.
                // Abas mensais JANEIRO..DEZEMBRO: DATA | NRO DOCTO | FORNECEDOR | VALOR |
                // PAGOS | OBSERVACOES (na pasta/negociacao) | QUEM VAI PAGAR.
                """
                CREATE TABLE IF NOT EXISTS legado_lancamentos (
                    id_legado INTEGER PRIMARY KEY AUTOINCREMENT,
                    arquivo_origem TEXT NOT NULL,
                    aba_origem TEXT NOT NULL,
                    linha_origem INTEGER NOT NULL CHECK (linha_origem > 0),
                    data_vencimento TEXT,
                    numero_documento TEXT,
                    fornecedor TEXT,
                    valor_original TEXT,
                    valor_centavos INTEGER,
                    situacao TEXT,
                    observacoes TEXT,
                    quem_vai_pagar TEXT,
                    cor_linha TEXT,
                    id_conta_migrada INTEGER REFERENCES contas_a_pagar(id_conta) ON DELETE SET NULL,
                    importado_em TEXT NOT NULL DEFAULT (datetime('now','localtime')),
                    UNIQUE (arquivo_origem, aba_origem, linha_origem)
                )
                """,
                "CREATE INDEX IF NOT EXISTS idx_legado_lanc_venc ON legado_lancamentos(data_vencimento)",
                // Aba Config_Padroes: contas fixas (DIA | NOME | VALOR | DOC | PAGADOR).
                """
                CREATE TABLE IF NOT EXISTS legado_padroes (
                    id_legado INTEGER PRIMARY KEY AUTOINCREMENT,
                    arquivo_origem TEXT NOT NULL,
                    linha_origem INTEGER NOT NULL CHECK (linha_origem > 0),
                    dia TEXT,
                    nome TEXT,
                    valor_original TEXT,
                    valor_centavos INTEGER,
                    numero_documento TEXT,
                    pagador TEXT,
                    importado_em TEXT NOT NULL DEFAULT (datetime('now','localtime')),
                    UNIQUE (arquivo_origem, linha_origem)
                )
                """,
                // Aba Config_Avisos: recados (PERIODO DE | TEMPO (ate) | DIA | TITULO | MENSAGEM).
                """
                CREATE TABLE IF NOT EXISTS legado_avisos (
                    id_legado INTEGER PRIMARY KEY AUTOINCREMENT,
                    arquivo_origem TEXT NOT NULL,
                    linha_origem INTEGER NOT NULL CHECK (linha_origem > 0),
                    periodo_de TEXT,
                    periodo_ate TEXT,
                    dia_semana TEXT,
                    titulo TEXT,
                    mensagem TEXT,
                    importado_em TEXT NOT NULL DEFAULT (datetime('now','localtime')),
                    UNIQUE (arquivo_origem, linha_origem)
                )
                """,
            };
            case 15 -> new String[] {
                // Bancos criados com a 1a versao da v11 tem CHECK (dia_semana IN (...um dia...))
                // e recusam "SEGUNDA,TERCA,..." (varios dias) -> nao salvava mensagem.
                // SQLite nao altera CHECK: recria a tabela SEM o CHECK, copia os dados e
                // GUARDA a antiga renomeada (nada e apagado; ha backup pre-migracao).
                """
                CREATE TABLE avisos_v15 (
                    id_aviso INTEGER PRIMARY KEY AUTOINCREMENT,
                    data_inicio TEXT NOT NULL,
                    data_fim TEXT NOT NULL,
                    dia_semana TEXT NOT NULL DEFAULT 'TODOS',
                    titulo TEXT NOT NULL,
                    mensagem TEXT NOT NULL,
                    criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime'))
                )
                """,
                "INSERT INTO avisos_v15 (id_aviso, data_inicio, data_fim, dia_semana, titulo, mensagem, criado_em)"
                        + " SELECT id_aviso, data_inicio, data_fim, dia_semana, titulo, mensagem, criado_em FROM avisos",
                "ALTER TABLE avisos RENAME TO avisos_antes_v15",
                "ALTER TABLE avisos_v15 RENAME TO avisos",
                "CREATE INDEX IF NOT EXISTS idx_avisos_vigencia_v15 ON avisos(data_inicio, data_fim)",
            };
            case 16 -> new String[] {
                // Limpeza trimestral das notas fiscais (pedido do usuario): o arquivo
                // sai do banco, a conta fica; guarda QUANDO a nota foi removida.
                "ALTER TABLE contas_a_pagar ADD COLUMN anexo_removido_em TEXT",
                // Datas das rotinas automaticas (ultima limpeza, etc.).
                """
                CREATE TABLE IF NOT EXISTS manutencao (
                    chave TEXT PRIMARY KEY,
                    valor TEXT NOT NULL
                )
                """,
            };
            case 17 -> migracaoSeguranca();
            case 18 -> migracaoAuditoriaRecorrentes();
            case 19 -> contasDeUsuario().toArray(String[]::new);
            case 20 -> recorrenteSemDuplicata();
            case 21 -> new String[] {
                // como foi pago de verdade (PIX, DINHEIRO, CREDITO...), escolhido ou escrito no pop-up do PAGO
                "ALTER TABLE pagamentos ADD COLUMN forma_pagamento TEXT"
                        + " CHECK (forma_pagamento IS NULL OR length(forma_pagamento) BETWEEN 2 AND 40)"
            };
            case 22 -> protecoesV22();
            default -> throw new IllegalStateException("migracao desconhecida: " + versao);
        };
    }

    /** Colunas da conta gravadas na auditoria (o arquivo da nota fica de fora: so "tem_nota"). */
    private static String jsonConta(String r) {
        return "json_object('id_conta', " + r + ".id_conta, 'nome_empresa', " + r + ".nome_empresa,"
                + " 'id_empresa', " + r + ".id_empresa, 'pagador_responsavel', " + r + ".pagador_responsavel,"
                + " 'tipo_pessoa', " + r + ".tipo_pessoa, 'forma_pagamento', " + r + ".forma_pagamento,"
                + " 'categoria', " + r + ".categoria, 'numero_documento', " + r + ".numero_documento,"
                + " 'valor_centavos', " + r + ".valor_centavos, 'vencimento', " + r + ".vencimento,"
                + " 'boleto_na_pasta', " + r + ".boleto_na_pasta, 'anexo_nome', " + r + ".anexo_nome,"
                + " 'tem_nota', " + r + ".anexo_pdf IS NOT NULL, 'sem_nota_fiscal', " + r + ".sem_nota_fiscal,"
                + " 'anexo_removido_em', " + r + ".anexo_removido_em, 'status', " + r + ".status,"
                + " 'id_recorrente', " + r + ".id_recorrente)";
    }

    private static String jsonPagamento(String r) {
        return "json_object('id_pagamento', " + r + ".id_pagamento, 'id_conta', " + r + ".id_conta,"
                + " 'data_pagamento', " + r + ".data_pagamento, 'valor_pago_centavos', " + r + ".valor_pago_centavos,"
                + " 'id_banco', " + r + ".id_banco)";
    }

    private static String auditar(String tabela, String operacao, String idRegistro, String antes, String depois) {
        return "INSERT INTO auditoria_operacoes (tabela, operacao, id_registro, antes, depois) VALUES ('"
                + tabela + "', '" + operacao + "', " + idRegistro + ", " + antes + ", " + depois + ");";
    }

    /**
     * v17 - gatilhos de seguranca (so acrescenta; nenhum dado existente e alterado):
     * 1) conta com pagamento nao pode ser excluida (o ON DELETE CASCADE apagava o
     *    pagamento junto, sem aviso);
     * 2) status coerente com o pagamento: PAGO so com pagamento, PENDENTE so sem,
     *    toda conta nasce PENDENTE e o pagamento nao muda de conta;
     * 3) trilha de auditoria automatica de contas e pagamentos (antes/depois);
     * 4) a auditoria e somente-inclusao: nao pode ser alterada nem apagada.
     */
    private static String[] migracaoSeguranca() {
        return new String[] {
            """
            CREATE TABLE IF NOT EXISTS auditoria_operacoes (
                id_auditoria INTEGER PRIMARY KEY AUTOINCREMENT,
                momento TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now', 'localtime')),
                tabela TEXT NOT NULL,
                operacao TEXT NOT NULL CHECK (operacao IN ('INSERT', 'UPDATE', 'DELETE')),
                id_registro INTEGER NOT NULL,
                antes TEXT,
                depois TEXT
            )
            """,
            "CREATE INDEX IF NOT EXISTS idx_auditoria_registro ON auditoria_operacoes(tabela, id_registro)",
            "CREATE INDEX IF NOT EXISTS idx_auditoria_momento ON auditoria_operacoes(momento)",
            """
            CREATE TRIGGER IF NOT EXISTS trg_conta_paga_nao_exclui
            BEFORE DELETE ON contas_a_pagar
            WHEN EXISTS (SELECT 1 FROM pagamentos WHERE id_conta = OLD.id_conta)
            BEGIN
                SELECT RAISE(ABORT, 'CONTA_COM_PAGAMENTO: desfaca o pagamento antes de excluir a conta');
            END
            """,
            """
            CREATE TRIGGER IF NOT EXISTS trg_conta_nasce_pendente
            BEFORE INSERT ON contas_a_pagar
            WHEN NEW.status <> 'PENDENTE'
            BEGIN
                SELECT RAISE(ABORT, 'STATUS_INVALIDO: a conta nasce PENDENTE; o PAGO vem do registro do pagamento');
            END
            """,
            """
            CREATE TRIGGER IF NOT EXISTS trg_status_pago_exige_pagamento
            BEFORE UPDATE OF status ON contas_a_pagar
            WHEN NEW.status = 'PAGO' AND NOT EXISTS (SELECT 1 FROM pagamentos WHERE id_conta = NEW.id_conta)
            BEGIN
                SELECT RAISE(ABORT, 'STATUS_INVALIDO: conta PAGO sem pagamento registrado');
            END
            """,
            """
            CREATE TRIGGER IF NOT EXISTS trg_status_pendente_sem_pagamento
            BEFORE UPDATE OF status ON contas_a_pagar
            WHEN NEW.status = 'PENDENTE' AND EXISTS (SELECT 1 FROM pagamentos WHERE id_conta = NEW.id_conta)
            BEGIN
                SELECT RAISE(ABORT, 'STATUS_INVALIDO: conta PENDENTE com pagamento registrado');
            END
            """,
            """
            CREATE TRIGGER IF NOT EXISTS trg_pagamento_nao_troca_conta
            BEFORE UPDATE OF id_conta ON pagamentos
            WHEN NEW.id_conta <> OLD.id_conta
            BEGIN
                SELECT RAISE(ABORT, 'PAGAMENTO_INVALIDO: o pagamento nao pode mudar de conta');
            END
            """,
            "CREATE TRIGGER IF NOT EXISTS trg_auditoria_conta_insert AFTER INSERT ON contas_a_pagar BEGIN "
                    + auditar("contas_a_pagar", "INSERT", "NEW.id_conta", "NULL", jsonConta("NEW")) + " END",
            "CREATE TRIGGER IF NOT EXISTS trg_auditoria_conta_update AFTER UPDATE ON contas_a_pagar"
                    + " WHEN " + jsonConta("OLD") + " IS NOT " + jsonConta("NEW") + " BEGIN "
                    + auditar("contas_a_pagar", "UPDATE", "NEW.id_conta", jsonConta("OLD"), jsonConta("NEW")) + " END",
            "CREATE TRIGGER IF NOT EXISTS trg_auditoria_conta_delete AFTER DELETE ON contas_a_pagar BEGIN "
                    + auditar("contas_a_pagar", "DELETE", "OLD.id_conta", jsonConta("OLD"), "NULL") + " END",
            "CREATE TRIGGER IF NOT EXISTS trg_auditoria_pagamento_insert AFTER INSERT ON pagamentos BEGIN "
                    + auditar("pagamentos", "INSERT", "NEW.id_pagamento", "NULL", jsonPagamento("NEW")) + " END",
            "CREATE TRIGGER IF NOT EXISTS trg_auditoria_pagamento_update AFTER UPDATE ON pagamentos"
                    + " WHEN " + jsonPagamento("OLD") + " IS NOT " + jsonPagamento("NEW") + " BEGIN "
                    + auditar("pagamentos", "UPDATE", "NEW.id_pagamento", jsonPagamento("OLD"), jsonPagamento("NEW")) + " END",
            "CREATE TRIGGER IF NOT EXISTS trg_auditoria_pagamento_delete AFTER DELETE ON pagamentos BEGIN "
                    + auditar("pagamentos", "DELETE", "OLD.id_pagamento", jsonPagamento("OLD"), "NULL") + " END",
            """
            CREATE TRIGGER IF NOT EXISTS trg_auditoria_nao_altera
            BEFORE UPDATE ON auditoria_operacoes
            BEGIN
                SELECT RAISE(ABORT, 'AUDITORIA_SOMENTE_LEITURA: a auditoria nao pode ser alterada');
            END
            """,
            """
            CREATE TRIGGER IF NOT EXISTS trg_auditoria_nao_apaga
            BEFORE DELETE ON auditoria_operacoes
            BEGIN
                SELECT RAISE(ABORT, 'AUDITORIA_SOMENTE_LEITURA: a auditoria nao pode ser apagada');
            END
            """,
        };
    }

    private static String jsonRecorrente(String r) {
        return "json_object('id_recorrente', " + r + ".id_recorrente, 'nome_empresa', " + r + ".nome_empresa,"
                + " 'id_empresa', " + r + ".id_empresa, 'pagador_responsavel', " + r + ".pagador_responsavel,"
                + " 'categoria', " + r + ".categoria, 'numero_documento', " + r + ".numero_documento,"
                + " 'valor_centavos', " + r + ".valor_centavos, 'dia', " + r + ".dia,"
                + " 'periodicidade', " + r + ".periodicidade, 'forma_pagamento', " + r + ".forma_pagamento,"
                + " 'ativo', " + r + ".ativo, 'tipo_pessoa', " + r + ".tipo_pessoa)";
    }

    /** Teto de valor no proprio banco (R$ 999.999.999,99), igual ao da API. */
    private static String gatilhoValorMaximo(String nome, String tabela, String coluna, String evento) {
        return "CREATE TRIGGER IF NOT EXISTS " + nome + " BEFORE " + evento + " ON " + tabela
                + " WHEN NEW." + coluna + " > 99999999999"
                + " BEGIN SELECT RAISE(ABORT, 'VALOR_INVALIDO: valor acima de R$ 999.999.999,99'); END";
    }

    /**
     * v18 - auditoria de seguranca 2026-11-15 (so acrescenta; nenhum dado muda):
     * 1) a trilha de auditoria passa a registrar tambem as contas fixas
     *    (boletos_recorrentes), que geram 12 contas de uma vez;
     * 2) teto de valor no banco (defesa em profundidade: a API ja recusa).
     */
    private static String[] migracaoAuditoriaRecorrentes() {
        return new String[] {
            "CREATE TRIGGER IF NOT EXISTS trg_auditoria_recorrente_insert AFTER INSERT ON boletos_recorrentes BEGIN "
                    + auditar("boletos_recorrentes", "INSERT", "NEW.id_recorrente", "NULL", jsonRecorrente("NEW")) + " END",
            "CREATE TRIGGER IF NOT EXISTS trg_auditoria_recorrente_update AFTER UPDATE ON boletos_recorrentes"
                    + " WHEN " + jsonRecorrente("OLD") + " IS NOT " + jsonRecorrente("NEW") + " BEGIN "
                    + auditar("boletos_recorrentes", "UPDATE", "NEW.id_recorrente", jsonRecorrente("OLD"), jsonRecorrente("NEW")) + " END",
            "CREATE TRIGGER IF NOT EXISTS trg_auditoria_recorrente_delete AFTER DELETE ON boletos_recorrentes BEGIN "
                    + auditar("boletos_recorrentes", "DELETE", "OLD.id_recorrente", jsonRecorrente("OLD"), "NULL") + " END",
            gatilhoValorMaximo("trg_conta_valor_maximo_ins", "contas_a_pagar", "valor_centavos", "INSERT"),
            gatilhoValorMaximo("trg_conta_valor_maximo_upd", "contas_a_pagar", "valor_centavos", "UPDATE OF valor_centavos"),
            gatilhoValorMaximo("trg_pagamento_valor_maximo_ins", "pagamentos", "valor_pago_centavos", "INSERT"),
            gatilhoValorMaximo("trg_pagamento_valor_maximo_upd", "pagamentos", "valor_pago_centavos", "UPDATE OF valor_pago_centavos"),
            gatilhoValorMaximo("trg_recorrente_valor_maximo_ins", "boletos_recorrentes", "valor_centavos", "INSERT"),
            gatilhoValorMaximo("trg_recorrente_valor_maximo_upd", "boletos_recorrentes", "valor_centavos", "UPDATE OF valor_centavos"),
        };
    }

    /** Conta de usuario SEM segredos: nada de login/e-mail cifrado nem hash do PIN (so se mudou). */
    private static String jsonUsuario(String r) {
        return "json_object('id_usuario', " + r + ".id_usuario, 'nome', " + r + ".nome, 'admin', " + r + ".admin,"
                + " 'ativo', " + r + ".ativo, 'tem_foto', " + r + ".foto IS NOT NULL, 'login_indice', " + r + ".login_indice)";
    }

    /**
     * v19 - contas de usuario (tela "Quem esta usando?" com PIN, igual ao Sistema de
     * Garantias). Login, e-mail e PIN NUNCA ficam em texto: login e e-mail cifrados
     * (AES-256-GCM) + indice HMAC do login para a busca; PIN como hash PBKDF2 com sal e
     * chave secreta fora do banco (service/Cripto). O primeiro usuario criado e o
     * administrador. Tambem: foto ate 1 MB, auditoria das contas (sem segredos) e das
     * configuracoes (so a chave, nunca o valor). So acrescenta tabelas e gatilhos.
     */
    private static List<String> contasDeUsuario() {
        List<String> sql = new ArrayList<>();
        sql.add("""
                CREATE TABLE usuarios (
                    id_usuario INTEGER PRIMARY KEY AUTOINCREMENT,
                    nome TEXT NOT NULL CHECK (length(trim(nome)) BETWEEN 2 AND 40),
                    login_indice TEXT NOT NULL UNIQUE,
                    login_cifrado TEXT NOT NULL,
                    email_cifrado TEXT,
                    pin_hash TEXT NOT NULL,
                    foto BLOB,
                    admin INTEGER NOT NULL DEFAULT 0 CHECK (admin IN (0, 1)),
                    ativo INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
                    falhas INTEGER NOT NULL DEFAULT 0 CHECK (falhas >= 0),
                    bloqueado_ate TEXT,
                    acessos INTEGER NOT NULL DEFAULT 0 CHECK (acessos >= 0),
                    ultimo_acesso TEXT,
                    criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime'))
                )
                """);
        // historico de acessos: a conta pode ser excluida, o historico fica (com o nome)
        sql.add("""
                CREATE TABLE acessos_usuario (
                    id_acesso INTEGER PRIMARY KEY AUTOINCREMENT,
                    id_usuario INTEGER REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
                    nome TEXT NOT NULL,
                    momento TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime')),
                    tipo TEXT NOT NULL CHECK (tipo IN ('ENTRADA', 'PIN_ERRADO', 'BLOQUEIO', 'PIN_TROCADO',
                        'PIN_REDEFINIDO_EMAIL', 'PIN_REDEFINIDO_ADMIN', 'CODIGO_ENVIADO'))
                )
                """);
        sql.add("CREATE INDEX idx_acessos_usuario ON acessos_usuario(id_usuario, momento)");
        sql.add("""
                CREATE TABLE codigos_redefinicao (
                    id_codigo INTEGER PRIMARY KEY AUTOINCREMENT,
                    id_usuario INTEGER NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
                    codigo_hash TEXT NOT NULL,
                    expira_em TEXT NOT NULL,
                    tentativas INTEGER NOT NULL DEFAULT 0,
                    usado INTEGER NOT NULL DEFAULT 0 CHECK (usado IN (0, 1)),
                    criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime'))
                )
                """);
        // nunca ficar sem administrador ativo
        sql.add("""
                CREATE TRIGGER trg_ultimo_admin_nao_sai
                BEFORE UPDATE OF admin, ativo ON usuarios
                WHEN OLD.admin = 1 AND OLD.ativo = 1 AND (NEW.admin = 0 OR NEW.ativo = 0)
                    AND (SELECT COUNT(*) FROM usuarios WHERE admin = 1 AND ativo = 1) <= 1
                BEGIN
                    SELECT RAISE(ABORT, 'ULTIMO_ADMIN: o sistema precisa de pelo menos um administrador ativo');
                END
                """);
        sql.add("""
                CREATE TRIGGER trg_ultimo_admin_nao_exclui
                BEFORE DELETE ON usuarios
                WHEN OLD.admin = 1 AND OLD.ativo = 1
                    AND (SELECT COUNT(*) FROM usuarios WHERE admin = 1 AND ativo = 1) <= 1
                BEGIN
                    SELECT RAISE(ABORT, 'ULTIMO_ADMIN: o sistema precisa de pelo menos um administrador ativo');
                END
                """);
        // historico somente-inclusao (so o ON DELETE SET NULL da conta pode mexer nele)
        sql.add("""
                CREATE TRIGGER trg_acessos_nao_altera
                BEFORE UPDATE ON acessos_usuario
                WHEN NOT (NEW.id_usuario IS NULL AND OLD.id_usuario IS NOT NULL
                    AND NEW.nome = OLD.nome AND NEW.momento = OLD.momento AND NEW.tipo = OLD.tipo)
                BEGIN
                    SELECT RAISE(ABORT, 'ACESSOS_SOMENTE_LEITURA: o historico de acessos nao pode ser alterado');
                END
                """);
        sql.add("""
                CREATE TRIGGER trg_acessos_nao_apaga
                BEFORE DELETE ON acessos_usuario
                BEGIN
                    SELECT RAISE(ABORT, 'ACESSOS_SOMENTE_LEITURA: o historico de acessos nao pode ser apagado');
                END
                """);
        for (String op : new String[] {"INSERT", "UPDATE OF foto"}) {
            sql.add("CREATE TRIGGER trg_usuario_foto_" + (op.startsWith("I") ? "insert" : "update") + " BEFORE " + op
                    + " ON usuarios WHEN length(NEW.foto) > 1048576"
                    + " BEGIN SELECT RAISE(ABORT, 'FOTO_GRANDE: a foto passa de 1 MB'); END");
        }
        String depoisUsuario = "json_patch(" + jsonUsuario("NEW") + ", json_object('pin_trocado', OLD.pin_hash IS NOT NEW.pin_hash))";
        sql.add("CREATE TRIGGER trg_auditoria_usuario_insert AFTER INSERT ON usuarios BEGIN "
                + auditar("usuarios", "INSERT", "NEW.id_usuario", "NULL", jsonUsuario("NEW")) + " END");
        sql.add("CREATE TRIGGER trg_auditoria_usuario_update AFTER UPDATE ON usuarios"
                + " WHEN " + jsonUsuario("OLD") + " IS NOT " + jsonUsuario("NEW") + " OR OLD.pin_hash IS NOT NEW.pin_hash"
                + " OR OLD.foto IS NOT NEW.foto BEGIN "
                + auditar("usuarios", "UPDATE", "NEW.id_usuario", jsonUsuario("OLD"), depoisUsuario) + " END");
        sql.add("CREATE TRIGGER trg_auditoria_usuario_delete AFTER DELETE ON usuarios BEGIN "
                + auditar("usuarios", "DELETE", "OLD.id_usuario", jsonUsuario("OLD"), "NULL") + " END");
        // configuracoes: so a chave (o valor pode ser a senha de app cifrada)
        sql.add("CREATE TRIGGER trg_auditoria_config_insert AFTER INSERT ON manutencao BEGIN "
                + auditar("manutencao", "INSERT", "NEW.rowid", "NULL", "json_object('chave', NEW.chave)") + " END");
        sql.add("CREATE TRIGGER trg_auditoria_config_update AFTER UPDATE ON manutencao WHEN OLD.valor IS NOT NEW.valor BEGIN "
                + auditar("manutencao", "UPDATE", "NEW.rowid", "json_object('chave', OLD.chave)",
                        "json_object('chave', NEW.chave, 'valor_alterado', 1)") + " END");
        sql.add("CREATE TRIGGER trg_auditoria_config_delete AFTER DELETE ON manutencao BEGIN "
                + auditar("manutencao", "DELETE", "OLD.rowid", "json_object('chave', OLD.chave)", "NULL") + " END");
        sql.add("CREATE INDEX idx_codigos_usuario ON codigos_redefinicao(id_usuario, criado_em)");
        return sql;
    }

    /**
     * v20 (pedido do usuario, 2026-11-18): conta recorrente IGUAL nao entra duas vezes —
     * mesma empresa (sem ligar para maiuscula/espacos nas pontas), mesmo valor, mesmo dia e
     * mesma frequencia. Ultima linha de defesa (o servico ja recusa); vale tambem para dois
     * cliques no SALVAR ao mesmo tempo. Duplicatas antigas nao sao apagadas sozinhas: editar
     * outro campo delas continua permitido (o gatilho de UPDATE so olha quando a chave muda).
     */
    private static String[] recorrenteSemDuplicata() {
        String igual = "lower(trim(r.nome_empresa)) = lower(trim(NEW.nome_empresa)) AND r.dia = NEW.dia"
                + " AND r.periodicidade = NEW.periodicidade AND r.valor_centavos = NEW.valor_centavos";
        return new String[] {
            "CREATE TRIGGER IF NOT EXISTS trg_recorrente_duplicada_insert BEFORE INSERT ON boletos_recorrentes"
                    + " WHEN EXISTS (SELECT 1 FROM boletos_recorrentes r WHERE " + igual + ")"
                    + " BEGIN SELECT RAISE(ABORT, 'RECORRENTE_DUPLICADA: ja existe uma conta recorrente igual'); END",
            "CREATE TRIGGER IF NOT EXISTS trg_recorrente_duplicada_update BEFORE UPDATE OF nome_empresa, dia, periodicidade,"
                    + " valor_centavos ON boletos_recorrentes"
                    + " WHEN (lower(trim(NEW.nome_empresa)) IS NOT lower(trim(OLD.nome_empresa)) OR NEW.dia IS NOT OLD.dia"
                    + " OR NEW.periodicidade IS NOT OLD.periodicidade OR NEW.valor_centavos IS NOT OLD.valor_centavos)"
                    + " AND EXISTS (SELECT 1 FROM boletos_recorrentes r WHERE " + igual
                    + " AND r.id_recorrente <> NEW.id_recorrente)"
                    + " BEGIN SELECT RAISE(ABORT, 'RECORRENTE_DUPLICADA: ja existe uma conta recorrente igual'); END",
        };
    }

    // ---------- v22: revisao de gatilhos e auditoria (pedido do usuario, 2026-11-23) ----------

    /** Pagamento COMPLETO na auditoria (a forma de pagamento da v21 ficava de fora). */
    private static String jsonPagamentoCompleto(String r) {
        // json_object completo (json_patch apagaria do historico os campos vazios)
        String base = jsonPagamento(r);
        return base.substring(0, base.length() - 1) + ", 'forma_pagamento', " + r + ".forma_pagamento)";
    }

    private static String jsonBanco(String r) {
        return "json_object('id_banco', " + r + ".id_banco, 'instituicao', " + r + ".instituicao, 'chave_pix', " + r + ".chave_pix)";
    }

    private static String jsonPagador(String r) {
        return "json_object('id_pagador', " + r + ".id_pagador, 'nome', " + r + ".nome, 'cpf', " + r + ".cpf,"
                + " 'funcao', " + r + ".funcao)";
    }

    private static String jsonEmpresa(String r) {
        return "json_object('id_empresa', " + r + ".id_empresa, 'cnpj', " + r + ".cnpj, 'razao_social', " + r + ".razao_social,"
                + " 'nome_representante', " + r + ".nome_representante, 'email', " + r + ".email,"
                + " 'logradouro', " + r + ".logradouro)";
    }

    private static String jsonTelefone(String r) {
        return "json_object('id_telefone', " + r + ".id_telefone, 'id_empresa', " + r + ".id_empresa,"
                + " 'numero', " + r + ".numero, 'tipo', " + r + ".tipo)";
    }

    private static String jsonAviso(String r) {
        return "json_object('id_aviso', " + r + ".id_aviso, 'data_inicio', " + r + ".data_inicio, 'data_fim', " + r + ".data_fim,"
                + " 'dia_semana', " + r + ".dia_semana, 'titulo', " + r + ".titulo, 'mensagem', " + r + ".mensagem)";
    }

    private static void auditoriaCompleta(List<String> sql, String tabela, String prefixo, String id,
                                          java.util.function.Function<String, String> json) {
        sql.add("CREATE TRIGGER IF NOT EXISTS " + prefixo + "_insert AFTER INSERT ON " + tabela + " BEGIN "
                + auditar(tabela, "INSERT", "NEW." + id, "NULL", json.apply("NEW")) + " END");
        sql.add("CREATE TRIGGER IF NOT EXISTS " + prefixo + "_update AFTER UPDATE ON " + tabela
                + " WHEN " + json.apply("OLD") + " IS NOT " + json.apply("NEW") + " BEGIN "
                + auditar(tabela, "UPDATE", "NEW." + id, json.apply("OLD"), json.apply("NEW")) + " END");
        sql.add("CREATE TRIGGER IF NOT EXISTS " + prefixo + "_delete AFTER DELETE ON " + tabela + " BEGIN "
                + auditar(tabela, "DELETE", "OLD." + id, json.apply("OLD"), "NULL") + " END");
    }

    /**
     * Regra no INSERT e no UPDATE (so quando a coluna MUDA: editar outro campo de uma linha
     * antiga, gravada antes da regra existir, continua permitido).
     */
    private static void regra(List<String> sql, String nome, String tabela, String coluna, String ruim, String mensagem) {
        String recusa = " BEGIN SELECT RAISE(ABORT, '" + mensagem + "'); END";
        sql.add("CREATE TRIGGER IF NOT EXISTS " + nome + "_ins BEFORE INSERT ON " + tabela + " WHEN " + ruim + recusa);
        sql.add("CREATE TRIGGER IF NOT EXISTS " + nome + "_upd BEFORE UPDATE OF " + coluna + " ON " + tabela
                + " WHEN NEW." + coluna + " IS NOT OLD." + coluna + " AND (" + ruim + ")" + recusa);
    }

    private static String dataRuim(String coluna) {
        return "NEW." + coluna + " IS NOT NULL AND date(NEW." + coluna + ") IS NOT NEW." + coluna;
    }

    /**
     * v22 - revisao dos gatilhos (so acrescenta regras; nenhum dado muda):
     * 1) auditoria COMPLETA: a forma de pagamento entra no historico dos pagamentos, e bancos,
     *    pagadores, empresas, telefones e mensagens passam a ser auditados;
     * 2) datas sempre no formato do calendario (AAAA-MM-DD) e mensagem com inicio <= fim;
     * 3) marcacoes so 0/1 e PF/PJ nas contas fixas;
     * 4) limite de tamanho dos textos (folga sobre o limite da API; ultima linha de defesa);
     * 5) linhas da planilha antiga ficam como vieram (so o vinculo com a conta muda);
     * 6) codigo de "Esqueci o PIN" usado nao volta a valer e as tentativas so sobem.
     */
    private static String[] protecoesV22() {
        List<String> sql = new ArrayList<>();
        // 1) auditoria
        for (String op : new String[] {"insert", "update", "delete"}) {
            sql.add("DROP TRIGGER IF EXISTS trg_auditoria_pagamento_" + op);
        }
        auditoriaCompleta(sql, "pagamentos", "trg_auditoria_pagamento", "id_pagamento", DatabaseInitializer::jsonPagamentoCompleto);
        auditoriaCompleta(sql, "bancos", "trg_auditoria_banco", "id_banco", DatabaseInitializer::jsonBanco);
        auditoriaCompleta(sql, "pagadores", "trg_auditoria_pagador", "id_pagador", DatabaseInitializer::jsonPagador);
        auditoriaCompleta(sql, "empresas", "trg_auditoria_empresa", "id_empresa", DatabaseInitializer::jsonEmpresa);
        auditoriaCompleta(sql, "telefones_empresa", "trg_auditoria_telefone", "id_telefone", DatabaseInitializer::jsonTelefone);
        auditoriaCompleta(sql, "avisos", "trg_auditoria_aviso", "id_aviso", DatabaseInitializer::jsonAviso);
        // 2) datas
        String dataMsg = "DATA_INVALIDA: use uma data valida do calendario (AAAA-MM-DD)";
        regra(sql, "trg_conta_vencimento_data", "contas_a_pagar", "vencimento", dataRuim("vencimento"), dataMsg);
        regra(sql, "trg_pagamento_data", "pagamentos", "data_pagamento", dataRuim("data_pagamento"), dataMsg);
        regra(sql, "trg_aviso_inicio_data", "avisos", "data_inicio", dataRuim("data_inicio") + " OR NEW.data_fim < NEW.data_inicio",
                "DATA_INVALIDA: o fim da mensagem nao pode ser antes do inicio");
        regra(sql, "trg_aviso_fim_data", "avisos", "data_fim", dataRuim("data_fim") + " OR NEW.data_fim < NEW.data_inicio",
                "DATA_INVALIDA: o fim da mensagem nao pode ser antes do inicio");
        // 3) marcacoes
        regra(sql, "trg_conta_boleto_pasta", "contas_a_pagar", "boleto_na_pasta", "NEW.boleto_na_pasta NOT IN (0, 1)",
                "VALOR_INVALIDO: boleto na pasta e 0 ou 1");
        regra(sql, "trg_recorrente_ativo", "boletos_recorrentes", "ativo", "NEW.ativo NOT IN (0, 1)",
                "VALOR_INVALIDO: ativo e 0 ou 1");
        regra(sql, "trg_recorrente_tipo_pessoa", "boletos_recorrentes", "tipo_pessoa", "NEW.tipo_pessoa NOT IN ('PF', 'PJ')",
                "VALOR_INVALIDO: tipo de pessoa e PF ou PJ");
        // 4) tamanho dos textos (limite da API entre parenteses)
        String[][] limites = {
            {"contas_a_pagar", "nome_empresa", "200"}, {"contas_a_pagar", "pagador_responsavel", "200"}, // (120)
            {"contas_a_pagar", "forma_pagamento", "100"}, {"contas_a_pagar", "categoria", "100"},        // (60)
            {"contas_a_pagar", "numero_documento", "100"}, {"contas_a_pagar", "anexo_nome", "300"},      // (60/200)
            {"boletos_recorrentes", "nome_empresa", "200"}, {"boletos_recorrentes", "pagador_responsavel", "200"},
            {"boletos_recorrentes", "categoria", "100"}, {"boletos_recorrentes", "numero_documento", "100"},
            {"boletos_recorrentes", "forma_pagamento", "100"},
            {"empresas", "razao_social", "200"}, {"empresas", "nome_representante", "200"}, {"empresas", "email", "200"},
            {"empresas", "logradouro", "200"}, {"empresas", "cnpj", "30"},
            {"telefones_empresa", "numero", "30"}, {"telefones_empresa", "tipo", "40"},
            {"bancos", "instituicao", "200"}, {"bancos", "chave_pix", "200"},
            {"pagadores", "nome", "200"}, {"pagadores", "cpf", "30"}, {"pagadores", "funcao", "100"},
            {"avisos", "titulo", "200"}, {"avisos", "mensagem", "1000"}, {"avisos", "dia_semana", "100"}, // (100/500; varios dias: "SEGUNDA,TERCA,...")
        };
        for (String[] l : limites) {
            regra(sql, "trg_" + l[0] + "_" + l[1] + "_tamanho", l[0], l[1], "length(NEW." + l[1] + ") > " + l[2],
                    "TEXTO_LONGO: " + l[1] + " passa de " + l[2] + " caracteres");
        }
        // 5) planilha antiga
        String[][] legado = {
            {"legado_lancamentos", "arquivo_origem, aba_origem, linha_origem, data_vencimento, numero_documento, fornecedor,"
                    + " valor_original, valor_centavos, situacao, observacoes, quem_vai_pagar, cor_linha, importado_em"},
            {"legado_padroes", "arquivo_origem, linha_origem, dia, nome, valor_original, valor_centavos, numero_documento,"
                    + " pagador, importado_em"},
            {"legado_avisos", "arquivo_origem, linha_origem, periodo_de, periodo_ate, dia_semana, titulo, mensagem, importado_em"},
        };
        for (String[] l : legado) {
            sql.add("CREATE TRIGGER IF NOT EXISTS trg_" + l[0] + "_nao_altera BEFORE UPDATE OF " + l[1] + " ON " + l[0]
                    + " BEGIN SELECT RAISE(ABORT, 'LEGADO_IMUTAVEL: a linha da planilha antiga fica como foi importada'); END");
        }
        // 6) codigos de redefinicao do PIN
        sql.add("CREATE TRIGGER IF NOT EXISTS trg_codigo_nao_reativa BEFORE UPDATE OF usado, tentativas, codigo_hash, expira_em,"
                + " id_usuario ON codigos_redefinicao WHEN (OLD.usado = 1 AND NEW.usado = 0)"
                + " OR NEW.tentativas < OLD.tentativas OR NEW.codigo_hash IS NOT OLD.codigo_hash"
                + " OR NEW.expira_em IS NOT OLD.expira_em OR NEW.id_usuario IS NOT OLD.id_usuario"
                + " BEGIN SELECT RAISE(ABORT, 'CODIGO_IMUTAVEL: codigo de redefinicao nao pode ser reaproveitado'); END");
        return sql.toArray(String[]::new);
    }
}
