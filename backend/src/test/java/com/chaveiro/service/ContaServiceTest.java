package com.chaveiro.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.chaveiro.database.ConnectionFactory;
import com.chaveiro.database.DatabaseInitializer;
import com.chaveiro.model.Conta;
import com.chaveiro.model.Empresa;
import com.chaveiro.model.Pagador;
import com.chaveiro.repository.ContaRepository;
import com.chaveiro.repository.EmpresaRepository;
import com.chaveiro.repository.PagadorRepository;
import java.math.BigDecimal;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

/**
 * Regras das contas a pagar sobre SQLite real (banco de teste isolado em tmp),
 * incluindo o filtro de duplicidade do sistema legado.
 */
class ContaServiceTest {

    @TempDir
    Path pastaTemporaria;

    private ContaService service;
    private ContaRepository repository;
    private long idEmpresa;
    private long idPagador;

    @BeforeEach
    void preparar() throws Exception {
        ConnectionFactory conexao = new ConnectionFactory(pastaTemporaria.resolve("contas_teste.db").toString());
        new DatabaseInitializer(conexao).inicializar();
        repository = new ContaRepository(conexao);
        service = new ContaService(repository);
        Empresa empresa = new EmpresaRepository(conexao).inserir(
                new Empresa(null, null, "Auto Posto Central", null, null, null, List.of()));
        idEmpresa = empresa.id();
        Pagador pagador = new PagadorRepository(conexao).inserir(
                new Pagador(null, "Maria Souza", null, null));
        idPagador = pagador.id();
    }

    private Conta conta(String razao, String valor, String vencimento, String doc) {
        return new Conta(null, idEmpresa, razao, idPagador, "Maria Souza", "Aluguel",
                doc, new BigDecimal(valor), LocalDate.parse(vencimento), false, "PENDENTE");
    }

    @Test
    void deveCadastrarContaValidaComStatusPendente() {
        Conta criada = service.cadastrar(conta("Auto Posto Central", "123.45", "2026-12-10", "NF-1"), false);

        assertThat(criada.id()).isNotNull();
        assertThat(criada.status()).isEqualTo("PENDENTE");
        assertThat(criada.valor()).isEqualByComparingTo("123.45");
        assertThat(criada.razaoSocial()).isEqualTo("Auto Posto Central");
        assertThat(criada.nomePagador()).isEqualTo("Maria Souza");
    }

    @Test
    void devePreservarPrecisaoMonetariaDeCentavos() {
        Conta criada = service.cadastrar(conta("Auto Posto Central", "0.01", "2026-12-10", null), false);

        assertThat(service.buscarPorId(criada.id()).valor()).isEqualByComparingTo("0.01");
    }

    @Test
    void deveRecusarValorZeroNegativoOuComTresCasas() {
        assertThatThrownBy(() -> service.cadastrar(conta("Auto Posto Central", "0.00", "2026-12-10", null), false))
                .isInstanceOf(DadosInvalidosException.class)
                .hasMessageContaining("dados invalidos");
        assertThatThrownBy(() -> service.cadastrar(conta("Auto Posto Central", "-1.00", "2026-12-10", null), false))
                .isInstanceOf(DadosInvalidosException.class);
        assertThatThrownBy(() -> service.cadastrar(conta("Auto Posto Central", "1.234", "2026-12-10", null), false))
                .isInstanceOf(DadosInvalidosException.class);
    }

    @Test
    void deveRecusarContaSemVencimentoOuSemEmpresa() {
        assertThatThrownBy(() -> service.cadastrar(
                new Conta(null, idEmpresa, "Auto Posto Central", null, null, null, null,
                        new BigDecimal("10.00"), null, false, "PENDENTE"), false))
                .isInstanceOf(DadosInvalidosException.class);
        assertThatThrownBy(() -> service.cadastrar(
                new Conta(null, null, "Auto Posto Central", null, null, null, null,
                        new BigDecimal("10.00"), LocalDate.parse("2026-12-10"), false, "PENDENTE"), false))
                .isInstanceOf(DadosInvalidosException.class);
    }

    @Test
    void deveDetectarDuplicataPorDocumentoIdenticoNaoVazio() {
        service.cadastrar(conta("Auto Posto Central", "100.00", "2026-12-10", "DOC-77"), false);

        assertThatThrownBy(() -> service.cadastrar(
                conta("Outro Fornecedor", "999.99", "2027-01-01", "doc-77"), false))
                .isInstanceOf(PossivelDuplicataException.class);
    }

    @Test
    void naoDeveConsiderarDuplicataSemDocumentoQuandoDemaisCamposDiferem() {
        service.cadastrar(conta("Auto Posto Central", "100.00", "2026-12-10", null), false);

        // fornecedor diferente, vencimento distante e valor distante: nao e duplicata
        // (a clausula de documento igual nao se aplica a documentos vazios)
        Conta segunda = service.cadastrar(
                conta("Padaria Nova Aurora", "900.00", "2027-06-20", null), false);
        assertThat(segunda.id()).isNotNull();
    }

    @Test
    void deveDetectarDuplicataPorNomeParecidoEVencimentoProximo() {
        service.cadastrar(conta("Auto Posto Central", "200.00", "2026-12-10", "A1"), false);

        assertThatThrownBy(() -> service.cadastrar(
                conta("auto posto central ltda", "555.55", "2026-12-15", "B2"), false))
                .isInstanceOf(PossivelDuplicataException.class);
    }

    @Test
    void deveDetectarDuplicataPorNomeParecidoEValorParecidoMesmoComVencimentoDistante() {
        service.cadastrar(conta("Auto Posto Central", "200.00", "2026-12-10", "A1"), false);

        assertThatThrownBy(() -> service.cadastrar(
                conta("Auto Posto Central", "300.00", "2027-03-01", "B2"), false))
                .isInstanceOf(PossivelDuplicataException.class);
    }

    @Test
    void limitesDaRegraDeDuplicidade() {
        service.cadastrar(conta("Auto Posto Central", "200.00", "2026-12-10", "A1"), false);

        // exatamente 5 dias de diferenca: duplicata
        assertThatThrownBy(() -> service.cadastrar(
                conta("Auto Posto Central", "999.99", "2026-12-15", null), false))
                .isInstanceOf(PossivelDuplicataException.class);

        // 6 dias e exatamente R$ 150,00 de diferenca: duplicata (tolerancia inclusiva)
        assertThatThrownBy(() -> service.cadastrar(
                conta("Auto Posto Central", "50.00", "2026-12-16", null), false))
                .isInstanceOf(PossivelDuplicataException.class);

        // 6 dias e R$ 150,01 de diferenca: NAO duplicata
        Conta distinta = service.cadastrar(
                conta("Auto Posto Central", "49.99", "2026-12-16", null), false);
        assertThat(distinta.id()).isNotNull();
    }

    @Test
    void deveInserirMesmoComDuplicataQuandoForcar() {
        service.cadastrar(conta("Auto Posto Central", "100.00", "2026-12-10", "DOC-1"), false);

        Conta forcada = service.cadastrar(conta("Auto Posto Central", "100.00", "2026-12-10", "DOC-1"), true);
        assertThat(forcada.id()).isNotNull();
    }

    @Test
    void deveListarPorStatusEAtualizarExcluir() {
        Conta criada = service.cadastrar(conta("Auto Posto Central", "10.00", "2026-12-10", "X"), false);

        assertThat(service.listar("PENDENTE")).hasSize(1);
        assertThat(service.listar("PAGO")).isEmpty();
        assertThat(service.listar(null)).hasSize(1);

        Conta editada = service.atualizar(criada.id(),
                conta("Auto Posto Central", "20.00", "2026-12-20", "X-EDITADO"));
        assertThat(editada.valor()).isEqualByComparingTo("20.00");
        assertThat(service.buscarPorId(criada.id()).numeroDocumento()).isEqualTo("X-EDITADO");

        service.excluir(criada.id());
        assertThat(service.listar(null)).isEmpty();
    }

    @Test
    void deveRecusarAtualizacaoInexistente() {
        assertThatThrownBy(() -> service.atualizar(999, conta("Auto Posto Central", "10.00", "2026-12-10", null)))
                .isInstanceOf(RecursoNaoEncontradoException.class);
    }
}
