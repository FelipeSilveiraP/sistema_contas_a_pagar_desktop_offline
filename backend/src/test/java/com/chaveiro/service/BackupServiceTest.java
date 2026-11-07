package com.chaveiro.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.chaveiro.database.ConnectionFactory;
import com.chaveiro.database.DatabaseInitializer;
import com.chaveiro.model.Banco;
import com.chaveiro.repository.BancoRepository;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.Statement;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

/**
 * Backup e restauracao consistentes do SQLite (somente dados ficticios).
 */
class BackupServiceTest {

    @TempDir
    Path pastaTemporaria;

    private ConnectionFactory conexao;
    private BancoRepository repository;
    private BancoService service;
    private BackupService backupService;

    @BeforeEach
    void preparar() {
        conexao = new ConnectionFactory(pastaTemporaria.resolve("contas_teste.db").toString());
        new DatabaseInitializer(conexao).inicializar();
        repository = new BancoRepository(conexao);
        service = new BancoService(repository);
        backupService = new BackupService(conexao);
    }

    @Test
    void deveCriarBackupConsistenteComDadosFicticios() throws Exception {
        service.cadastrar(new Banco(null, "Banco Backup", null));

        Path backup = backupService.criarBackup("teste");

        assertThat(backup).exists();
        assertThat(Files.size(backup)).isPositive();
        assertThat(backupService.verificarIntegridade()).isTrue();
    }

    @Test
    void deveRestaurarDadosAposPerdaDoBancoOriginal() throws Exception {
        Banco criado = service.cadastrar(new Banco(null, "Banco Restaurado", null));
        Path backup = backupService.criarBackup("teste");

        try (Connection conn = conexao.getConnection();
             Statement stmt = conn.createStatement()) {
            stmt.execute("DELETE FROM bancos");
        }
        assertThat(service.listar()).isEmpty();

        backupService.restaurar(backup);

        List<Banco> restaurados = service.listar();
        assertThat(restaurados).hasSize(1);
        assertThat(restaurados.getFirst().id()).isEqualTo(criado.id());
        assertThat(restaurados.getFirst().instituicao()).isEqualTo("Banco Restaurado");
    }

    @Test
    void deveRecusarRestauracaoDeArquivoInvalido() throws Exception {
        Path invalido = pastaTemporaria.resolve("nao-é-um-backup.db");
        Files.writeString(invalido, "conteudo corrompido");

        assertThatThrownBy(() -> backupService.restaurar(invalido))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void deveCriarApenasUmBackupDiarioPorDia() {
        Path primeiro = backupService.backupDiarioSeNecessario();
        Path segundo = backupService.backupDiarioSeNecessario();

        assertThat(primeiro).isNotNull();
        assertThat(segundo).isNull();
    }

    @Test
    void deveRotacionarBackupsAntigosMantendoOsUltimos() {
        for (int i = 0; i < 12; i++) {
            backupService.criarBackup("rotacao");
        }

        backupService.manterApenasUltimos(8);

        try (var arquivos = Files.list(backupService.getDiretorioBackups())) {
            assertThat(arquivos.count()).isLessThanOrEqualTo(8);
        } catch (Exception erro) {
            throw new AssertionError(erro);
        }
    }
}
