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
    void backupNuncaApagaArquivosDoUsuarioNoDrive() throws Exception {
        Path drive = pasta.resolve("Meu Drive");
        Path sub = drive.resolve(BackupDriveService.SUBPASTA);
        Files.createDirectories(sub);
        // arquivos e pastas que NAO sao do sistema (na raiz do Drive e na subpasta)
        Map<Path, String> alheios = new HashMap<>();
        for (Path p : new Path[] {drive.resolve("contrato.pdf"), drive.resolve("Contas a Pagar - dados 2020-01-01.xlsx"),
                sub.resolve("contrato.pdf"), sub.resolve("Contas a Pagar - dados copia.xlsx"),
                sub.resolve("Contas a Pagar - dados 2026-01-01 (1).xlsx"), sub.resolve("planilha da loja.xlsx"),
                sub.resolve("Contas a Pagar - dados 2026-01-01.xlsx.bak"), sub.resolve("contas a pagar - dados 2020-01-02.xlsx")}) {
            Files.writeString(p, "conteudo do usuario " + p.getFileName());
            alheios.put(p, Files.readString(p));
        }
        // subpasta com nome igual ao padrao (nao e arquivo: nunca e apagada) e outra subpasta qualquer
        Path pastaComNomeDoPadrao = Files.createDirectories(sub.resolve("Contas a Pagar - dados 2000-01-01.xlsx"));
        Path outraPasta = Files.createDirectories(sub.resolve("fotos"));
        Files.writeString(outraPasta.resolve("Contas a Pagar - dados 2000-01-02.xlsx"), "dentro de outra pasta");
        // 35 planilhas antigas do sistema (todas antes de hoje)
        LocalDate dia = LocalDate.now().minusDays(40);
        for (int i = 0; i < 35; i++) {
            Files.writeString(sub.resolve(BackupDriveService.PREFIXO + dia.plusDays(i) + ".xlsx"), "antiga");
        }

        BackupDriveService.Situacao s = new BackupDriveService(conexao, drive.toString(), "banco-de-teste.db").exportar();

        assertThat(s.estado()).isEqualTo("ok");
        alheios.forEach((arquivo, conteudo) -> assertThat(arquivo).exists().hasContent(conteudo));
        assertThat(pastaComNomeDoPadrao).isDirectory();
        assertThat(outraPasta.resolve("Contas a Pagar - dados 2000-01-02.xlsx")).exists();
        try (var lista = Files.list(sub)) {
            assertThat(lista.filter(p -> BackupDriveService.ehPlanilhaDoSistema(p, sub))).hasSize(BackupDriveService.MANTER);
        }
        // ficaram as 30 mais recentes, incluindo a de hoje
        assertThat(sub.resolve(BackupDriveService.PREFIXO + LocalDate.now() + ".xlsx")).exists();
        assertThat(sub.resolve(BackupDriveService.PREFIXO + dia + ".xlsx")).doesNotExist();
    }

    @Test
    void subpastaDeBackupQueEAtalhoNaoEUsada() throws Exception {
        Path drive = pasta.resolve("Meu Drive");
        Path outroLugar = Files.createDirectories(pasta.resolve("documentos importantes"));
        Files.writeString(outroLugar.resolve(BackupDriveService.PREFIXO + "2000-01-01.xlsx"), "nao apagar");
        Files.createDirectories(drive);
        try {
            Files.createSymbolicLink(drive.resolve(BackupDriveService.SUBPASTA), outroLugar);
        } catch (UnsupportedOperationException | java.io.IOException semPermissao) {
            return; // Windows sem permissao para criar link: o teste nao se aplica
        }
        assertThat(new BackupDriveService(conexao, drive.toString(), "banco-de-teste.db").exportar().estado()).isEqualTo("erro");
        assertThat(outroLugar.resolve(BackupDriveService.PREFIXO + "2000-01-01.xlsx")).hasContent("nao apagar");
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
