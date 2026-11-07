package com.chaveiro.service;

import com.chaveiro.database.ConnectionFactory;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.stream.Stream;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Backup e restauracao consistentes do SQLite.
 *
 * Copia simples de arquivo NAO e suficiente em modo WAL: o conteudo pode estar
 * parcialmente em `*-wal`. Por isso o backup usa `VACUUM INTO`, que grava um
 * snapshot consistente (dentro de transacao) em um arquivo novo, pronto para
 * ser copiado/restaurado com seguranca.
 */
@Service
public class BackupService {

    private static final Logger log = LoggerFactory.getLogger(BackupService.class);
    private static final DateTimeFormatter SUFIXO_HORA = DateTimeFormatter.ofPattern("yyyy-MM-dd_HHmmss");

    private final ConnectionFactory conexao;

    public BackupService(ConnectionFactory conexao) {
        this.conexao = conexao;
    }

    public Path getDiretorioBackups() {
        return conexao.getDiretorioDados().resolve("backups");
    }

    /**
     * Cria backup consistente com data/hora no nome.
     */
    public Path criarBackup(String motivo) {
        try {
            Files.createDirectories(getDiretorioBackups());
            String nome = "contas_a_pagar_" + motivo + "_" + LocalDateTime.now().format(SUFIXO_HORA);
            Path destino = getDiretorioBackups().resolve(nome + ".db");
            for (int sufixo = 2; Files.exists(destino); sufixo++) {
                destino = getDiretorioBackups().resolve(nome + "_" + sufixo + ".db");
            }
            try (Connection conn = conexao.getConnection();
                 Statement stmt = conn.createStatement()) {
                stmt.execute("VACUUM INTO '" + destino.toAbsolutePath().toString().replace("'", "''") + "'");
            }
            log.info("backup criado: {}", destino);
            return destino;
        } catch (SQLException | IOException erro) {
            log.error("falha ao criar backup", erro);
            throw new IllegalStateException("falha ao criar o backup", erro);
        }
    }

    /**
     * Backup diario simples: cria um backup por dia na inicializacao, se ainda nao existir.
     */
    public Path backupDiarioSeNecessario() {
        String hoje = LocalDate.now().toString();
        try (Stream<Path> arquivos = Files.list(getDiretorioBackups())) {
            boolean existeHoje = arquivos
                    .map(p -> p.getFileName().toString())
                    .anyMatch(nome -> nome.contains(hoje));
            if (existeHoje) {
                return null;
            }
        } catch (IOException inexistente) {
            // diretorio ainda nao existe: o backup diario sera criado abaixo
        }
        Path criado = criarBackup("diario");
        manterApenasUltimos(8);
        return criado;
    }

    /**
     * Restaura o banco a partir de um backup valido, substituindo o arquivo atual
     * (e descartando residuos WAL/SHM antigos). O backend nao deve ter escritas em
     * andamento durante a restauracao.
     */
    public void restaurar(Path backup) {
        Path banco = conexao.getCaminhoBanco();
        try {
            if (!Files.isRegularFile(backup)) {
                throw new IllegalArgumentException("backup nao encontrado");
            }
            verificarIntegridade(backup);
            Path bancoTemporario = banco.resolveSibling(banco.getFileName() + ".restaurando");
            Files.copy(backup, bancoTemporario, StandardCopyOption.REPLACE_EXISTING);
            Files.move(bancoTemporario, banco, StandardCopyOption.REPLACE_EXISTING);
            Files.deleteIfExists(Path.of(banco + "-wal"));
            Files.deleteIfExists(Path.of(banco + "-shm"));
            verificarIntegridade(banco);
            log.info("banco restaurado a partir de {}", backup);
        } catch (IOException | SQLException erro) {
            log.error("falha ao restaurar backup {}", backup, erro);
            throw new IllegalStateException("falha ao restaurar o backup", erro);
        }
    }

    /**
     * PRAGMA integrity_check do arquivo informado (ou do banco atual).
     */
    public boolean verificarIntegridade() {
        try {
            verificarIntegridade(conexao.getCaminhoBanco());
            return true;
        } catch (SQLException erro) {
            log.error("falha na verificacao de integridade", erro);
            return false;
        }
    }

    private static void verificarIntegridade(Path arquivo) throws SQLException {
        try (Connection conn = java.sql.DriverManager.getConnection("jdbc:sqlite:" + arquivo);
             Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery("PRAGMA integrity_check;")) {
            String resultado = rs.next() ? rs.getString(1) : "";
            if (!"ok".equalsIgnoreCase(resultado)) {
                throw new SQLException("integridade do banco invalida: " + resultado);
            }
        }
    }

    public void manterApenasUltimos(int quantidade) {
        try (Stream<Path> arquivos = Files.list(getDiretorioBackups())) {
            arquivos.filter(p -> p.getFileName().toString().endsWith(".db"))
                    .sorted(Comparator.comparing((Path p) -> p.getFileName().toString()).reversed())
                    .skip(quantidade)
                    .forEach(p -> {
                        try {
                            Files.deleteIfExists(p);
                        } catch (IOException erro) {
                            log.warn("nao foi possivel remover backup antigo {}", p);
                        }
                    });
        } catch (IOException erro) {
            log.warn("falha ao rotacionar backups", erro);
        }
    }
}
