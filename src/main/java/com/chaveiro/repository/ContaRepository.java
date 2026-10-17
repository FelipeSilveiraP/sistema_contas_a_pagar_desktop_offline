package com.chaveiro.repository;

import com.chaveiro.database.ConnectionFactory;
import com.chaveiro.model.Conta;
import com.chaveiro.model.StatusConta;

import java.sql.*;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * Repository JDBC puro para manipulação de Contas a Pagar no SQLite.
 * Mapeia a tabela contas_a_pagar com suporte a transações atômicas de baixa e auditoria.
 */
public class ContaRepository {

    public Conta salvar(Conta conta) {
        String sql = """
            INSERT INTO contas_a_pagar (
                id_empresa, id_categoria, id_forma_pagamento, id_pagador, id_nota,
                data_vencimento, valor_total, status_pagamento, na_pasta, numero_documento,
                observacoes, recorrente
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """;

        try (Connection conn = ConnectionFactory.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {

            preencherStatement(stmt, conta);
            stmt.executeUpdate();

            try (ResultSet rs = stmt.getGeneratedKeys()) {
                if (rs.next()) {
                    long idGerado = rs.getLong(1);
                    return new Conta(
                        idGerado,
                        conta.idEmpresa(),
                        conta.nomeEmpresa(),
                        conta.idCategoria(),
                        conta.nomeCategoria(),
                        conta.idFormaPagamento(),
                        conta.tipoFormaPagamento(),
                        conta.idPagador(),
                        conta.nomePagador(),
                        conta.idNota(),
                        conta.dataVencimento(),
                        conta.valorTotal(),
                        conta.statusPagamento(),
                        conta.naPasta(),
                        conta.numeroDocumento(),
                        conta.observacoes(),
                        conta.recorrente()
                    );
                }
            }
            return conta;
        } catch (SQLException e) {
            throw new RuntimeException("Erro ao salvar conta: " + e.getMessage(), e);
        }
    }

    /**
     * Dá baixa rápida na conta criando o registro de Pagamento e gravando na Auditoria
     * de forma atômica (ACID).
     */
    public void darBaixaAtomiaca(Long idConta, Long idBanco, String operador) {
        String sqlAtualizaConta = "UPDATE contas_a_pagar SET status_pagamento = 'PAGO' WHERE id_conta = ?";
        String sqlPagamento = """
            INSERT INTO pagamentos (id_conta, id_pagador, id_banco, data_pagamento, valor_pago)
            SELECT id_conta, id_pagador, ?, date('now'), valor_total FROM contas_a_pagar WHERE id_conta = ?
        """;
        String sqlAuditoria = """
            INSERT INTO auditoria_operacoes (operador, tipo_acao, entidade, registro_id, detalhes_json)
            VALUES (?, 'BAIXA_RAPIDA', 'contas_a_pagar', ?, '{"status": "PAGO"}')
        """;

        try (Connection conn = ConnectionFactory.getConnection()) {
            conn.setAutoCommit(false); // Inicia transação atômica

            try {
                // 1. Atualiza status da conta
                try (PreparedStatement stmt = conn.prepareStatement(sqlAtualizaConta)) {
                    stmt.setLong(1, idConta);
                    stmt.executeUpdate();
                }

                // 2. Insere na tabela de pagamentos
                try (PreparedStatement stmt = conn.prepareStatement(sqlPagamento)) {
                    stmt.setLong(1, idBanco != null ? idBanco : 1L);
                    stmt.setLong(2, idConta);
                    stmt.executeUpdate();
                }

                // 3. Insere na trilha de auditoria
                try (PreparedStatement stmt = conn.prepareStatement(sqlAuditoria)) {
                    stmt.setString(1, operador != null ? operador : "LIVIA METIDIERI");
                    stmt.setLong(2, idConta);
                    stmt.executeUpdate();
                }

                conn.commit(); // Efetiva tudo junto!
            } catch (SQLException e) {
                conn.rollback(); // Reverte tudo em caso de falha
                throw new RuntimeException("Falha ao efetuar baixa atômica na conta ID " + idConta, e);
            } finally {
                conn.setAutoCommit(true);
            }
        } catch (SQLException e) {
            throw new RuntimeException("Erro de conexão no banco de dados: " + e.getMessage(), e);
        }
    }

    public List<Conta> listarTodas() {
        return consultar(sqlBaseSelect() + " ORDER BY c.data_vencimento ASC");
    }

    public List<Conta> listarPendentes() {
        return consultar(sqlBaseSelect() + " WHERE c.status_pagamento != 'PAGO' ORDER BY c.data_vencimento ASC");
    }

    public List<Conta> listarPagas() {
        return consultar(sqlBaseSelect() + " WHERE c.status_pagamento = 'PAGO' ORDER BY c.data_vencimento DESC");
    }

    public void excluirPendentesDeFornecedor(String nomeOuCnpj) {
        String sql = """
            DELETE FROM contas_a_pagar 
            WHERE status_pagamento != 'PAGO' 
              AND id_empresa IN (SELECT id_empresa FROM empresas WHERE razao_social LIKE ? OR cnpj = ?)
        """;
        try (Connection conn = ConnectionFactory.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {

            stmt.setString(1, "%" + nomeOuCnpj + "%");
            stmt.setString(2, nomeOuCnpj);
            stmt.executeUpdate();

        } catch (SQLException e) {
            throw new RuntimeException("Erro ao excluir pendências do fornecedor: " + nomeOuCnpj, e);
        }
    }

    private String sqlBaseSelect() {
        return """
            SELECT 
                c.id_conta, c.id_empresa, coalesce(e.razao_social, 'Fornecedor Avulso') AS nome_empresa,
                c.id_categoria, coalesce(cat.nome_categoria, 'Geral') AS nome_categoria,
                c.id_forma_pagamento, coalesce(f.tipo_pagamento, 'Boleto') AS tipo_forma,
                c.id_pagador, coalesce(p.nome, 'LIVIA METIDIERI') AS nome_pagador,
                c.id_nota, c.data_vencimento, c.valor_total, c.status_pagamento,
                c.na_pasta, c.numero_documento, c.observacoes, c.recorrente
            FROM contas_a_pagar c
            LEFT JOIN empresas e ON c.id_empresa = e.id_empresa
            LEFT JOIN categorias cat ON c.id_categoria = cat.id_categoria
            LEFT JOIN formas_pagamento f ON c.id_forma_pagamento = f.id_forma
            LEFT JOIN pagadores p ON c.id_pagador = p.id_pagador
        """;
    }

    private List<Conta> consultar(String sql) {
        List<Conta> lista = new ArrayList<>();
        try (Connection conn = ConnectionFactory.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql);
             ResultSet rs = stmt.executeQuery()) {

            while (rs.next()) {
                lista.add(converterLinha(rs));
            }
            return lista;

        } catch (SQLException e) {
            throw new RuntimeException("Erro ao consultar contas a pagar: " + e.getMessage(), e);
        }
    }

    private Conta converterLinha(ResultSet rs) throws SQLException {
        String dataVencStr = rs.getString("data_vencimento");

        return new Conta(
            rs.getLong("id_conta"),
            rs.getLong("id_empresa"),
            rs.getString("nome_empresa"),
            rs.getLong("id_categoria"),
            rs.getString("nome_categoria"),
            rs.getLong("id_forma_pagamento"),
            rs.getString("tipo_forma"),
            rs.getLong("id_pagador"),
            rs.getString("nome_pagador"),
            rs.getObject("id_nota") != null ? rs.getLong("id_nota") : null,
            dataVencStr != null ? LocalDate.parse(dataVencStr) : null,
            rs.getDouble("valor_total"),
            StatusConta.fromString(rs.getString("status_pagamento")),
            rs.getInt("na_pasta") == 1,
            rs.getString("numero_documento"),
            rs.getString("observacoes"),
            rs.getInt("recorrente") == 1
        );
    }

    private void preencherStatement(PreparedStatement stmt, Conta c) throws SQLException {
        stmt.setLong(1, c.idEmpresa() != null ? c.idEmpresa() : 1L);
        stmt.setLong(2, c.idCategoria() != null ? c.idCategoria() : 1L);
        stmt.setLong(3, c.idFormaPagamento() != null ? c.idFormaPagamento() : 1L);
        stmt.setLong(4, c.idPagador() != null ? c.idPagador() : 1L);
        if (c.idNota() != null) {
            stmt.setLong(5, c.idNota());
        } else {
            stmt.setNull(5, Types.INTEGER);
        }
        stmt.setString(6, c.dataVencimento() != null ? c.dataVencimento().toString() : null);
        stmt.setDouble(7, c.valorTotal());
        stmt.setString(8, c.statusPagamento() != null ? c.statusPagamento().name() : StatusConta.PENDENTE.name());
        stmt.setInt(9, c.naPasta() ? 1 : 0);
        stmt.setString(10, c.numeroDocumento());
        stmt.setString(11, c.observacoes());
        stmt.setInt(12, c.recorrente() ? 1 : 0);
    }
}
