package com.chaveiro.repository;

import com.chaveiro.database.ConnectionFactory;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.sql.Types;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Repository;

/**
 * Contas de usuario. Este repositorio so ve os dados JA CIFRADOS (login, e-mail)
 * e o hash do PIN: quem cifra/decifra e o UsuarioService (via Cripto).
 */
@Repository
public class UsuarioRepository {

    /** Linha da tabela como esta no banco (login/e-mail cifrados). */
    public record Linha(long id, String nome, String loginCifrado, String emailCifrado, String pinHash, boolean temFoto,
                        boolean admin, boolean ativo, int falhas, String bloqueadoAte, int acessos, String ultimoAcesso,
                        String criadoEm) {
    }

    public record Acesso(long id, Long idUsuario, String nome, String momento, String tipo) {
    }

    public record Codigo(long id, String codigoHash, String expiraEm, int tentativas) {
    }

    private static final String COLUNAS = "id_usuario, nome, login_cifrado, email_cifrado, pin_hash, foto IS NOT NULL AS tem_foto,"
            + " admin, ativo, falhas, bloqueado_ate, acessos, ultimo_acesso, criado_em";

    private final ConnectionFactory conexao;

    public UsuarioRepository(ConnectionFactory conexao) {
        this.conexao = conexao;
    }

    public int contar() throws SQLException {
        try (Connection conn = conexao.getConnection(); Statement st = conn.createStatement();
             ResultSet rs = st.executeQuery("SELECT COUNT(*) FROM usuarios")) {
            rs.next();
            return rs.getInt(1);
        }
    }

    public List<Linha> listar() throws SQLException {
        try (Connection conn = conexao.getConnection();
             PreparedStatement st = conn.prepareStatement("SELECT " + COLUNAS + " FROM usuarios ORDER BY nome COLLATE NOCASE");
             ResultSet rs = st.executeQuery()) {
            List<Linha> lista = new ArrayList<>();
            while (rs.next()) {
                lista.add(mapear(rs));
            }
            return lista;
        }
    }

    public Optional<Linha> buscarPorId(long id) throws SQLException {
        return buscar("id_usuario = ?", String.valueOf(id));
    }

    public Optional<Linha> buscarPorIndice(String indice) throws SQLException {
        return buscar("login_indice = ?", indice);
    }

    private Optional<Linha> buscar(String condicao, String valor) throws SQLException {
        try (Connection conn = conexao.getConnection();
             PreparedStatement st = conn.prepareStatement("SELECT " + COLUNAS + " FROM usuarios WHERE " + condicao)) { // nosemgrep: sql-concatenado-com-variavel -- condicao fixa (buscarPorId/buscarPorIndice)
            st.setString(1, valor);
            try (ResultSet rs = st.executeQuery()) {
                return rs.next() ? Optional.of(mapear(rs)) : Optional.empty();
            }
        }
    }

    public boolean indiceEmUso(String indice, Long ignorarId) throws SQLException {
        try (Connection conn = conexao.getConnection();
             PreparedStatement st = conn.prepareStatement("SELECT 1 FROM usuarios WHERE login_indice = ? AND id_usuario <> ?")) {
            st.setString(1, indice);
            st.setLong(2, ignorarId == null ? -1 : ignorarId);
            try (ResultSet rs = st.executeQuery()) {
                return rs.next();
            }
        }
    }

    public byte[] foto(long id) throws SQLException {
        try (Connection conn = conexao.getConnection();
             PreparedStatement st = conn.prepareStatement("SELECT foto FROM usuarios WHERE id_usuario = ?")) {
            st.setLong(1, id);
            try (ResultSet rs = st.executeQuery()) {
                return rs.next() ? rs.getBytes(1) : null;
            }
        }
    }

    public long inserir(String nome, String indice, String loginCifrado, String emailCifrado, String pinHash, boolean admin,
                        byte[] foto) throws SQLException {
        return conexao.emTransacao(conn -> {
            try (PreparedStatement st = conn.prepareStatement("INSERT INTO usuarios (nome, login_indice, login_cifrado, email_cifrado,"
                    + " pin_hash, admin, foto) VALUES (?, ?, ?, ?, ?, ?, ?)", Statement.RETURN_GENERATED_KEYS)) {
                st.setString(1, nome);
                st.setString(2, indice);
                st.setString(3, loginCifrado);
                st.setString(4, emailCifrado);
                st.setString(5, pinHash);
                st.setInt(6, admin ? 1 : 0);
                if (foto == null) {
                    st.setNull(7, Types.BLOB);
                } else {
                    st.setBytes(7, foto);
                }
                st.executeUpdate();
                try (ResultSet ch = st.getGeneratedKeys()) {
                    ch.next();
                    return ch.getLong(1);
                }
            }
        });
    }

    public boolean atualizarDados(long id, String nome, String indice, String loginCifrado, String emailCifrado, boolean admin,
                                  boolean ativo) throws SQLException {
        return executar("UPDATE usuarios SET nome = ?, login_indice = ?, login_cifrado = ?, email_cifrado = ?, admin = ?, ativo = ?"
                + " WHERE id_usuario = ?", nome, indice, loginCifrado, emailCifrado, admin ? 1 : 0, ativo ? 1 : 0, id);
    }

    /** Novo PIN: zera as falhas e o bloqueio e invalida os codigos de e-mail pendentes. */
    public boolean atualizarPin(long id, String pinHash) throws SQLException {
        return conexao.emTransacao(conn -> {
            try (PreparedStatement st = conn.prepareStatement(
                    "UPDATE usuarios SET pin_hash = ?, falhas = 0, bloqueado_ate = NULL WHERE id_usuario = ?");
                 PreparedStatement codigos = conn.prepareStatement("UPDATE codigos_redefinicao SET usado = 1 WHERE id_usuario = ?")) {
                st.setString(1, pinHash);
                st.setLong(2, id);
                codigos.setLong(1, id);
                codigos.executeUpdate();
                return st.executeUpdate() > 0;
            }
        });
    }

    public boolean atualizarFoto(long id, byte[] foto) throws SQLException {
        return conexao.emTransacao(conn -> {
            try (PreparedStatement st = conn.prepareStatement("UPDATE usuarios SET foto = ? WHERE id_usuario = ?")) {
                if (foto == null) {
                    st.setNull(1, Types.BLOB);
                } else {
                    st.setBytes(1, foto);
                }
                st.setLong(2, id);
                return st.executeUpdate() > 0;
            }
        });
    }

    public boolean excluir(long id) throws SQLException {
        return executar("DELETE FROM usuarios WHERE id_usuario = ?", id);
    }

    /** PIN errado: soma a falha e, na 5a, bloqueia por 5 minutos. Devolve as falhas acumuladas. */
    public int registrarFalha(long id, String nome, int maxFalhas, int minutosBloqueio) throws SQLException {
        return conexao.emTransacao(conn -> {
            try (PreparedStatement up = conn.prepareStatement("UPDATE usuarios SET falhas = falhas + 1,"
                    + " bloqueado_ate = CASE WHEN falhas + 1 >= ? THEN datetime('now', 'localtime', ?) ELSE bloqueado_ate END"
                    + " WHERE id_usuario = ?")) {
                up.setInt(1, maxFalhas);
                up.setString(2, "+" + minutosBloqueio + " minutes");
                up.setLong(3, id);
                up.executeUpdate();
            }
            int falhas;
            try (PreparedStatement sel = conn.prepareStatement("SELECT falhas FROM usuarios WHERE id_usuario = ?")) {
                sel.setLong(1, id);
                try (ResultSet rs = sel.executeQuery()) {
                    rs.next();
                    falhas = rs.getInt(1);
                }
            }
            registrar(conn, id, nome, falhas >= maxFalhas ? "BLOQUEIO" : "PIN_ERRADO");
            if (falhas >= maxFalhas) {
                try (PreparedStatement zera = conn.prepareStatement("UPDATE usuarios SET falhas = 0 WHERE id_usuario = ?")) {
                    zera.setLong(1, id);
                    zera.executeUpdate();
                }
            }
            return falhas;
        });
    }

    /** Ainda bloqueada agora? */
    public boolean bloqueada(long id) throws SQLException {
        try (Connection conn = conexao.getConnection();
             PreparedStatement st = conn.prepareStatement("SELECT bloqueado_ate > datetime('now', 'localtime') FROM usuarios WHERE id_usuario = ?")) {
            st.setLong(1, id);
            try (ResultSet rs = st.executeQuery()) {
                return rs.next() && rs.getInt(1) == 1;
            }
        }
    }

    /** Minutos que faltam para a conta desbloquear (no minimo 1 enquanto bloqueada). */
    public int minutosRestantesBloqueio(long id) throws SQLException {
        try (Connection conn = conexao.getConnection();
             PreparedStatement st = conn.prepareStatement("SELECT MAX(1, CAST(ceil((julianday(bloqueado_ate)"
                     + " - julianday('now', 'localtime')) * 1440) AS INTEGER)) FROM usuarios WHERE id_usuario = ?")) {
            st.setLong(1, id);
            try (ResultSet rs = st.executeQuery()) {
                return rs.next() ? rs.getInt(1) : 1;
            }
        }
    }

    /** Quantos eventos `tipo` a conta teve desde `desde` (modificador do SQLite, ex.: "-24 hours"). */
    public int contarEventos(long id, String tipo, String desde) throws SQLException {
        try (Connection conn = conexao.getConnection();
             PreparedStatement st = conn.prepareStatement("SELECT COUNT(*) FROM acessos_usuario WHERE id_usuario = ? AND tipo = ?"
                     + " AND momento > strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime', ?)")) {
            st.setLong(1, id);
            st.setString(2, tipo);
            st.setString(3, desde);
            try (ResultSet rs = st.executeQuery()) {
                return rs.next() ? rs.getInt(1) : 0;
            }
        }
    }

    /** Codigos de "Esqueci o PIN" criados desde `desde` (de uma conta, ou de todas com id nulo). */
    public int contarCodigos(Long id, String desde) throws SQLException {
        try (Connection conn = conexao.getConnection();
             PreparedStatement st = conn.prepareStatement("SELECT COUNT(*) FROM codigos_redefinicao"
                     + " WHERE (? IS NULL OR id_usuario = ?) AND criado_em > datetime('now', 'localtime', ?)")) {
            if (id == null) {
                st.setNull(1, Types.INTEGER);
                st.setNull(2, Types.INTEGER);
            } else {
                st.setLong(1, id);
                st.setLong(2, id);
            }
            st.setString(3, desde);
            try (ResultSet rs = st.executeQuery()) {
                return rs.next() ? rs.getInt(1) : 0;
            }
        }
    }

    /** Entrada certa: conta o acesso, guarda a data e zera as falhas, tudo junto. */
    public void registrarEntrada(long id, String nome) throws SQLException {
        conexao.emTransacao(conn -> {
            try (PreparedStatement st = conn.prepareStatement("UPDATE usuarios SET acessos = acessos + 1, falhas = 0, bloqueado_ate = NULL,"
                    + " ultimo_acesso = strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime') WHERE id_usuario = ?")) {
                st.setLong(1, id);
                st.executeUpdate();
            }
            registrar(conn, id, nome, "ENTRADA");
            return null;
        });
    }

    public void registrarEvento(long id, String nome, String tipo) throws SQLException {
        conexao.emTransacao(conn -> {
            registrar(conn, id, nome, tipo);
            return null;
        });
    }

    private static void registrar(Connection conn, long id, String nome, String tipo) throws SQLException {
        try (PreparedStatement st = conn.prepareStatement("INSERT INTO acessos_usuario (id_usuario, nome, tipo) VALUES (?, ?, ?)")) {
            st.setLong(1, id);
            st.setString(2, nome);
            st.setString(3, tipo);
            st.executeUpdate();
        }
    }

    public List<Acesso> acessos(Long idUsuario, int limite) throws SQLException {
        String sql = "SELECT id_acesso, id_usuario, nome, momento, tipo FROM acessos_usuario"
                + (idUsuario == null ? "" : " WHERE id_usuario = ?") + " ORDER BY id_acesso DESC LIMIT ?";
        try (Connection conn = conexao.getConnection(); PreparedStatement st = conn.prepareStatement(sql)) {
            int p = 1;
            if (idUsuario != null) {
                st.setLong(p++, idUsuario);
            }
            st.setInt(p, limite);
            try (ResultSet rs = st.executeQuery()) {
                List<Acesso> lista = new ArrayList<>();
                while (rs.next()) {
                    long idU = rs.getLong("id_usuario");
                    lista.add(new Acesso(rs.getLong("id_acesso"), rs.wasNull() ? null : idU, rs.getString("nome"),
                            rs.getString("momento"), rs.getString("tipo")));
                }
                return lista;
            }
        }
    }

    // ---------- codigos de redefinicao por e-mail ----------

    public void criarCodigo(long id, String codigoHash, int minutos) throws SQLException {
        conexao.emTransacao(conn -> {
            try (PreparedStatement velhos = conn.prepareStatement("UPDATE codigos_redefinicao SET usado = 1 WHERE id_usuario = ?");
                 PreparedStatement st = conn.prepareStatement("INSERT INTO codigos_redefinicao (id_usuario, codigo_hash, expira_em)"
                         + " VALUES (?, ?, datetime('now', 'localtime', ?))")) {
                velhos.setLong(1, id);
                velhos.executeUpdate();
                st.setLong(1, id);
                st.setString(2, codigoHash);
                st.setString(3, "+" + minutos + " minutes");
                st.executeUpdate();
            }
            return null;
        });
    }

    /** Codigo valido: nao usado, nao vencido e com menos de 5 tentativas. */
    public Optional<Codigo> codigoValido(long id) throws SQLException {
        try (Connection conn = conexao.getConnection();
             PreparedStatement st = conn.prepareStatement("SELECT id_codigo, codigo_hash, expira_em, tentativas FROM codigos_redefinicao"
                     + " WHERE id_usuario = ? AND usado = 0 AND tentativas < 5 AND expira_em > datetime('now', 'localtime')"
                     + " ORDER BY id_codigo DESC LIMIT 1")) {
            st.setLong(1, id);
            try (ResultSet rs = st.executeQuery()) {
                return rs.next() ? Optional.of(new Codigo(rs.getLong(1), rs.getString(2), rs.getString(3), rs.getInt(4))) : Optional.empty();
            }
        }
    }

    public void tentativaCodigo(long idCodigo) throws SQLException {
        executar("UPDATE codigos_redefinicao SET tentativas = tentativas + 1 WHERE id_codigo = ?", idCodigo);
    }

    // ---------- configuracao (tabela manutencao: chave -> valor) ----------

    public Optional<String> config(String chave) throws SQLException {
        try (Connection conn = conexao.getConnection();
             PreparedStatement st = conn.prepareStatement("SELECT valor FROM manutencao WHERE chave = ?")) {
            st.setString(1, chave);
            try (ResultSet rs = st.executeQuery()) {
                return rs.next() ? Optional.ofNullable(rs.getString(1)) : Optional.empty();
            }
        }
    }

    public void gravarConfig(String chave, String valor) throws SQLException {
        executar("INSERT INTO manutencao (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor", chave, valor);
    }

    private boolean executar(String sql, Object... params) throws SQLException {
        return conexao.emTransacao(conn -> {
            try (PreparedStatement st = conn.prepareStatement(sql)) { // nosemgrep: sql-concatenado-com-variavel -- sql fixo dos metodos acima; valores por "?"
                for (int i = 0; i < params.length; i++) {
                    st.setObject(i + 1, params[i]);
                }
                return st.executeUpdate() > 0;
            }
        });
    }

    private static Linha mapear(ResultSet rs) throws SQLException {
        return new Linha(rs.getLong("id_usuario"), rs.getString("nome"), rs.getString("login_cifrado"), rs.getString("email_cifrado"),
                rs.getString("pin_hash"), rs.getInt("tem_foto") == 1, rs.getInt("admin") == 1, rs.getInt("ativo") == 1,
                rs.getInt("falhas"), rs.getString("bloqueado_ate"), rs.getInt("acessos"), rs.getString("ultimo_acesso"),
                rs.getString("criado_em"));
    }
}
