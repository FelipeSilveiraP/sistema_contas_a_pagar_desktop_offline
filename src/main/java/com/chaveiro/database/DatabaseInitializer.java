package com.chaveiro.database;

import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;

/**
 * Inicializador do esquema de banco de dados SQLite (DDL).
 * Cria todas as tabelas, índices e dados padrão (seed data)
 * mapeados a partir do Modelo Entidade-Relacionamento Estendido (EER).
 */
public final class DatabaseInitializer {

    private DatabaseInitializer() {}

    public static void initialize() {
        String sqlTabelas = """
            -- 1. Categorias de Contas
            CREATE TABLE IF NOT EXISTS categorias (
                id_categoria INTEGER PRIMARY KEY AUTOINCREMENT,
                nome_categoria TEXT NOT NULL UNIQUE,
                descricao TEXT
            );

            -- 2. Formas de Pagamento
            CREATE TABLE IF NOT EXISTS formas_pagamento (
                id_forma INTEGER PRIMARY KEY AUTOINCREMENT,
                tipo_pagamento TEXT NOT NULL UNIQUE
            );

            -- 3. Bancos e Contas da Oficina
            CREATE TABLE IF NOT EXISTS bancos (
                id_banco INTEGER PRIMARY KEY AUTOINCREMENT,
                nome_instituicao TEXT NOT NULL,
                tipo_conta TEXT,
                agencia TEXT,
                conta_corrente TEXT,
                chave_pix TEXT
            );

            -- 4. Empresas / Fornecedores
            CREATE TABLE IF NOT EXISTS empresas (
                id_empresa INTEGER PRIMARY KEY AUTOINCREMENT,
                cnpj TEXT UNIQUE,
                razao_social TEXT NOT NULL,
                nome_representante TEXT,
                email TEXT,
                logradouro TEXT,
                data_cadastro TEXT DEFAULT (date('now'))
            );

            -- 5. Telefones das Empresas (1FN estrita)
            CREATE TABLE IF NOT EXISTS telefones_empresa (
                id_telefone INTEGER PRIMARY KEY AUTOINCREMENT,
                id_empresa INTEGER NOT NULL,
                numero TEXT NOT NULL,
                tipo TEXT DEFAULT 'Comercial',
                FOREIGN KEY (id_empresa) REFERENCES empresas(id_empresa) ON DELETE CASCADE
            );

            -- 6. Pagadores (Pessoa Física e Jurídica mapeadas via Tabela Única 'xt')
            CREATE TABLE IF NOT EXISTS pagadores (
                id_pagador INTEGER PRIMARY KEY AUTOINCREMENT,
                nome TEXT NOT NULL,
                telefone TEXT,
                data_cadastro TEXT DEFAULT (date('now')),
                tipo_pessoa TEXT NOT NULL CHECK (tipo_pessoa IN ('PF', 'PJ')),
                cpf TEXT,
                razao_social TEXT,
                cnpj TEXT
            );

            -- 7. Notas Fiscais
            CREATE TABLE IF NOT EXISTS notas_fiscais (
                id_nota INTEGER PRIMARY KEY AUTOINCREMENT,
                numero_nota TEXT NOT NULL,
                data_emissao TEXT NOT NULL,
                chave_acesso TEXT,
                valor_total REAL NOT NULL,
                arquivo_pdf TEXT
            );

            -- 8. Contas a Pagar (Entidade Central)
            CREATE TABLE IF NOT EXISTS contas_a_pagar (
                id_conta INTEGER PRIMARY KEY AUTOINCREMENT,
                id_empresa INTEGER NOT NULL,
                id_categoria INTEGER NOT NULL,
                id_forma_pagamento INTEGER,
                id_pagador INTEGER NOT NULL,
                id_nota INTEGER,
                data_vencimento TEXT NOT NULL,
                valor_total REAL NOT NULL,
                status_pagamento TEXT NOT NULL DEFAULT 'PENDENTE' CHECK (status_pagamento IN ('PENDENTE', 'PAGO', 'ATRASADO')),
                na_pasta INTEGER NOT NULL DEFAULT 0,
                numero_documento TEXT,
                observacoes TEXT,
                recorrente INTEGER DEFAULT 0,
                FOREIGN KEY (id_empresa) REFERENCES empresas(id_empresa),
                FOREIGN KEY (id_categoria) REFERENCES categorias(id_categoria),
                FOREIGN KEY (id_forma_pagamento) REFERENCES formas_pagamento(id_forma),
                FOREIGN KEY (id_pagador) REFERENCES pagadores(id_pagador),
                FOREIGN KEY (id_nota) REFERENCES notas_fiscais(id_nota)
            );

            -- 9. Pagamentos Efetuados (Liquidação de Contas)
            CREATE TABLE IF NOT EXISTS pagamentos (
                id_pagamento INTEGER PRIMARY KEY AUTOINCREMENT,
                id_conta INTEGER NOT NULL UNIQUE,
                id_pagador INTEGER NOT NULL,
                id_banco INTEGER NOT NULL,
                data_pagamento TEXT NOT NULL DEFAULT (date('now')),
                valor_pago REAL NOT NULL,
                caminho_comprovante TEXT,
                FOREIGN KEY (id_conta) REFERENCES contas_a_pagar(id_conta) ON DELETE CASCADE,
                FOREIGN KEY (id_pagador) REFERENCES pagadores(id_pagador),
                FOREIGN KEY (id_banco) REFERENCES bancos(id_banco)
            );

            -- 10. Boletos Recorrentes (Molde anual do legado VBA)
            CREATE TABLE IF NOT EXISTS boletos_recorrentes (
                id_boleto_recorrente INTEGER PRIMARY KEY AUTOINCREMENT,
                id_empresa INTEGER NOT NULL,
                id_categoria INTEGER NOT NULL,
                id_pagador INTEGER NOT NULL,
                id_forma_pagamento INTEGER,
                dia_vencimento INTEGER NOT NULL CHECK (dia_vencimento BETWEEN 1 AND 31),
                valor_padrao REAL NOT NULL,
                numero_documento TEXT,
                status_ativo INTEGER NOT NULL DEFAULT 1,
                FOREIGN KEY (id_empresa) REFERENCES empresas(id_empresa),
                FOREIGN KEY (id_categoria) REFERENCES categorias(id_categoria),
                FOREIGN KEY (id_pagador) REFERENCES pagadores(id_pagador),
                FOREIGN KEY (id_forma_pagamento) REFERENCES formas_pagamento(id_forma)
            );

            -- 11. Quadro de Avisos / Recados da Oficina
            CREATE TABLE IF NOT EXISTS avisos (
                id_aviso INTEGER PRIMARY KEY AUTOINCREMENT,
                titulo TEXT NOT NULL,
                mensagem TEXT NOT NULL,
                data_inicio TEXT NOT NULL,
                data_fim TEXT,
                dia_semana TEXT,
                autor TEXT,
                status_ativo INTEGER NOT NULL DEFAULT 1
            );

            -- 12. Tabela de Auditoria Atômica (Segurança Financeira)
            CREATE TABLE IF NOT EXISTS auditoria_operacoes (
                id_auditoria INTEGER PRIMARY KEY AUTOINCREMENT,
                data_hora TEXT DEFAULT (datetime('now', 'localtime')),
                operador TEXT NOT NULL,
                tipo_acao TEXT NOT NULL,
                entidade TEXT NOT NULL,
                registro_id INTEGER NOT NULL,
                detalhes_json TEXT
            );

            -- Índices para buscas instantâneas na interface gráfica
            CREATE INDEX IF NOT EXISTS idx_contas_vencimento ON contas_a_pagar(data_vencimento);
            CREATE INDEX IF NOT EXISTS idx_contas_status ON contas_a_pagar(status_pagamento);
            CREATE INDEX IF NOT EXISTS idx_contas_empresa ON contas_a_pagar(id_empresa);
            CREATE INDEX IF NOT EXISTS idx_pagamentos_conta ON pagamentos(id_conta);
        """;

        String sqlSeeds = """
            -- Inserções iniciais idempotentes
            INSERT OR IGNORE INTO categorias (nome_categoria, descricao) VALUES 
                ('Fornecedores de Chaves', 'Chaves virgens, cilindros, carcaças e miolos'),
                ('Aluguel e Condomínio', 'Custos do ponto comercial'),
                ('Energia e Água', 'Contas de concessionárias'),
                ('Telefonia e Internet', 'Linha comercial e banda larga'),
                ('Software e Sistemas', 'Licenças operacionais'),
                ('Diversos', 'Gastos gerais do dia a dia');

            INSERT OR IGNORE INTO formas_pagamento (tipo_pagamento) VALUES 
                ('Boleto Bancário'),
                ('Pix'),
                ('Cartão de Crédito'),
                ('Cartão de Débito'),
                ('Transferência Bancária'),
                ('Dinheiro');

            INSERT OR IGNORE INTO pagadores (nome, tipo_pessoa, cpf) VALUES 
                ('LIVIA METIDIERI', 'PF', '000.000.000-00');

            INSERT OR IGNORE INTO bancos (nome_instituicao, tipo_conta) VALUES 
                ('Banco do Brasil', 'Conta Corrente'),
                ('Itaú', 'Conta Corrente'),
                ('Caixa Econômica', 'Conta Corrente');
        """;

        try (Connection conn = ConnectionFactory.getConnection();
             Statement stmt = conn.createStatement()) {

            // Executa criação do esquema DDL
            for (String query : sqlTabelas.split(";")) {
                if (!query.trim().isEmpty()) {
                    stmt.execute(query.trim());
                }
            }

            // Executa carga de sementes iniciais
            for (String seed : sqlSeeds.split(";")) {
                if (!seed.trim().isEmpty()) {
                    stmt.execute(seed.trim());
                }
            }

        } catch (SQLException e) {
            System.err.println("Erro ao inicializar o banco de dados SQLite: " + e.getMessage());
            throw new RuntimeException("Falha na inicialização do banco de dados", e);
        }
    }
}
