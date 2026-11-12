package com.chaveiro.api;

import com.chaveiro.database.InicializadorBanco;
import com.chaveiro.service.BackupDriveService;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class StatusController {

    private final BackupDriveService backupDrive;

    public StatusController(BackupDriveService backupDrive) {
        this.backupDrive = backupDrive;
    }

    /** Resultado do backup da abertura no Google Drive (a tela avisa se falhou). */
    @GetMapping("/backup-drive")
    public BackupDriveService.Situacao backupDrive() {
        return backupDrive.getSituacao();
    }

    @GetMapping("/status")
    public Map<String, String> status() {
        return Map.of(
                "status", "ok",
                "app", "contas-a-pagar",
                "fase", "1",
                "inicializado", String.valueOf(InicializadorBanco.estaPronto())
        );
    }
}
