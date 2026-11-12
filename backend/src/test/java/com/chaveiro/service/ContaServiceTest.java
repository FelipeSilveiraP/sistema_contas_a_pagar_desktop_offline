package com.chaveiro.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.chaveiro.database.ConnectionFactory;
import com.chaveiro.database.DatabaseInitializer;
import com.chaveiro.model.Conta;
import com.chaveiro.model.Empresa;
import com.chaveiro.repository.ContaRepository;
import com.chaveiro.repository.EmpresaRepository;
import java.math.BigDecimal;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.Base64;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

/**
 * Regras das contas a pagar sobre SQLite real (banco de teste isolado em tmp).
 */
class ContaServiceTest {

    @TempDir
    Path pastaTemporaria;

    private ContaService service;
    private long idEmpresa;

    @BeforeEach
    void preparar() throws Exception {
        ConnectionFactory conexao = new ConnectionFactory(pastaTemporaria.resolve("contas_teste.db").toString());
        new DatabaseInitializer(conexao).inicializar();
        service = new ContaService(new ContaRepository(conexao));
        idEmpresa = new EmpresaRepository(conexao).inserir(
                new Empresa(null, null, "Auto Posto Central", null, null, null, List.of())).id();
    }

    private Conta conta(String nomeEmpresa, String valor, String vencimento, String doc) {
        return new Conta(null, nomeEmpresa, idEmpresa, null, "Balcão 01", "PJ", "boleto",
                "Aluguel", doc, new BigDecimal(valor), LocalDate.parse(vencimento), false, null, true, "PENDENTE");
    }

    @Test
    void deveCadastrarContaValidaComStatusPendente() {
        Conta criada = service.cadastrar(conta("Enel Distribuição", "123.45", "2026-12-10", "NF-1"), null, false);

        assertThat(criada.id()).isNotNull();
        assertThat(criada.status()).isEqualTo("PENDENTE");
        assertThat(criada.nomeEmpresa()).isEqualTo("Enel Distribuição");
        assertThat(criada.valor()).isEqualByComparingTo("123.45");
        assertThat(criada.tipoPessoa()).isEqualTo("PJ");
    }

    @Test
    void devePreservarPrecisaoMonetariaDeCentavos() {
        Conta criada = service.cadastrar(conta("Enel Distribuição", "0.01", "2026-12-10", null), null, false);

        assertThat(service.buscarPorId(criada.id()).valor()).isEqualByComparingTo("0.01");
    }

    @Test
    void deveRecusarValorZeroNegativoOuComTresCasas() {
        assertThatThrownBy(() -> service.cadastrar(conta("Enel", "0.00", "2026-12-10", null), null, false))
                .isInstanceOf(DadosInvalidosException.class);
        assertThatThrownBy(() -> service.cadastrar(conta("Enel", "-1.00", "2026-12-10", null), null, false))
                .isInstanceOf(DadosInvalidosException.class);
        assertThatThrownBy(() -> service.cadastrar(conta("Enel", "1.234", "2026-12-10", null), null, false))
                .isInstanceOf(DadosInvalidosException.class);
    }

    @Test
    void deveRecusarContaSemVencimentoSemNomeOuSemPagador() {
        assertThatThrownBy(() -> service.cadastrar(
                new Conta(null, "Enel", idEmpresa, null, "Balcão", "PJ", "boleto", null, null,
                        new BigDecimal("10.00"), null, false, null, true, "PENDENTE"), null, false))
                .isInstanceOf(DadosInvalidosException.class);
        assertThatThrownBy(() -> service.cadastrar(
                new Conta(null, "", idEmpresa, null, "Balcão", "PJ", "boleto", null, null,
                        new BigDecimal("10.00"), LocalDate.parse("2026-12-10"), false, null, true, "PENDENTE"), null, false))
                .isInstanceOf(DadosInvalidosException.class);
        assertThatThrownBy(() -> service.cadastrar(
                new Conta(null, "Enel", idEmpresa, null, "", "PJ", "boleto", null, null,
                        new BigDecimal("10.00"), LocalDate.parse("2026-12-10"), false, null, true, "PENDENTE"), null, false))
                .isInstanceOf(DadosInvalidosException.class);
    }

    @Test
    void deveRecusarFormaPagamentoOuTipoPessoaInvalidos() {
        assertThatThrownBy(() -> service.cadastrar(
                new Conta(null, "Enel", idEmpresa, null, "Balcão", "PJ", "cheque", null, null,
                        new BigDecimal("10.00"), LocalDate.parse("2026-12-10"), false, null, true, "PENDENTE"), null, false))
                .isInstanceOf(DadosInvalidosException.class);
        assertThatThrownBy(() -> service.cadastrar(
                new Conta(null, "Enel", idEmpresa, null, "Balcão", "XX", "boleto", null, null,
                        new BigDecimal("10.00"), LocalDate.parse("2026-12-10"), false, null, true, "PENDENTE"), null, false))
                .isInstanceOf(DadosInvalidosException.class);
    }

    @Test
    void deveValidarAnexoPdf() {
        byte[] naoPdf = "conteudo qualquer".getBytes();
        assertThatThrownBy(() -> service.cadastrar(conta("Enel", "10.00", "2026-12-10", null), naoPdf, false))
                .isInstanceOf(DadosInvalidosException.class);

        byte[] pdfValido = "%PDF-1.4 teste".getBytes();
        Conta criada = service.cadastrar(conta("Enel", "10.00", "2026-12-10", "ANEXO-1"), pdfValido, false);
        assertThat(criada.anexoNome()).isEqualTo("nota-fiscal.pdf");
        assertThat(service.buscarAnexoPdf(criada.id())).isEqualTo(pdfValido);
    }

    @Test
    void deveDetectarDuplicataPorDocumentoIdenticoNaoVazio() {
        service.cadastrar(conta("Auto Posto Central", "100.00", "2026-12-10", "DOC-77"), null, false);

        assertThatThrownBy(() -> service.cadastrar(
                conta("Outro Fornecedor", "999.99", "2026-12-28", "doc-77"), null, false))
                .isInstanceOf(PossivelDuplicataException.class);
    }

    @Test
    void naoDeveCompararDuplicidadesDeMesesDiferentes() {
        service.cadastrar(conta("Auto Posto Central", "100.00", "2026-12-10", "DOC-MES"), null, false);

        Conta outroMes = service.cadastrar(
                conta("Auto Posto Central", "100.00", "2027-01-10", "DOC-MES"), null, false);
        assertThat(outroMes.id()).isNotNull();
    }

    @Test
    void deveDetectarDuplicataPorNomeParecidoEVencimentoProximo() {
        service.cadastrar(conta("Auto Posto Central", "200.00", "2026-12-10", "A1"), null, false);

        assertThatThrownBy(() -> service.cadastrar(
                conta("auto posto central ltda", "555.55", "2026-12-15", "B2"), null, false))
                .isInstanceOf(PossivelDuplicataException.class);
    }

    @Test
    void deveDetectarDuplicataPorNomeParecidoEValorParecidoComVencimentoDistanteNoMesmoMes() {
        service.cadastrar(conta("Auto Posto Central", "200.00", "2026-12-10", "A1"), null, false);

        assertThatThrownBy(() -> service.cadastrar(
                conta("Auto Posto Central", "300.00", "2026-12-28", "B2"), null, false))
                .isInstanceOf(PossivelDuplicataException.class);
    }

    @Test
    void limitesDaRegraDeDuplicidade() {
        service.cadastrar(conta("Auto Posto Central", "200.00", "2026-12-10", "A1"), null, false);

        assertThatThrownBy(() -> service.cadastrar(
                conta("Auto Posto Central", "999.99", "2026-12-15", null), null, false))
                .isInstanceOf(PossivelDuplicataException.class);

        assertThatThrownBy(() -> service.cadastrar(
                conta("Auto Posto Central", "50.00", "2026-12-16", null), null, false))
                .isInstanceOf(PossivelDuplicataException.class);

        Conta distinta = service.cadastrar(
                conta("Auto Posto Central", "49.99", "2026-12-16", null), null, false);
        assertThat(distinta.id()).isNotNull();
    }

    @Test
    void naoDeveConsiderarDuplicataSemDocumentoQuandoDemaisCamposDiferem() {
        service.cadastrar(conta("Auto Posto Central", "100.00", "2026-12-10", null), null, false);

        Conta segunda = service.cadastrar(
                conta("Padaria Nova Aurora", "900.00", "2026-12-28", null), null, false);
        assertThat(segunda.id()).isNotNull();
    }

    @Test
    void deveInserirMesmoComDuplicataQuandoForcar() {
        service.cadastrar(conta("Auto Posto Central", "100.00", "2026-12-10", "DOC-1"), null, false);

        Conta forcada = service.cadastrar(conta("Auto Posto Central", "100.00", "2026-12-10", "DOC-1"), null, true);
        assertThat(forcada.id()).isNotNull();
    }

    @Test
    void deveListarPorStatusAtualizarExcluirEPreservarAnexo() {
        byte[] pdf = "%PDF-1.4 original".getBytes();
        Conta criada = service.cadastrar(conta("Auto Posto Central", "10.00", "2026-12-10", "X"), pdf, false);

        assertThat(service.listar("PENDENTE")).hasSize(1);
        assertThat(service.listar("PAGO")).isEmpty();

        Conta editada = service.atualizar(criada.id(),
                conta("Auto Posto Central", "20.00", "2026-12-20", "X-EDITADO"), null);
        assertThat(editada.valor()).isEqualByComparingTo("20.00");
        assertThat(service.buscarPorId(criada.id()).numeroDocumento()).isEqualTo("X-EDITADO");
        assertThat(service.buscarAnexoPdf(criada.id())).isEqualTo(pdf);

        byte[] pdfNovo = "%PDF-1.4 novo".getBytes();
        service.atualizar(criada.id(), conta("Auto Posto Central", "20.00", "2026-12-20", "X-EDITADO"), pdfNovo);
        assertThat(service.buscarAnexoPdf(criada.id())).isEqualTo(pdfNovo);

        service.excluir(criada.id());
        assertThat(service.listar(null)).isEmpty();
    }

    @Test
    void deveRecusarAtualizacaoInexistente() {
        assertThatThrownBy(() -> service.atualizar(999, conta("Enel", "10.00", "2026-12-10", null), null))
                .isInstanceOf(RecursoNaoEncontradoException.class);
    }
}
