package com.chaveiro.repository;

import com.chaveiro.database.ConnectionFactory;
import com.chaveiro.model.Banco;
import com.chaveiro.service.ConflitoIntegridadeException;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Repository;

/**
 * Operacoes SQL da tabela bancos. Somente PreparedStatements parametrizados.
 */
@Repository
public class BancoRepository {

    private static final Logger log = LoggerFactory.getLogger(BancoRepository.class);

    private final ConnectionFactory conexao;

    public BancoRepository(ConnectionFactory conexao) {
        this.conexao = conexao;
    }

    public List<Banco> listar() throws SQLException {
        String sql = "SELECT id_banco, instituicao, chave_pix"
                + " FROM bancos ORDER BY instituicao";
        try (Connection conn = conexao.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql);
             ResultSet rs = stmt.executeQuery()) {
            List<Banco> bancos = new ArrayList<>();
            while (rs.next()) {
                bancos.add(paraRegistro(rs));
            }
            return bancos;
        }
    }

    public Optional<Banco> buscarPorId(long id) throws SQLException {
        String sql = "SELECT id_banco, instituicao, chave_pix"
                + " FROM bancos WHERE id_banco = ?";
        try (Connection conn = conexao.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setLong(1, id);
            try (ResultSet rs = stmt.executeQuery()) {
                return rs.next() ? Optional.of(paraRegistro(rs)) : Optional.empty();
            }
        }
    }

    public Banco inserir(Banco dados) throws SQLException {
        String sql = "INSERT INTO bancos (instituicao, chave_pix)"
                + " VALUES (?, ?)";
        try (Connection conn = conexao.getConnection()) {
            conn.setAutoCommit(false);
            try (PreparedStatement stmt = conn.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
                preencher(stmt, dados);
                stmt.executeUpdate();
                long id;
                try (ResultSet chaves = stmt.getGeneratedKeys()) {
                    if (!chaves.next()) {
                        throw new SQLException("falha ao obter o id do banco inserido");
                    }
                    id = chaves.getLong(1);
                }
                conn.commit();
                log.info("banco cadastrado (id={})", id);
                return new Banco(id, dados.instituicao(), dados.chavePix());
            } catch (SQLException erro) {
                conn.rollback();
                throw erro;
            } finally {
                conn.setAutoCommit(true);
            }
        }
    }

    public boolean atualizar(long id, Banco dados) throws SQLException {
        String sql = "UPDATE bancos SET instituicao = ?, chave_pix = ?"
                + " WHERE id_banco = ?";
        try (Connection conn = conexao.getConnection()) {
            conn.setAutoCommit(false);
            try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                preencher(stmt, dados);
                stmt.setLong(3, id);
                int linhas = stmt.executeUpdate();
                conn.commit();
                if (linhas > 0) {
                    log.info("banco atualizado (id={})", id);
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

    public boolean excluir(long id) throws SQLException {
        String sql = "DELETE FROM bancos WHERE id_banco = ?";
        try (Connection conn = conexao.getConnection()) {
            conn.setAutoCommit(false);
            try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                stmt.setLong(1, id);
                int linhas = stmt.executeUpdate();
                conn.commit();
                if (linhas > 0) {
                    log.info("banco excluido (id={})", id);
                }
                return linhas > 0;
            } catch (SQLException erro) {
                conn.rollback();
                int codigo = erro.getErrorCode();
                boolean violacaoDeForeignKey = (codigo == 19 || codigo == 787)
                        && erro.getMessage() != null
                        && erro.getMessage().toLowerCase().contains("foreign key");
                if (violacaoDeForeignKey) {
                    throw new ConflitoIntegridadeException("banco vinculado a registros financeiros");
                }
                throw erro;
            } finally {
                conn.setAutoCommit(true);
            }
        }
    }

    private static void preencher(PreparedStatement stmt, Banco dados) throws SQLException {
        stmt.setString(1, dados.instituicao());
        stmt.setString(2, dados.chavePix());
    }

    private static Banco paraRegistro(ResultSet rs) throws SQLException {
        return new Banco(
                rs.getLong("id_banco"),
                rs.getString("instituicao"),
                rs.getString("chave_pix")
        );
    }
}
