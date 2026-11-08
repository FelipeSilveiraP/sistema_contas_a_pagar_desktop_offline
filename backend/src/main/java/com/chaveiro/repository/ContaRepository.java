package com.chaveiro.repository;

import com.chaveiro.database.ConnectionFactory;
import com.chaveiro.model.Conta;
import com.chaveiro.service.ConflitoIntegridadeException;
import java.math.BigDecimal;
import java.sql.Connection;
import java.sql.Date;
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
 * Operacoes SQL da tabela contas_a_pagar. Somente PreparedStatements
 * parametrizados. Valor armazenado em centavos (inteiro) para precisao exata.
 */
@Repository
public class ContaRepository {

    private static final Logger log = LoggerFactory.getLogger(ContaRepository.class);

    private static final String COLUNAS = """
            c.id_conta, c.id_empresa, e.razao_social, c.id_pagador, p.nome AS nome_pagador,
            c.categoria, c.numero_documento, c.valor_centavos, c.vencimento,
            c.boleto_na_pasta, c.status
            FROM contas_a_pagar c
            JOIN empresas e ON e.id_empresa = c.id_empresa
            LEFT JOIN pagadores p ON p.id_pagador = c.id_pagador
            """;

    private final ConnectionFactory conexao;

    public ContaRepository(ConnectionFactory conexao) {
        this.conexao = conexao;
    }

    public List<Conta> listar(String status) throws SQLException {
        String sql = "SELECT " + COLUNAS
                + (status == null || status.isBlank()
                        ? " ORDER BY c.vencimento, c.id_conta"
                        : " WHERE c.status = ? ORDER BY c.vencimento, c.id_conta");
        try (Connection conn = conexao.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            if (status != null && !status.isBlank()) {
                stmt.setString(1, status);
            }
            try (ResultSet rs = stmt.executeQuery()) {
                List<Conta> contas = new ArrayList<>();
                while (rs.next()) {
                    contas.add(paraRegistro(rs));
                }
                return contas;
            }
        }
    }

    public Optional<Conta> buscarPorId(long id) throws SQLException {
        String sql = "SELECT " + COLUNAS + " WHERE c.id_conta = ?";
        try (Connection conn = conexao.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setLong(1, id);
            try (ResultSet rs = stmt.executeQuery()) {
                return rs.next() ? Optional.of(paraRegistro(rs)) : Optional.empty();
            }
        }
    }

    public Optional<String> buscarNomeEmpresa(long idEmpresa) throws SQLException {
        String sql = "SELECT razao_social FROM empresas WHERE id_empresa = ?";
        try (Connection conn = conexao.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setLong(1, idEmpresa);
            try (ResultSet rs = stmt.executeQuery()) {
                return rs.next() ? Optional.ofNullable(rs.getString(1)) : Optional.empty();
            }
        }
    }

    public Conta inserir(Conta dados) throws SQLException {
        String sql = "INSERT INTO contas_a_pagar"
                + " (id_empresa, id_pagador, categoria, numero_documento, valor_centavos,"
                + " vencimento, boleto_na_pasta, status)"
                + " VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
        try (Connection conn = conexao.getConnection()) {
            conn.setAutoCommit(false);
            try (PreparedStatement stmt = conn.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
                preencher(stmt, dados);
                stmt.executeUpdate();
                long id;
                try (ResultSet chaves = stmt.getGeneratedKeys()) {
                    if (!chaves.next()) {
                        throw new SQLException("falha ao obter o id da conta inserida");
                    }
                    id = chaves.getLong(1);
                }
                conn.commit();
                log.info("conta cadastrada (id={})", id);
                return new Conta(id, dados.idEmpresa(), dados.razaoSocial(), dados.idPagador(),
                        dados.nomePagador(), dados.categoria(), dados.numeroDocumento(),
                        dados.valor(), dados.vencimento(), dados.boletoNaPasta(), dados.status());
            } catch (SQLException erro) {
                conn.rollback();
                tratarForeignKey(erro, "empresa ou pagador inexistente");
                throw erro;
            } finally {
                conn.setAutoCommit(true);
            }
        }
    }

    public boolean atualizar(long id, Conta dados) throws SQLException {
        String sql = "UPDATE contas_a_pagar SET id_empresa = ?, id_pagador = ?, categoria = ?,"
                + " numero_documento = ?, valor_centavos = ?, vencimento = ?, boleto_na_pasta = ?"
                + " WHERE id_conta = ?";
        try (Connection conn = conexao.getConnection()) {
            conn.setAutoCommit(false);
            try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                preencher(stmt, dados);
                stmt.setLong(8, id);
                int linhas = stmt.executeUpdate();
                conn.commit();
                if (linhas > 0) {
                    log.info("conta atualizada (id={})", id);
                }
                return linhas > 0;
            } catch (SQLException erro) {
                conn.rollback();
                tratarForeignKey(erro, "empresa ou pagador inexistente");
                throw erro;
            } finally {
                conn.setAutoCommit(true);
            }
        }
    }

    public boolean excluir(long id) throws SQLException {
        String sql = "DELETE FROM contas_a_pagar WHERE id_conta = ?";
        try (Connection conn = conexao.getConnection()) {
            conn.setAutoCommit(false);
            try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                stmt.setLong(1, id);
                int linhas = stmt.executeUpdate();
                conn.commit();
                if (linhas > 0) {
                    log.info("conta excluida (id={})", id);
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

    private static void preencher(PreparedStatement stmt, Conta dados) throws SQLException {
        stmt.setLong(1, dados.idEmpresa());
        if (dados.idPagador() == null) {
            stmt.setNull(2, Types.INTEGER);
        } else {
            stmt.setLong(2, dados.idPagador());
        }
        stmt.setString(3, dados.categoria());
        stmt.setString(4, dados.numeroDocumento());
        stmt.setLong(5, dados.valor().movePointRight(2).longValueExact());
        stmt.setString(6, dados.vencimento().toString());
        stmt.setInt(7, dados.boletoNaPasta() ? 1 : 0);
        stmt.setString(8, dados.status());
    }

    private static Conta paraRegistro(ResultSet rs) throws SQLException {
        long centavos = rs.getLong("valor_centavos");
        long idPagadorBruto = rs.getLong("id_pagador");
        Long idPagador = rs.wasNull() ? null : idPagadorBruto;
        return new Conta(
                rs.getLong("id_conta"),
                rs.getLong("id_empresa"),
                rs.getString("razao_social"),
                idPagador,
                rs.getString("nome_pagador"),
                rs.getString("categoria"),
                rs.getString("numero_documento"),
                BigDecimal.valueOf(centavos, 2),
                Date.valueOf(rs.getString("vencimento")).toLocalDate(),
                rs.getInt("boleto_na_pasta") == 1,
                rs.getString("status")
        );
    }

    private static void tratarForeignKey(SQLException erro, String mensagem) throws SQLException {
        int codigo = erro.getErrorCode();
        boolean violacaoDeForeignKey = (codigo == 19 || codigo == 787)
                && erro.getMessage() != null
                && erro.getMessage().toLowerCase().contains("foreign key");
        if (violacaoDeForeignKey) {
            throw new ConflitoIntegridadeException(mensagem);
        }
        throw erro;
    }
}
