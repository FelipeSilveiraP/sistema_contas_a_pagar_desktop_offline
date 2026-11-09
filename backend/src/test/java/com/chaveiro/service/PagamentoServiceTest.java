package com.chaveiro.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.chaveiro.database.ConnectionFactory;
import com.chaveiro.database.DatabaseInitializer;
import com.chaveiro.model.Conta;
import com.chaveiro.model.Pagamento;
import com.chaveiro.repository.ContaRepository;
import com.chaveiro.repository.PagamentoRepository;
import java.math.BigDecimal;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

/**
 * Regras de pagamento sobre SQLite real (banco isolado em tmp).
 */
class PagamentoServiceTest {

    @TempDir
    Path pastaTemporaria;

    private PagamentoService service;
    private ContaRepository contas;
    private long idConta;

    @BeforeEach
    void preparar() throws Exception {
        ConnectionFactory conexao = new ConnectionFactory(pastaTemporaria.resolve("contas_teste.db").toString());
        new DatabaseInitializer(conexao).inicializar();
        contas = new ContaRepository(conexao);
        service = new PagamentoService(new PagamentoRepository(conexao), contas);
        idConta = contas.inserir(new Conta(null, "Enel Energia", null, null, "Balcão 01", "PJ",
                "boleto", "Utilidades", "NF-1", new BigDecimal("150.00"),
                LocalDate.parse("2026-12-10"), false, null, "PENDENTE"), null).id();
    }

    private Pagamento dados(String valor, String data) {
        return new Pagamento(null, idConta, LocalDate.parse(data), new BigDecimal(valor), null, null, null, null);
    }

    @Test
    void baixaDeveSerAtomicaPagamentoMaisStatusPago() throws Exception {
        Pagamento pago = service.registrar(idConta, dados("150.00", "2026-12-11"));

        assertThat(pago.id()).isNotNull();
        assertThat(contas.buscarPorId(idConta).orElseThrow().status()).isEqualTo("PAGO");
        assertThat(service.buscarPorConta(idConta).valorPago()).isEqualByComparingTo("150.00");
    }

    @Test
    void deveImpedirSegundoPagamentoParaAMesmaConta() {
        service.registrar(idConta, dados("150.00", "2026-12-11"));

        assertThatThrownBy(() -> service.registrar(idConta, dados("99.00", "2026-12-20")))
                .isInstanceOf(ConflitoIntegridadeException.class);
    }

    @Test
    void estornoDeveSerAtomicoPagamentoRemovidoMaisStatusPendente() throws Exception {
        service.registrar(idConta, dados("150.00", "2026-12-11"));

        service.estornar(idConta);

        assertThat(contas.buscarPorId(idConta).orElseThrow().status()).isEqualTo("PENDENTE");
        assertThatThrownBy(() -> service.buscarPorConta(idConta))
                .isInstanceOf(RecursoNaoEncontradoException.class);
    }

    @Test
    void valorPagoPodeDiferirDoOriginalPorJurosOuDesconto() {
        Pagamento pago = service.registrar(idConta, dados("172.50", "2026-12-11"));

        assertThat(pago.valorPago()).isEqualByComparingTo("172.50");
    }

    @Test
    void deveValidarValorEDataDoPagamento() {
        assertThatThrownBy(() -> service.registrar(idConta, dados("0.00", "2026-12-11")))
                .isInstanceOf(DadosInvalidosException.class);
        assertThatThrownBy(() -> service.registrar(idConta,
                new Pagamento(null, idConta, null, new BigDecimal("10.00"), null, null, null, null)))
                .isInstanceOf(DadosInvalidosException.class);
    }

    @Test
    void deveCorrigirPagamentoExistente() {
        service.registrar(idConta, dados("150.00", "2026-12-11"));
        Pagamento atual = service.buscarPorConta(idConta);

        Pagamento corrigido = service.atualizar(atual.id(), dados("145.00", "2026-12-12"));

        assertThat(corrigido.valorPago()).isEqualByComparingTo("145.00");
        assertThat(corrigido.dataPagamento()).isEqualTo(LocalDate.parse("2026-12-12"));
    }

    @Test
    void deveListarPagamentosComDadosDaConta() {
        service.registrar(idConta, dados("150.00", "2026-12-11"));

        List<Pagamento> lista = service.listar();
        assertThat(lista).hasSize(1);
        assertThat(lista.get(0).nomeEmpresa()).isEqualTo("Enel Energia");
    }
}
