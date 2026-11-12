package com.chaveiro.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.chaveiro.database.ConnectionFactory;
import com.chaveiro.database.DatabaseInitializer;
import com.chaveiro.model.Conta;
import com.chaveiro.repository.ContaRepository;
import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.ResultSet;
import java.time.LocalDate;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

/**
 * Nota fiscal: tipo decidido pelo conteudo, limite de 10 MB, macros/JS
 * recusados e regra "anexo OU sem nota" na conta nova. Inclui a
 * existencia das tabelas de recepcao do legado (migracao v14).
 */
class AnexoNotaFiscalTest {

    @TempDir
    Path pasta;

    private static byte[] zip(String... nomes) throws Exception {
        ByteArrayOutputStream saida = new ByteArrayOutputStream();
        try (ZipOutputStream z = new ZipOutputStream(saida)) {
            for (String nome : nomes) {
                z.putNextEntry(new ZipEntry(nome));
                z.write("<x/>".getBytes(StandardCharsets.UTF_8));
                z.closeEntry();
            }
        }
        return saida.toByteArray();
    }

    @Test
    void detectaTipoPeloConteudoENaoPelaExtensao() throws Exception {
        byte[] jpg = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0, 0, 0, 0, 0, 0, 0, 0, 0};
        byte[] png = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0};
        byte[] webp = "RIFF\0\0\0\0WEBPVP8 ".getBytes(StandardCharsets.ISO_8859_1);
        assertThat(AnexoNotaFiscal.detectar(jpg)).contains(AnexoNotaFiscal.Tipo.JPG);
        assertThat(AnexoNotaFiscal.detectar(png)).contains(AnexoNotaFiscal.Tipo.PNG);
        assertThat(AnexoNotaFiscal.detectar(webp)).contains(AnexoNotaFiscal.Tipo.WEBP);
        assertThat(AnexoNotaFiscal.detectar("%PDF-1.7 corpo".getBytes())).contains(AnexoNotaFiscal.Tipo.PDF);
        assertThat(AnexoNotaFiscal.detectar("MZ executavel....".getBytes())).isEmpty();
        assertThat(AnexoNotaFiscal.validar("MZ executavel....".getBytes())).isPresent();
        // o nome passa a ter a extensao do tipo real
        assertThat(AnexoNotaFiscal.nomeComExtensao("foto.pdf", AnexoNotaFiscal.Tipo.JPG)).isEqualTo("foto.jpg");
        assertThat(AnexoNotaFiscal.nomeComExtensao("..\\a/b.exe", AnexoNotaFiscal.Tipo.PDF)).doesNotContain("\\", "/");
    }

    @Test
    void aceitaDocxERecusaMacrosEPdfComJavascript() throws Exception {
        assertThat(AnexoNotaFiscal.validar(zip("[Content_Types].xml", "word/document.xml"))).isEmpty();
        assertThat(AnexoNotaFiscal.validar(zip("[Content_Types].xml", "word/document.xml", "word/vbaProject.bin")))
                .isPresent();
        assertThat(AnexoNotaFiscal.validar(zip("qualquer.txt"))).isPresent();
        assertThat(AnexoNotaFiscal.validar("%PDF-1.4 /OpenAction << /S /JavaScript >>".getBytes())).isPresent();
        assertThat(AnexoNotaFiscal.validar(new byte[AnexoNotaFiscal.LIMITE_BYTES + 1])).isPresent();
    }

    @Test
    void contaNovaExigeAnexoOuMarcaSemNota() throws Exception {
        ConnectionFactory conexao = new ConnectionFactory(pasta.resolve("anexo.db").toString());
        new DatabaseInitializer(conexao).inicializar();
        ContaService service = new ContaService(new ContaRepository(conexao));

        Conta semNada = new Conta(null, "Enel", null, null, "Balcão", "PJ", "boleto", null, null,
                new BigDecimal("10.00"), LocalDate.parse("2026-12-10"), false, null, false, null, "PENDENTE");
        assertThatThrownBy(() -> service.cadastrar(semNada, null, true))
                .isInstanceOf(DadosInvalidosException.class);

        Conta marcada = new Conta(null, "Enel", null, null, "Balcão", "PJ", "boleto", null, null,
                new BigDecimal("10.00"), LocalDate.parse("2026-12-10"), false, null, true, null, "PENDENTE");
        assertThat(service.cadastrar(marcada, null, true).semNotaFiscal()).isTrue();

        byte[] png = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0};
        Conta comFoto = new Conta(null, "Sabesp", null, null, "Balcão", "PJ", "boleto", null, null,
                new BigDecimal("20.00"), LocalDate.parse("2026-12-11"), false, "nota.pdf", true, null, "PENDENTE");
        Conta criada = service.cadastrar(comFoto, png, true);
        assertThat(criada.anexoNome()).isEqualTo("nota.png");
        assertThat(criada.semNotaFiscal()).isFalse();
        assertThat(ContaService.tipoMimeAnexo(service.buscarAnexoPdf(criada.id()))).isEqualTo("image/png");
    }

    @Test
    void tabelasDoLegadoExistemSeparadas() throws Exception {
        ConnectionFactory conexao = new ConnectionFactory(pasta.resolve("legado.db").toString());
        new DatabaseInitializer(conexao).inicializar();
        try (Connection conn = conexao.getConnection();
             ResultSet rs = conn.createStatement().executeQuery(
                     "SELECT count(*) FROM sqlite_master WHERE type='table'"
                             + " AND name IN ('legado_lancamentos','legado_padroes','legado_avisos')")) {
            rs.next();
            assertThat(rs.getInt(1)).isEqualTo(3);
        }
        try (Connection conn = conexao.getConnection()) {
            conn.createStatement().execute("INSERT INTO legado_lancamentos (arquivo_origem, aba_origem, linha_origem,"
                    + " data_vencimento, fornecedor, valor_original, situacao) VALUES"
                    + " ('CONTAS-A-PAGAR-2026.xlsm', 'JANEIRO', 3, '2026-01-01', 'CONVENIO LENY', '1080', 'PAGO')");
            assertThatThrownBy(() -> conn.createStatement().execute("INSERT INTO legado_lancamentos"
                    + " (arquivo_origem, aba_origem, linha_origem) VALUES ('CONTAS-A-PAGAR-2026.xlsm', 'JANEIRO', 3)"))
                    .hasMessageContaining("UNIQUE");
        }
    }
}
