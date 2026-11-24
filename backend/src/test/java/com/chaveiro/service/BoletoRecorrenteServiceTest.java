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
import java.time.LocalDate;
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
                null, new BigDecimal("1500.00"), dia, periodicidade, "boleto", true, "PJ");
    }

    @Test
    void deveGerarContasComOTipoPessoaEscolhidoNoFormulario() throws Exception {
        // antes o PF escolhido era descartado e as contas saiam sempre PJ
        service.cadastrar(new BoletoRecorrente(null, "Diarista", null, "Gerência", null, null,
                new BigDecimal("300.00"), 5, "MENSAL", "debito", true, "PF"));

        List<Conta> geradas = contas.listar(null);
        assertThat(geradas).isNotEmpty().allSatisfy(c -> {
            assertThat(c.tipoPessoa()).isEqualTo("PF");
            assertThat(c.formaPagamento()).isEqualTo("debito");
        });
        assertThat(service.listar()).singleElement().extracting(BoletoRecorrente::tipoPessoa).isEqualTo("PF");
    }

    @Test
    void deveRecusarFormatoDePagamentoForaDoDominioDasContas() {
        assertThatThrownBy(() -> service.cadastrar(new BoletoRecorrente(null, "Aluguel", null, "Gerência", null, null,
                new BigDecimal("100.00"), 10, "MENSAL", "cheque", true, "PJ")))
                .isInstanceOf(DadosInvalidosException.class)
                .satisfies(e -> assertThat(((DadosInvalidosException) e).getCampos()).containsKey("formaPagamento"));
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
    void naoAceitaContaRecorrenteIgual() throws Exception {
        service.cadastrar(recorrente(10, "MENSAL"));
        int contasAntes = contas.listar(null).size();
        // igual (inclusive com maiuscula/espacos diferentes no nome): recusada, nada novo gravado
        assertThatThrownBy(() -> service.cadastrar(recorrente(10, "MENSAL")))
                .isInstanceOf(ConflitoIntegridadeException.class);
        assertThatThrownBy(() -> service.cadastrar(new BoletoRecorrente(null, "  aluguel DO galpão ", null, "Outro", null,
                null, new BigDecimal("1500.00"), 10, "MENSAL", "pix", true, "PJ")))
                .isInstanceOf(ConflitoIntegridadeException.class);
        assertThat(service.listar()).hasSize(1);
        assertThat(contas.listar(null)).hasSize(contasAntes);
        // diferente em valor, dia ou frequencia: e outra recorrencia, pode
        service.cadastrar(new BoletoRecorrente(null, "Aluguel do Galpão", null, "Gerência", null, null,
                new BigDecimal("900.00"), 10, "MENSAL", "boleto", true, "PJ"));
        service.cadastrar(recorrente(20, "MENSAL"));
        service.cadastrar(recorrente(10, "TRIMESTRAL"));
        assertThat(service.listar()).hasSize(4);
    }

    @Test
    void editarNaoPodeDeixarIgualAOutra() throws Exception {
        service.cadastrar(recorrente(10, "MENSAL"));
        BoletoRecorrente outra = service.cadastrar(recorrente(20, "MENSAL"));
        assertThatThrownBy(() -> service.atualizar(outra.id(), recorrente(10, "MENSAL")))
                .isInstanceOf(ConflitoIntegridadeException.class);
        // editar outro campo da propria recorrencia continua permitido
        BoletoRecorrente editada = service.atualizar(outra.id(), new BoletoRecorrente(null, "Aluguel do Galpão", null,
                "Financeiro", null, null, new BigDecimal("1500.00"), 20, "MENSAL", "pix", true, "PJ")).recorrente();
        assertThat(editada.pagadorResponsavel()).isEqualTo("FINANCEIRO");
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
    void editarContaFixaMudaTodasAsContasNaoPagasDeTodosOsMeses() throws Exception {
        BoletoRecorrente criado = service.cadastrar(recorrente(31, "MENSAL"));
        List<Conta> geradas = contas.listar(null);
        assertThat(geradas).hasSize(12);
        Conta paga = geradas.get(0);
        new com.chaveiro.repository.PagamentoRepository(new ConnectionFactory(pastaTemporaria.resolve("contas_teste.db").toString()))
                .registrar(paga.id(), new com.chaveiro.model.Pagamento(null, paga.id(),
                        java.time.LocalDate.now(), paga.valor(), null, null, null, null));
        // ajuste feito so num mes (em Todas as Contas): o valor de uma competencia
        Conta ajustada = geradas.get(5);
        try (var c = new ConnectionFactory(pastaTemporaria.resolve("contas_teste.db").toString()).getConnection();
             var st = c.createStatement()) {
            st.executeUpdate("UPDATE contas_a_pagar SET valor_centavos = 99900 WHERE id_conta = " + ajustada.id());
        }

        // muda empresa, pagador, conta, formato e dia (mantem o valor)
        var feita = service.atualizar(criado.id(), new BoletoRecorrente(null, "aluguel novo", null, "livia", null, null,
                new BigDecimal("1500.00"), 10, "MENSAL", "pix", true, "PF"));
        assertThat(feita.contasAlteradas()).isEqualTo(11);
        assertThat(feita.recorrente().nomeEmpresa()).isEqualTo("ALUGUEL NOVO");

        for (Conta c : contas.listar(null)) {
            if (c.id().equals(paga.id())) {
                // a paga fica como estava (historico)
                assertThat(c.nomeEmpresa()).isEqualTo("ALUGUEL DO GALPÃO");
                assertThat(c.vencimento()).isEqualTo(paga.vencimento());
                continue;
            }
            assertThat(c.nomeEmpresa()).isEqualTo("ALUGUEL NOVO");
            assertThat(c.pagadorResponsavel()).isEqualTo("LIVIA");
            assertThat(c.tipoPessoa()).isEqualTo("PF");
            assertThat(c.formaPagamento()).isEqualTo("pix");
            // mesmo mes, dia novo
            assertThat(c.vencimento().getDayOfMonth()).isEqualTo(10);
            Conta original = geradas.stream().filter(g -> g.id().equals(c.id())).findFirst().orElseThrow();
            assertThat(YearMonth.from(c.vencimento())).isEqualTo(YearMonth.from(original.vencimento()));
            // o valor nao foi mexido na conta fixa: o ajuste do mes continua
            assertThat(c.valor()).isEqualByComparingTo(c.id().equals(ajustada.id()) ? "999.00" : "1500.00");
        }

        // agora muda o valor: vale para todas as nao pagas (inclusive a ajustada)
        service.atualizar(criado.id(), new BoletoRecorrente(null, "aluguel novo", null, "livia", null, null,
                new BigDecimal("1750.50"), 10, "MENSAL", "pix", true, "PF"));
        assertThat(contas.listar(null)).filteredOn(c -> !c.id().equals(paga.id()))
                .allSatisfy(c -> assertThat(c.valor()).isEqualByComparingTo("1750.50"));
        assertThat(contas.listar(null)).filteredOn(c -> c.id().equals(paga.id()))
                .singleElement().satisfies(c -> assertThat(c.valor()).isEqualByComparingTo("1500.00"));

        // a frequencia nao muda pela edicao
        assertThatThrownBy(() -> service.atualizar(criado.id(), new BoletoRecorrente(null, "aluguel novo", null, "livia",
                null, null, new BigDecimal("1750.50"), 10, "TRIMESTRAL", "pix", true, "PF")))
                .isInstanceOf(DadosInvalidosException.class);
    }

    @Test
    void deveValidarDadosDaRecorrencia() {
        assertThatThrownBy(() -> service.cadastrar(recorrente(0, "MENSAL")))
                .isInstanceOf(DadosInvalidosException.class);
        assertThatThrownBy(() -> service.cadastrar(recorrente(10, "SEMANAL")))
                .isInstanceOf(DadosInvalidosException.class);
        assertThatThrownBy(() -> service.cadastrar(new BoletoRecorrente(null, "A", null, "B",
                null, null, BigDecimal.ZERO, 10, "MENSAL", null, true, "PJ")))
                .isInstanceOf(DadosInvalidosException.class);
    }

    // ---------- filtro forte no Inserir Conta (pedido do usuario, 2026-11-24) ----------

    private Conta contaNova(String nome, String vencimento) {
        return new Conta(null, nome, null, null, "Gerência", "PJ", "boleto", null, null,
                new BigDecimal("1500.00"), LocalDate.parse(vencimento), false, null, true, null, "PENDENTE");
    }

    @Test
    void contaQueJaEstaNasRecorrentesEAvisadaComAContaDoMes() throws Exception {
        service.cadastrar(recorrente(10, "MENSAL"));
        Conta gerada = contas.listar(null).get(0);
        ContaService contaService = new ContaService(contas);
        // nome parecido ("ALUGUEL" esta dentro de "ALUGUEL DO GALPAO") e vencimento em outro dia do mes
        assertThatThrownBy(() -> contaService.cadastrar(contaNova("aluguel", gerada.vencimento().withDayOfMonth(25).toString()), null, false))
                .isInstanceOfSatisfying(PossivelDuplicataException.class, e -> {
                    assertThat(e.getRecorrente()).isNotNull();
                    assertThat(e.getRecorrente().dia()).isEqualTo(10);
                    assertThat(e.getExistente()).isNotNull();
                    assertThat(e.getExistente().id()).isEqualTo(gerada.id());
                });
    }

    @Test
    void recorrenteSemContaNoMesTambemBloqueiaEForcarInsere() throws Exception {
        service.cadastrar(recorrente(10, "MENSAL"));
        ContaService contaService = new ContaService(contas);
        Conta distante = contaNova("ALUGUEL DO GALPÃO", "2040-01-10");
        assertThatThrownBy(() -> contaService.cadastrar(distante, null, false))
                .isInstanceOfSatisfying(PossivelDuplicataException.class, e -> {
                    assertThat(e.getRecorrente()).isNotNull();
                    assertThat(e.getExistente()).isNull();
                });
        // "quer realmente ter uma duplicata?" -> SIM: grava
        assertThat(contaService.cadastrar(distante, null, true).id()).isNotNull();
    }

    @Test
    void contaComNomeDiferenteDaRecorrenteNaoBloqueia() throws Exception {
        service.cadastrar(recorrente(10, "MENSAL"));
        ContaService contaService = new ContaService(contas);
        assertThat(contaService.cadastrar(contaNova("ENERGIA CEMIG", "2040-01-10"), null, false).id()).isNotNull();
    }
}
