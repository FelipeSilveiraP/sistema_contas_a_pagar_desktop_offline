package com.chaveiro.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.chaveiro.database.ConnectionFactory;
import com.chaveiro.database.DatabaseInitializer;
import com.chaveiro.model.Conta;
import com.chaveiro.model.Pagamento;
import com.chaveiro.repository.ContaRepository;
import com.chaveiro.repository.PagamentoRepository;
import java.io.ByteArrayInputStream;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

/**
 * Rotinas da abertura do sistema: limpeza trimestral das notas fiscais e a
 * planilha de backup no Google Drive (aqui numa pasta temporaria).
 */
class RotinasAberturaTest {

    @TempDir
    Path pasta;

    private ConnectionFactory conexao;
    private ContaService contas;
    private PagamentoService pagamentos;
    private static final byte[] PDF = "%PDF-1.4 nota de teste".getBytes(StandardCharsets.ISO_8859_1);

    @BeforeEach
    void preparar() {
        conexao = new ConnectionFactory(pasta.resolve("rotinas.db").toString());
        new DatabaseInitializer(conexao).inicializar();
        contas = new ContaService(new ContaRepository(conexao));
        pagamentos = new PagamentoService(new PagamentoRepository(conexao), new ContaRepository(conexao));
    }

    private Conta conta(String nome, String vencimento, boolean pagar) {
        Conta c = contas.cadastrar(new Conta(null, nome, null, null, "Balcão", "PJ", "boleto", null, null,
                new BigDecimal("100.00"), LocalDate.parse(vencimento), false, "nota.pdf", false, null, "PENDENTE"), PDF, true);
        if (pagar) {
            pagamentos.registrar(c.id(), new Pagamento(null, c.id(), LocalDate.parse(vencimento), new BigDecimal("100.00"), null, null, null, null));
        }
        return contas.buscarPorId(c.id());
    }

    @Test
    void limpezaApagaSoNotasDeContasPagasComMaisDeTresMeses() {
        LimpezaAnexosService limpeza = new LimpezaAnexosService(conexao);
        Conta antigaPaga = conta("Antiga paga", "2026-06-10", true);
        Conta antigaPendente = conta("Antiga pendente", "2026-06-11", false);
        Conta recentePaga = conta("Recente paga", "2026-10-20", true);

        int removidas = limpeza.limparSeNecessario(LocalDate.parse("2026-11-12"));

        assertThat(removidas).isEqualTo(1);
        Conta limpa = contas.buscarPorId(antigaPaga.id());
        assertThat(limpa.anexoRemovidoEm()).isEqualTo("2026-11-12");
        assertThat(limpa.anexoNome()).isEqualTo("nota.pdf"); // a conta e o nome do arquivo ficam
        assertThat(limpa.valor()).isEqualByComparingTo("100.00");
        assertThat(contas.buscarPorId(antigaPendente.id()).anexoRemovidoEm()).isNull();
        assertThat(contas.buscarPorId(recentePaga.id()).anexoRemovidoEm()).isNull();
        assertThat(contas.buscarAnexoPdf(recentePaga.id())).isEqualTo(PDF);

        // so roda de novo depois de 3 meses
        Conta outra = conta("Outra antiga", "2026-05-01", true);
        assertThat(limpeza.limparSeNecessario(LocalDate.parse("2027-01-10"))).isZero();
        assertThat(contas.buscarPorId(outra.id()).anexoRemovidoEm()).isNull();
        // em 12/02/2027 o corte e 12/11/2026: sai a "Outra antiga" e tambem a "Recente paga" (20/10/2026)
        assertThat(limpeza.limparSeNecessario(LocalDate.parse("2027-02-12"))).isEqualTo(2);
        assertThat(contas.buscarPorId(antigaPendente.id()).anexoRemovidoEm()).isNull();
    }

    @Test
    void backupGeraPlanilhaExcelComOsDadosNaPastaDoDrive() throws Exception {
        conta("Enel <Energia> & Cia", "2026-11-20", true);
        Path drive = pasta.resolve("Meu Drive");
        BackupDriveService backup = new BackupDriveService(conexao, drive.toString(), "banco-de-teste.db");

        BackupDriveService.Situacao s = backup.exportar();

        assertThat(s.estado()).isEqualTo("ok");
        Path arquivo = Path.of(s.arquivo());
        assertThat(arquivo).exists().hasParent(drive.resolve(BackupDriveService.SUBPASTA));
        assertThat(arquivo.getFileName().toString()).startsWith(BackupDriveService.PREFIXO).endsWith(".xlsx");

        Map<String, String> partes = new HashMap<>();
        try (ZipInputStream zip = new ZipInputStream(new ByteArrayInputStream(Files.readAllBytes(arquivo)))) {
            for (ZipEntry e; (e = zip.getNextEntry()) != null; ) {
                partes.put(e.getName(), new String(zip.readAllBytes(), StandardCharsets.UTF_8));
            }
        }
        assertThat(partes).containsKeys("[Content_Types].xml", "xl/workbook.xml", "xl/worksheets/sheet1.xml");
        assertThat(partes.get("xl/workbook.xml")).contains("Contas", "Pagamentos", "Empresas", "Pagadores", "Bancos", "Mensagens");
        String abaContas = partes.get("xl/worksheets/sheet1.xml");
        assertThat(abaContas).contains("Enel &lt;Energia&gt; &amp; Cia", "20/11/2026", "<v>100.00</v>", "PAGO", "nota.pdf");
        // sem os arquivos das notas: so dados
        assertThat(Files.size(arquivo)).isLessThan(20_000);
    }

    @Test
    void comBancoDeTesteESemPastaOBackupFicaDesligado() {
        BackupDriveService backup = new BackupDriveService(conexao, "", "banco-de-teste.db");
        assertThat(backup.exportar().estado()).isEqualTo("desligado");
    }

    @Test
    void colunasDaPlanilha() {
        assertThat(PlanilhaXlsx.coluna(0)).isEqualTo("A");
        assertThat(PlanilhaXlsx.coluna(25)).isEqualTo("Z");
        assertThat(PlanilhaXlsx.coluna(26)).isEqualTo("AA");
    }
}
