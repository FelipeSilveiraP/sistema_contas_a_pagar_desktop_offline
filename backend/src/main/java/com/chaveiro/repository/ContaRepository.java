package com.chaveiro.repository;

import com.chaveiro.database.ConnectionFactory;
import com.chaveiro.model.Conta;
import com.chaveiro.service.ConflitoIntegridadeException;
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
 * Operacoes SQL da tabela contas_a_pagar. Somente PreparedStatements
 * parametrizados. Valor armazenado em centavos (inteiro) para precisao exata.
 * O PDF anexado vive em coluna BLOB (sobrevive a backup VACUUM INTO).
 */
@Repository
public class ContaRepository {

    private static final Logger log = LoggerFactory.getLogger(ContaRepository.class);

    private static final String COLUNAS = """
            c.id_conta, c.nome_empresa, c.id_empresa, e.razao_social, c.pagador_responsavel,
            c.tipo_pessoa, c.forma_pagamento, c.categoria, c.numero_documento,
            c.valor_centavos, c.vencimento, c.boleto_na_pasta, c.anexo_nome, c.status
            FROM contas_a_pagar c
            LEFT JOIN empresas e ON e.id_empresa = c.id_empresa
            """;

    private final ConnectionFactory conexao;

    public ContaRepository(ConnectionFactory conexao) {
        this.conexao = conexao;
    }

    public List<Conta> listar(String status) throws SQLException {
        return listar(status, false);
    }

    /** fixas=true: apenas contas geradas por recorrencia (id_recorrente preenchido). */
    public List<Conta> listar(String status, boolean fixas) throws SQLException {
        String condicoes = " WHERE " + (status == null || status.isBlank() ? "1=1" : "c.status = ?");
        if (fixas) {
            condicoes += " AND c.id_recorrente IS NOT NULL";
        }
        String sql = "SELECT " + COLUNAS + condicoes + " ORDER BY c.vencimento, c.id_conta";
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

    public Conta inserir(Conta dados, byte[] anexoPdf) throws SQLException {
        String sql = "INSERT INTO contas_a_pagar"
                + " (nome_empresa, id_empresa, pagador_responsavel, tipo_pessoa, forma_pagamento,"
                + " categoria, numero_documento, valor_centavos, vencimento, boleto_na_pasta,"
                + " anexo_nome, anexo_pdf, status)"
                + " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        try (Connection conn = conexao.getConnection()) {
            conn.setAutoCommit(false);
            try (PreparedStatement stmt = conn.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
                preencher(stmt, dados, anexoPdf);
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
                return new Conta(id, dados.nomeEmpresa(), dados.idEmpresa(), dados.razaoSocial(),
                        dados.pagadorResponsavel(), dados.tipoPessoa(), dados.formaPagamento(),
                        dados.categoria(), dados.numeroDocumento(), dados.valor(), dados.vencimento(),
                        dados.boletoNaPasta(), dados.anexoNome(), dados.status());
            } catch (SQLException erro) {
                conn.rollback();
                tratarForeignKey(erro, "empresa emissora inexistente");
                throw erro;
            } finally {
                conn.setAutoCommit(true);
            }
        }
    }

    /** Insercao de conta gerada por recorrencia (marca o vinculo id_recorrente). */
    public Conta inserirDeRecorrencia(Conta dados, long idRecorrente) throws SQLException {
        String sql = "INSERT INTO contas_a_pagar"
                + " (nome_empresa, id_empresa, pagador_responsavel, tipo_pessoa, forma_pagamento,"
                + " categoria, numero_documento, valor_centavos, vencimento, boleto_na_pasta,"
                + " anexo_nome, anexo_pdf, status, id_recorrente)"
                + " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        try (Connection conn = conexao.getConnection()) {
            conn.setAutoCommit(false);
            try (PreparedStatement stmt = conn.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
                preencher(stmt, dados, null);
                stmt.setLong(14, idRecorrente);
                stmt.executeUpdate();
                long id;
                try (ResultSet chaves = stmt.getGeneratedKeys()) {
                    if (!chaves.next()) {
                        throw new SQLException("falha ao obter o id da conta inserida");
                    }
                    id = chaves.getLong(1);
                }
                conn.commit();
                log.info("conta recorrente gerada (id={}, recorrente={})", id, idRecorrente);
                return new Conta(id, dados.nomeEmpresa(), dados.idEmpresa(), dados.razaoSocial(),
                        dados.pagadorResponsavel(), dados.tipoPessoa(), dados.formaPagamento(),
                        dados.categoria(), dados.numeroDocumento(), dados.valor(), dados.vencimento(),
                        dados.boletoNaPasta(), dados.anexoNome(), dados.status());
            } catch (SQLException erro) {
                conn.rollback();
                throw erro;
            } finally {
                conn.setAutoCommit(true);
            }
        }
    }

    /**
     * Atualiza os dados da conta. O anexo so e substituido quando um novo PDF
     * e informado (anexoPdf != null); caso contrario o existente e preservado.
     */
    public boolean atualizar(long id, Conta dados, byte[] anexoPdf) throws SQLException {
        boolean trocarAnexo = anexoPdf != null;
        String sql = "UPDATE contas_a_pagar SET nome_empresa = ?, id_empresa = ?,"
                + " pagador_responsavel = ?, tipo_pessoa = ?, forma_pagamento = ?, categoria = ?,"
                + " numero_documento = ?, valor_centavos = ?, vencimento = ?, boleto_na_pasta = ?"
                + (trocarAnexo ? ", anexo_nome = ?, anexo_pdf = ?" : "")
                + " WHERE id_conta = ?";
        try (Connection conn = conexao.getConnection()) {
            conn.setAutoCommit(false);
            try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                int pos = preencherComuns(stmt, dados);
                if (trocarAnexo) {
                    stmt.setString(pos++, dados.anexoNome());
                    stmt.setBytes(pos++, anexoPdf);
                }
                stmt.setLong(pos, id);
                int linhas = stmt.executeUpdate();
                conn.commit();
                if (linhas > 0) {
                    log.info("conta atualizada (id={})", id);
                }
                return linhas > 0;
            } catch (SQLException erro) {
                conn.rollback();
                tratarForeignKey(erro, "empresa emissora inexistente");
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

    public Optional<byte[]> buscarAnexoPdf(long id) throws SQLException {
        String sql = "SELECT anexo_pdf FROM contas_a_pagar WHERE id_conta = ?";
        try (Connection conn = conexao.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setLong(1, id);
            try (ResultSet rs = stmt.executeQuery()) {
                if (!rs.next()) {
                    return Optional.empty();
                }
                return Optional.ofNullable(rs.getBytes("anexo_pdf"));
            }
        }
    }

    /** Preenche os 10 campos comuns (INSERT e UPDATE); retorna a proxima posicao. */
    private static int preencherComuns(PreparedStatement stmt, Conta dados) throws SQLException {
        int p = 1;
        stmt.setString(p++, dados.nomeEmpresa());
        if (dados.idEmpresa() == null) {
            stmt.setNull(p++, Types.INTEGER);
        } else {
            stmt.setLong(p++, dados.idEmpresa());
        }
        stmt.setString(p++, dados.pagadorResponsavel());
        stmt.setString(p++, dados.tipoPessoa());
        stmt.setString(p++, dados.formaPagamento());
        stmt.setString(p++, dados.categoria());
        stmt.setString(p++, dados.numeroDocumento());
        stmt.setLong(p++, dados.valor().movePointRight(2).longValueExact());
        stmt.setString(p++, dados.vencimento().toString());
        stmt.setInt(p++, dados.boletoNaPasta() ? 1 : 0);
        return p;
    }

    private static void preencher(PreparedStatement stmt, Conta dados, byte[] anexoPdf) throws SQLException {
        int p = preencherComuns(stmt, dados);
        stmt.setString(p++, dados.anexoNome());
        if (anexoPdf == null) {
            stmt.setNull(p, Types.BLOB);
        } else {
            stmt.setBytes(p, anexoPdf);
        }
        stmt.setString(p + 1, dados.status());
    }

    private static Conta paraRegistro(ResultSet rs) throws SQLException {
        long centavos = rs.getLong("valor_centavos");
        long idEmpresaBruto = rs.getLong("id_empresa");
        Long idEmpresa = rs.wasNull() ? null : idEmpresaBruto;
        return new Conta(
                rs.getLong("id_conta"),
                rs.getString("nome_empresa"),
                idEmpresa,
                rs.getString("razao_social"),
                rs.getString("pagador_responsavel"),
                rs.getString("tipo_pessoa"),
                rs.getString("forma_pagamento"),
                rs.getString("categoria"),
                rs.getString("numero_documento"),
                BigDecimal.valueOf(centavos, 2),
                java.sql.Date.valueOf(rs.getString("vencimento")).toLocalDate(),
                rs.getInt("boleto_na_pasta") == 1,
                rs.getString("anexo_nome"),
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
