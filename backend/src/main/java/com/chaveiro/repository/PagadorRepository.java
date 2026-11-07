package com.chaveiro.repository;

import com.chaveiro.database.ConnectionFactory;
import com.chaveiro.model.Pagador;
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
 * Operacoes SQL da tabela pagadores. Somente PreparedStatements parametrizados.
 */
@Repository
public class PagadorRepository {

    private static final Logger log = LoggerFactory.getLogger(PagadorRepository.class);

    private final ConnectionFactory conexao;

    public PagadorRepository(ConnectionFactory conexao) {
        this.conexao = conexao;
    }

    public List<Pagador> listar() throws SQLException {
        String sql = "SELECT id_pagador, nome, cpf, funcao FROM pagadores ORDER BY nome";
        try (Connection conn = conexao.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql);
             ResultSet rs = stmt.executeQuery()) {
            List<Pagador> pagadores = new ArrayList<>();
            while (rs.next()) {
                pagadores.add(paraRegistro(rs));
            }
            return pagadores;
        }
    }

    public Optional<Pagador> buscarPorId(long id) throws SQLException {
        String sql = "SELECT id_pagador, nome, cpf, funcao FROM pagadores WHERE id_pagador = ?";
        try (Connection conn = conexao.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setLong(1, id);
            try (ResultSet rs = stmt.executeQuery()) {
                return rs.next() ? Optional.of(paraRegistro(rs)) : Optional.empty();
            }
        }
    }

    public Pagador inserir(Pagador dados) throws SQLException {
        String sql = "INSERT INTO pagadores (nome, cpf, funcao) VALUES (?, ?, ?)";
        try (Connection conn = conexao.getConnection()) {
            conn.setAutoCommit(false);
            try (PreparedStatement stmt = conn.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
                preencher(stmt, dados);
                stmt.executeUpdate();
                long id;
                try (ResultSet chaves = stmt.getGeneratedKeys()) {
                    if (!chaves.next()) {
                        throw new SQLException("falha ao obter o id do pagador inserido");
                    }
                    id = chaves.getLong(1);
                }
                conn.commit();
                log.info("pagador cadastrado (id={})", id);
                return new Pagador(id, dados.nome(), dados.cpf(), dados.funcao());
            } catch (SQLException erro) {
                conn.rollback();
                throw erro;
            } finally {
                conn.setAutoCommit(true);
            }
        }
    }

    public boolean atualizar(long id, Pagador dados) throws SQLException {
        String sql = "UPDATE pagadores SET nome = ?, cpf = ?, funcao = ? WHERE id_pagador = ?";
        try (Connection conn = conexao.getConnection()) {
            conn.setAutoCommit(false);
            try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                preencher(stmt, dados);
                stmt.setLong(4, id);
                int linhas = stmt.executeUpdate();
                conn.commit();
                if (linhas > 0) {
                    log.info("pagador atualizado (id={})", id);
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
        String sql = "DELETE FROM pagadores WHERE id_pagador = ?";
        try (Connection conn = conexao.getConnection()) {
            conn.setAutoCommit(false);
            try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                stmt.setLong(1, id);
                int linhas = stmt.executeUpdate();
                conn.commit();
                if (linhas > 0) {
                    log.info("pagador excluido (id={})", id);
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

    private static void preencher(PreparedStatement stmt, Pagador dados) throws SQLException {
        stmt.setString(1, dados.nome());
        stmt.setString(2, dados.cpf());
        stmt.setString(3, dados.funcao());
    }

    private static Pagador paraRegistro(ResultSet rs) throws SQLException {
        return new Pagador(
                rs.getLong("id_pagador"),
                rs.getString("nome"),
                rs.getString("cpf"),
                rs.getString("funcao")
        );
    }
}
