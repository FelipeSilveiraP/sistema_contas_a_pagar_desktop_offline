package com.chaveiro.repository;

import com.chaveiro.database.ConnectionFactory;
import com.chaveiro.model.BoletoRecorrente;
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
 * Operacoes SQL de boletos_recorrentes. A exclusao remove APENAS contas
 * geradas ainda nao pagas (regra do sistema legado); pagas viram historico.
 */
@Repository
public class BoletoRecorrenteRepository {

    private static final Logger log = LoggerFactory.getLogger(BoletoRecorrenteRepository.class);

    private final ConnectionFactory conexao;

    public BoletoRecorrenteRepository(ConnectionFactory conexao) {
        this.conexao = conexao;
    }

    public List<BoletoRecorrente> listar() throws SQLException {
        String sql = "SELECT * FROM boletos_recorrentes ORDER BY nome_empresa, dia";
        try (Connection conn = conexao.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql);
             ResultSet rs = stmt.executeQuery()) {
            List<BoletoRecorrente> lista = new ArrayList<>();
            while (rs.next()) {
                lista.add(paraRegistro(rs));
            }
            return lista;
        }
    }

    public Optional<BoletoRecorrente> buscarPorId(long id) throws SQLException {
        String sql = "SELECT * FROM boletos_recorrentes WHERE id_recorrente = ?";
        try (Connection conn = conexao.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setLong(1, id);
            try (ResultSet rs = stmt.executeQuery()) {
                return rs.next() ? Optional.of(paraRegistro(rs)) : Optional.empty();
            }
        }
    }

    public BoletoRecorrente inserir(BoletoRecorrente dados) throws SQLException {
        String sql = "INSERT INTO boletos_recorrentes (nome_empresa, id_empresa, pagador_responsavel,"
                + " categoria, numero_documento, valor_centavos, dia, periodicidade, forma_pagamento, ativo)"
                + " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        try (Connection conn = conexao.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
            preencher(stmt, dados);
            stmt.executeUpdate();
            try (ResultSet chaves = stmt.getGeneratedKeys()) {
                if (!chaves.next()) {
                    throw new SQLException("falha ao obter o id do recorrente");
                }
                return new BoletoRecorrente(chaves.getLong(1), dados.nomeEmpresa(), dados.idEmpresa(),
                        dados.pagadorResponsavel(), dados.categoria(), dados.numeroDocumento(),
                        dados.valor(), dados.dia(), dados.periodicidade(), dados.formaPagamento(),
                        dados.ativo());
            }
        }
    }

    public boolean atualizar(long id, BoletoRecorrente dados) throws SQLException {
        String sql = "UPDATE boletos_recorrentes SET nome_empresa = ?, id_empresa = ?,"
                + " pagador_responsavel = ?, categoria = ?, numero_documento = ?, valor_centavos = ?,"
                + " dia = ?, periodicidade = ?, forma_pagamento = ?, ativo = ? WHERE id_recorrente = ?";
        try (Connection conn = conexao.getConnection()) {
            conn.setAutoCommit(false);
            try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                preencher(stmt, dados);
                stmt.setLong(11, id);
                int linhas = stmt.executeUpdate();
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

    public boolean excluir(long id) throws SQLException {
        String removerContas = "DELETE FROM contas_a_pagar WHERE id_recorrente = ? AND status = 'PENDENTE'";
        String removerRecorrente = "DELETE FROM boletos_recorrentes WHERE id_recorrente = ?";
        try (Connection conn = conexao.getConnection()) {
            conn.setAutoCommit(false);
            try (PreparedStatement contas = conn.prepareStatement(removerContas);
                 PreparedStatement recorrente = conn.prepareStatement(removerRecorrente)) {
                contas.setLong(1, id);
                int removidas = contas.executeUpdate();
                recorrente.setLong(1, id);
                int linhas = recorrente.executeUpdate();
                conn.commit();
                if (linhas > 0) {
                    log.info("recorrente excluido (id={}), contas pendentes removidas={}", id, removidas);
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

    private static void preencher(PreparedStatement stmt, BoletoRecorrente dados) throws SQLException {
        stmt.setString(1, dados.nomeEmpresa());
        if (dados.idEmpresa() == null) {
            stmt.setNull(2, Types.INTEGER);
        } else {
            stmt.setLong(2, dados.idEmpresa());
        }
        stmt.setString(3, dados.pagadorResponsavel());
        stmt.setString(4, dados.categoria());
        stmt.setString(5, dados.numeroDocumento());
        stmt.setLong(6, dados.valor().movePointRight(2).longValueExact());
        stmt.setInt(7, dados.dia());
        stmt.setString(8, dados.periodicidade());
        stmt.setString(9, dados.formaPagamento());
        stmt.setInt(10, dados.ativo() ? 1 : 0);
    }

    private static BoletoRecorrente paraRegistro(ResultSet rs) throws SQLException {
        long centavos = rs.getLong("valor_centavos");
        long idEmpresaBruto = rs.getLong("id_empresa");
        Long idEmpresa = rs.wasNull() ? null : idEmpresaBruto;
        return new BoletoRecorrente(
                rs.getLong("id_recorrente"),
                rs.getString("nome_empresa"),
                idEmpresa,
                rs.getString("pagador_responsavel"),
                rs.getString("categoria"),
                rs.getString("numero_documento"),
                BigDecimal.valueOf(centavos, 2),
                rs.getInt("dia"),
                rs.getString("periodicidade"),
                rs.getString("forma_pagamento"),
                rs.getInt("ativo") == 1
        );
    }
}
