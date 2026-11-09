package com.chaveiro.repository;

import com.chaveiro.database.ConnectionFactory;
import com.chaveiro.model.Aviso;
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

/** Operacoes SQL de avisos. PreparedStatements parametrizados. */
@Repository
public class AvisoRepository {

    private static final Logger log = LoggerFactory.getLogger(AvisoRepository.class);

    private final ConnectionFactory conexao;

    public AvisoRepository(ConnectionFactory conexao) {
        this.conexao = conexao;
    }

    public List<Aviso> listar() throws SQLException {
        String sql = "SELECT id_aviso, data_inicio, data_fim, dia_semana, titulo, mensagem"
                + " FROM avisos ORDER BY data_inicio, id_aviso";
        try (Connection conn = conexao.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql);
             ResultSet rs = stmt.executeQuery()) {
            List<Aviso> lista = new ArrayList<>();
            while (rs.next()) {
                lista.add(paraRegistro(rs));
            }
            return lista;
        }
    }

    public Optional<Aviso> buscarPorId(long id) throws SQLException {
        String sql = "SELECT id_aviso, data_inicio, data_fim, dia_semana, titulo, mensagem"
                + " FROM avisos WHERE id_aviso = ?";
        try (Connection conn = conexao.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setLong(1, id);
            try (ResultSet rs = stmt.executeQuery()) {
                return rs.next() ? Optional.of(paraRegistro(rs)) : Optional.empty();
            }
        }
    }

    public Aviso inserir(Aviso dados) throws SQLException {
        String sql = "INSERT INTO avisos (data_inicio, data_fim, dia_semana, titulo, mensagem)"
                + " VALUES (?, ?, ?, ?, ?)";
        try (Connection conn = conexao.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
            preencher(stmt, dados);
            stmt.executeUpdate();
            try (ResultSet chaves = stmt.getGeneratedKeys()) {
                if (!chaves.next()) {
                    throw new SQLException("falha ao obter o id do aviso");
                }
                return new Aviso(chaves.getLong(1), dados.dataInicio(), dados.dataFim(),
                        dados.diaSemana(), dados.titulo(), dados.mensagem());
            }
        }
    }

    public boolean atualizar(long id, Aviso dados) throws SQLException {
        String sql = "UPDATE avisos SET data_inicio = ?, data_fim = ?, dia_semana = ?,"
                + " titulo = ?, mensagem = ? WHERE id_aviso = ?";
        try (Connection conn = conexao.getConnection()) {
            conn.setAutoCommit(false);
            try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                preencher(stmt, dados);
                stmt.setLong(6, id);
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
        String sql = "DELETE FROM avisos WHERE id_aviso = ?";
        try (Connection conn = conexao.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setLong(1, id);
            return stmt.executeUpdate() > 0;
        }
    }

    private static void preencher(PreparedStatement stmt, Aviso dados) throws SQLException {
        stmt.setString(1, dados.dataInicio().toString());
        stmt.setString(2, dados.dataFim().toString());
        stmt.setString(3, dados.diaSemana());
        stmt.setString(4, dados.titulo());
        stmt.setString(5, dados.mensagem());
    }

    private static Aviso paraRegistro(ResultSet rs) throws SQLException {
        return new Aviso(
                rs.getLong("id_aviso"),
                java.sql.Date.valueOf(rs.getString("data_inicio")).toLocalDate(),
                java.sql.Date.valueOf(rs.getString("data_fim")).toLocalDate(),
                rs.getString("dia_semana"),
                rs.getString("titulo"),
                rs.getString("mensagem")
        );
    }
}
