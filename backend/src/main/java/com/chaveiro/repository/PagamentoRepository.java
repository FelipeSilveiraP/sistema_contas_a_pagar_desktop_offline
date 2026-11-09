package com.chaveiro.repository;

import com.chaveiro.database.ConnectionFactory;
import com.chaveiro.model.Pagamento;
import java.math.BigDecimal;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.sql.Types;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Repository;

/**
 * Pagamentos: baixa e estorno sao OPERACOES ATOMICAS (pagamento + status da
 * conta na mesma transacao SQLite) para impedir inconsistencias financeiras.
 */
@Repository
public class PagamentoRepository {

    private static final Logger log = LoggerFactory.getLogger(PagamentoRepository.class);

    private static final String COLUNAS = """
            p.id_pagamento, p.id_conta, p.data_pagamento, p.valor_pago_centavos,
            p.id_banco, b.instituicao, c.nome_empresa, c.status
            FROM pagamentos p
            JOIN contas_a_pagar c ON c.id_conta = p.id_conta
            LEFT JOIN bancos b ON b.id_banco = p.id_banco
            """;

    private final ConnectionFactory conexao;

    public PagamentoRepository(ConnectionFactory conexao) {
        this.conexao = conexao;
    }

    /** Baixa atomica: grava o pagamento e marca a conta como PAGO. */
    public Pagamento registrar(long idConta, Pagamento dados) throws SQLException {
        String inserir = "INSERT INTO pagamentos (id_conta, data_pagamento, valor_pago_centavos, id_banco)"
                + " VALUES (?, ?, ?, ?)";
        String marcar = "UPDATE contas_a_pagar SET status = 'PAGO' WHERE id_conta = ?";
        try (Connection conn = conexao.getConnection()) {
            conn.setAutoCommit(false);
            try (PreparedStatement stmt = conn.prepareStatement(inserir, Statement.RETURN_GENERATED_KEYS)) {
                stmt.setLong(1, idConta);
                stmt.setString(2, dados.dataPagamento().toString());
                stmt.setLong(3, dados.valorPago().movePointRight(2).longValueExact());
                if (dados.idBanco() == null) {
                    stmt.setNull(4, Types.INTEGER);
                } else {
                    stmt.setLong(4, dados.idBanco());
                }
                stmt.executeUpdate();
                long id;
                try (ResultSet chaves = stmt.getGeneratedKeys()) {
                    if (!chaves.next()) {
                        throw new SQLException("falha ao obter o id do pagamento");
                    }
                    id = chaves.getLong(1);
                }
                try (PreparedStatement upd = conn.prepareStatement(marcar)) {
                    upd.setLong(1, idConta);
                    upd.executeUpdate();
                }
                conn.commit();
                log.info("pagamento registrado (id={}, conta={})", id, idConta);
                return new Pagamento(id, idConta, dados.dataPagamento(), dados.valorPago(),
                        dados.idBanco(), dados.instituicaoBanco(), null, "PAGO");
            } catch (SQLException erro) {
                conn.rollback();
                throw erro;
            } finally {
                conn.setAutoCommit(true);
            }
        }
    }

    /** Estorno atomico: remove o pagamento e retorna a conta para PENDENTE. */
    public boolean estornar(long idConta) throws SQLException {
        String remover = "DELETE FROM pagamentos WHERE id_conta = ?";
        String marcar = "UPDATE contas_a_pagar SET status = 'PENDENTE' WHERE id_conta = ?";
        try (Connection conn = conexao.getConnection()) {
            conn.setAutoCommit(false);
            try (PreparedStatement stmt = conn.prepareStatement(remover)) {
                stmt.setLong(1, idConta);
                int linhas = stmt.executeUpdate();
                if (linhas > 0) {
                    try (PreparedStatement upd = conn.prepareStatement(marcar)) {
                        upd.setLong(1, idConta);
                        upd.executeUpdate();
                    }
                    log.info("pagamento estornado (conta={})", idConta);
                }
                conn.commit();
                return linhas > 0;
            } catch (SQLException erro) {
                conn.rollback();
                throw erro;
            } finally {
                conn.setAutoCommit(true);
            }
        }
    }

    public Optional<Pagamento> buscarPorConta(long idConta) throws SQLException {
        String sql = "SELECT " + COLUNAS + " WHERE p.id_conta = ?";
        try (Connection conn = conexao.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setLong(1, idConta);
            try (ResultSet rs = stmt.executeQuery()) {
                return rs.next() ? Optional.of(paraRegistro(rs)) : Optional.empty();
            }
        }
    }

    public Optional<Pagamento> buscarPorId(long id) throws SQLException {
        String sql = "SELECT " + COLUNAS + " WHERE p.id_pagamento = ?";
        try (Connection conn = conexao.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setLong(1, id);
            try (ResultSet rs = stmt.executeQuery()) {
                return rs.next() ? Optional.of(paraRegistro(rs)) : Optional.empty();
            }
        }
    }

    public List<Pagamento> listar() throws SQLException {
        String sql = "SELECT " + COLUNAS + " ORDER BY p.data_pagamento DESC, p.id_pagamento DESC";
        try (Connection conn = conexao.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql);
             ResultSet rs = stmt.executeQuery()) {
            List<Pagamento> pagamentos = new ArrayList<>();
            while (rs.next()) {
                pagamentos.add(paraRegistro(rs));
            }
            return pagamentos;
        }
    }

    public boolean atualizar(long id, Pagamento dados) throws SQLException {
        String sql = "UPDATE pagamentos SET data_pagamento = ?, valor_pago_centavos = ?, id_banco = ?"
                + " WHERE id_pagamento = ?";
        try (Connection conn = conexao.getConnection()) {
            conn.setAutoCommit(false);
            try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                stmt.setString(1, dados.dataPagamento().toString());
                stmt.setLong(2, dados.valorPago().movePointRight(2).longValueExact());
                if (dados.idBanco() == null) {
                    stmt.setNull(3, Types.INTEGER);
                } else {
                    stmt.setLong(3, dados.idBanco());
                }
                stmt.setLong(4, id);
                int linhas = stmt.executeUpdate();
                conn.commit();
                if (linhas > 0) {
                    log.info("pagamento atualizado (id={})", id);
                }
                return linhas > 0;
            } catch (SQLException erro) {
                conn.rollback();
                throw erro;
            } finally {
                conn.setAutoCommit(true);
            }
        }
    }

    private static Pagamento paraRegistro(ResultSet rs) throws SQLException {
        long centavos = rs.getLong("valor_pago_centavos");
        long idBancoBruto = rs.getLong("id_banco");
        Long idBanco = rs.wasNull() ? null : idBancoBruto;
        return new Pagamento(
                rs.getLong("id_pagamento"),
                rs.getLong("id_conta"),
                java.sql.Date.valueOf(rs.getString("data_pagamento")).toLocalDate(),
                BigDecimal.valueOf(centavos, 2),
                idBanco,
                rs.getString("instituicao"),
                rs.getString("nome_empresa"),
                rs.getString("status")
        );
    }
}
