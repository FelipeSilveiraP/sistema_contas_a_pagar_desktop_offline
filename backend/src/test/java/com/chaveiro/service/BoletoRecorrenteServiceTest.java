package com.chaveiro.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.chaveiro.database.ConnectionFactory;
import com.chaveiro.database.DatabaseInitializer;
import com.chaveiro.model.BoletoRecorrente;
import com.chaveiro.model.Conta;
import com.chaveiro.repository.BoletoRecorrenteRepository;
import com.chaveiro.repository.ContaRepository;
import java.math.BigDecimal;
import java.nio.file.Path;
import java.time.YearMonth;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class BoletoRecorrenteServiceTest {

    @TempDir
    Path pastaTemporaria;

    private BoletoRecorrenteService service;
    private BoletoRecorrenteRepository repository;
    private ContaRepository contas;

    @BeforeEach
    void preparar() throws Exception {
        ConnectionFactory conexao = new ConnectionFactory(pastaTemporaria.resolve("contas_teste.db").toString());
        new DatabaseInitializer(conexao).inicializar();
        repository = new BoletoRecorrenteRepository(conexao);
        contas = new ContaRepository(conexao);
        service = new BoletoRecorrenteService(repository, contas);
    }

    private BoletoRecorrente recorrente(int dia, String periodicidade) {
        return new BoletoRecorrente(null, "Aluguel do Galpão", null, "Gerência", "Aluguel & Taxas",
                null, new BigDecimal("1500.00"), dia, periodicidade, "boleto", true);
    }

    @Test
    void deveAjustarDiaInexistenteParaOUltimoDiaDoMes() {
        // regra aprovada: dia 31 em fevereiro vira 28/29; marco volta a 31
        assertThat(BoletoRecorrenteService.vencimentoDoMes(YearMonth.of(2026, 2), 31).getDayOfMonth()).isEqualTo(28);
        assertThat(BoletoRecorrenteService.vencimentoDoMes(YearMonth.of(2028, 2), 31).getDayOfMonth()).isEqualTo(29);
        assertThat(BoletoRecorrenteService.vencimentoDoMes(YearMonth.of(2026, 1), 31).getDayOfMonth()).isEqualTo(31);
        assertThat(BoletoRecorrenteService.vencimentoDoMes(YearMonth.of(2026, 4), 31).getDayOfMonth()).isEqualTo(30);
    }

    @Test
    void deveGerarContasComAntiDuplicacao() throws Exception {
        BoletoRecorrente criado = service.cadastrar(recorrente(10, "MENSAL"));

        List<Conta> geradas = contas.listar(null);
        assertThat(geradas).hasSize(12);
        assertThat(geradas.get(0).vencimento().getDayOfMonth()).isEqualTo(10);

        // regerar nao duplica
        int novas = service.gerarContas(criado);
        assertThat(novas).isZero();
        assertThat(contas.listar(null)).hasSize(12);
    }

    @Test
    void deveRespeitarPeriodicidade() throws Exception {
        service.cadastrar(recorrente(15, "TRIMESTRAL"));
        List<Conta> geradas = contas.listar(null);
        assertThat(geradas).hasSize(4);
    }

    @Test
    void devePreservarVinculoEExcluirApenasContasNaoPagas() throws Exception {
        BoletoRecorrente criado = service.cadastrar(recorrente(5, "MENSAL"));
        List<Conta> geradas = contas.listar(null);
        Conta paga = geradas.get(0);

        // baixa real (transacao pagamento + status)
        new com.chaveiro.repository.PagamentoRepository(new ConnectionFactory(pastaTemporaria.resolve("contas_teste.db").toString()))
                .registrar(paga.id(), new com.chaveiro.model.Pagamento(null, paga.id(),
                        java.time.LocalDate.parse("2026-12-11"), paga.valor(), null, null, null, null));

        service.excluir(criado.id());

        List<Conta> restantes = contas.listar(null);
        assertThat(restantes).hasSize(1);
        assertThat(restantes.get(0).status()).isEqualTo("PAGO");
    }

    @Test
    void deveValidarDadosDaRecorrencia() {
        assertThatThrownBy(() -> service.cadastrar(recorrente(0, "MENSAL")))
                .isInstanceOf(DadosInvalidosException.class);
        assertThatThrownBy(() -> service.cadastrar(recorrente(10, "SEMANAL")))
                .isInstanceOf(DadosInvalidosException.class);
        assertThatThrownBy(() -> service.cadastrar(new BoletoRecorrente(null, "A", null, "B",
                null, null, BigDecimal.ZERO, 10, "MENSAL", null, true)))
                .isInstanceOf(DadosInvalidosException.class);
    }
}
