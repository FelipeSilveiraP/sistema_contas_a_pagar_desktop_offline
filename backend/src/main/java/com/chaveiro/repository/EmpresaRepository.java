package com.chaveiro.repository;

import com.chaveiro.database.ConnectionFactory;
import com.chaveiro.model.Empresa;
import com.chaveiro.model.Empresa.TelefoneEmpresa;
import com.chaveiro.service.ConflitoIntegridadeException;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Repository;

/**
 * Operacoes SQL de empresas + telefones (1FN). Transacoes explicitas;
 * somente PreparedStatements parametrizados.
 */
@Repository
public class EmpresaRepository {

    private static final Logger log = LoggerFactory.getLogger(EmpresaRepository.class);

    private final ConnectionFactory conexao;

    public EmpresaRepository(ConnectionFactory conexao) {
        this.conexao = conexao;
    }

    public List<Empresa> listar() throws SQLException {
        String sql = "SELECT e.id_empresa, e.cnpj, e.razao_social, e.nome_representante, e.email, e.logradouro,"
                + " t.numero, t.tipo FROM empresas e"
                + " LEFT JOIN telefones_empresa t ON t.id_empresa = e.id_empresa"
                + " ORDER BY e.razao_social, t.id_telefone";
        try (Connection conn = conexao.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql);
             ResultSet rs = stmt.executeQuery()) {
            Map<Long, Empresa> porId = new LinkedHashMap<>();
            while (rs.next()) {
                long id = rs.getLong("id_empresa");
                Empresa atual = porId.get(id);
                List<TelefoneEmpresa> telefones = new ArrayList<>();
                if (atual != null) {
                    telefones.addAll(atual.telefones());
                }
                String numero = rs.getString("numero");
                if (numero != null) {
                    telefones.add(new TelefoneEmpresa(numero, rs.getString("tipo")));
                }
                porId.put(id, new Empresa(id, rs.getString("cnpj"), rs.getString("razao_social"),
                        rs.getString("nome_representante"), rs.getString("email"),
                        rs.getString("logradouro"), telefones));
            }
            return new ArrayList<>(porId.values());
        }
    }

    public Optional<Empresa> buscarPorId(long id) throws SQLException {
        try (Connection conn = conexao.getConnection()) {
            return buscarPorId(conn, id);
        }
    }

    private static Optional<Empresa> buscarPorId(Connection conn, long id) throws SQLException {
        String sql = "SELECT cnpj, razao_social, nome_representante, email, logradouro"
                + " FROM empresas WHERE id_empresa = ?";
        try (PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setLong(1, id);
            try (ResultSet rs = stmt.executeQuery()) {
                if (!rs.next()) {
                    return Optional.empty();
                }
                return Optional.of(new Empresa(id, rs.getString("cnpj"), rs.getString("razao_social"),
                        rs.getString("nome_representante"), rs.getString("email"),
                        rs.getString("logradouro"), listarTelefones(conn, id)));
            }
        }
    }

    private static List<TelefoneEmpresa> listarTelefones(Connection conn, long idEmpresa) throws SQLException {
        String sql = "SELECT numero, tipo FROM telefones_empresa WHERE id_empresa = ? ORDER BY id_telefone";
        try (PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setLong(1, idEmpresa);
            try (ResultSet rs = stmt.executeQuery()) {
                List<TelefoneEmpresa> telefones = new ArrayList<>();
                while (rs.next()) {
                    telefones.add(new TelefoneEmpresa(rs.getString("numero"), rs.getString("tipo")));
                }
                return telefones;
            }
        }
    }

    public Empresa inserir(Empresa dados) throws SQLException {
        String sql = "INSERT INTO empresas (cnpj, razao_social, nome_representante, email, logradouro)"
                + " VALUES (?, ?, ?, ?, ?)";
        try (Connection conn = conexao.getConnection()) {
            conn.setAutoCommit(false);
            try (PreparedStatement stmt = conn.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
                preencherEmpresa(stmt, dados);
                stmt.executeUpdate();
                long id;
                try (ResultSet chaves = stmt.getGeneratedKeys()) {
                    if (!chaves.next()) {
                        throw new SQLException("falha ao obter o id da empresa inserida");
                    }
                    id = chaves.getLong(1);
                }
                inserirTelefones(conn, id, dados.telefones());
                conn.commit();
                log.info("empresa cadastrada (id={})", id);
                return buscarPorId(conn, id).orElseThrow();
            } catch (SQLException erro) {
                conn.rollback();
                throw erro;
            } finally {
                conn.setAutoCommit(true);
            }
        }
    }

    public boolean atualizar(long id, Empresa dados) throws SQLException {
        String sql = "UPDATE empresas SET cnpj = ?, razao_social = ?, nome_representante = ?, email = ?,"
                + " logradouro = ? WHERE id_empresa = ?";
        try (Connection conn = conexao.getConnection()) {
            conn.setAutoCommit(false);
            try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                preencherEmpresa(stmt, dados);
                stmt.setLong(6, id);
                int linhas = stmt.executeUpdate();
                if (linhas > 0) {
                    try (PreparedStatement apagar = conn.prepareStatement(
                            "DELETE FROM telefones_empresa WHERE id_empresa = ?")) {
                        apagar.setLong(1, id);
                        apagar.executeUpdate();
                    }
                    inserirTelefones(conn, id, dados.telefones());
                    log.info("empresa atualizada (id={})", id);
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

    public boolean excluir(long id) throws SQLException {
        String sql = "DELETE FROM empresas WHERE id_empresa = ?";
        try (Connection conn = conexao.getConnection()) {
            conn.setAutoCommit(false);
            try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                stmt.setLong(1, id);
                int linhas = stmt.executeUpdate();
                conn.commit();
                if (linhas > 0) {
                    log.info("empresa excluida (id={})", id);
                }
                return linhas > 0;
            } catch (SQLException erro) {
                conn.rollback();
                int codigo = erro.getErrorCode();
                boolean violacaoDeForeignKey = (codigo == 19 || codigo == 787)
                        && erro.getMessage() != null
                        && erro.getMessage().toLowerCase().contains("foreign key");
                if (violacaoDeForeignKey) {
                    throw new ConflitoIntegridadeException("empresa vinculada a contas a pagar");
                }
                throw erro;
            } finally {
                conn.setAutoCommit(true);
            }
        }
    }

    private static void preencherEmpresa(PreparedStatement stmt, Empresa dados) throws SQLException {
        stmt.setString(1, dados.cnpj());
        stmt.setString(2, dados.razaoSocial());
        stmt.setString(3, dados.nomeRepresentante());
        stmt.setString(4, dados.email());
        stmt.setString(5, dados.logradouro());
    }

    private static void inserirTelefones(Connection conn, long idEmpresa, List<TelefoneEmpresa> telefones)
            throws SQLException {
        String sql = "INSERT INTO telefones_empresa (id_empresa, numero, tipo) VALUES (?, ?, ?)";
        try (PreparedStatement stmt = conn.prepareStatement(sql)) {
            for (TelefoneEmpresa telefone : telefones) {
                stmt.setLong(1, idEmpresa);
                stmt.setString(2, telefone.numero());
                stmt.setString(3, telefone.tipo());
                stmt.executeUpdate();
            }
        }
    }
}
