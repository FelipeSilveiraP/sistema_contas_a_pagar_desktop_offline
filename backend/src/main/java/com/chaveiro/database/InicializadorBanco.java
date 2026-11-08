package com.chaveiro.database;

import com.chaveiro.service.BackupService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

/**
 * Inicializacao automatica do banco na abertura do aplicativo:
 * backup de seguranca antes de migracoes, migracoes versionadas e
 * backup diario. O usuario nao executa nenhum comando manual.
 */
@Component
public class InicializadorBanco implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(InicializadorBanco.class);

    /** Sinaliza que SQLite/migracoes terminaram (usado pelo /api/status). */
    private static volatile boolean pronto = false;

    public static boolean estaPronto() {
        return pronto;
    }

    private final DatabaseInitializer initializer;
    private final BackupService backupService;

    public InicializadorBanco(DatabaseInitializer initializer, BackupService backupService) {
        this.initializer = initializer;
        this.backupService = backupService;
    }

    @Override
    public void run(ApplicationArguments args) throws Exception {
        try {
            int versao = initializer.lerVersao();
            if (versao < initializer.getVersaoAtual()) {
                backupService.criarBackup("pre-migracao");
            }
            initializer.inicializar();
            backupService.backupDiarioSeNecessario();
            pronto = true;
            log.info("banco SQLite pronto (esquema v{})", initializer.getVersaoAtual());
        } catch (Exception erro) {
            log.error("falha critica ao inicializar o banco de dados", erro);
            throw erro;
        }
    }
}
