package com.chaveiro.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.chaveiro.database.ConnectionFactory;
import com.chaveiro.database.DatabaseInitializer;
import com.chaveiro.model.BoletoRecorrente;
import com.chaveiro.model.Conta;
import com.chaveiro.model.Pagamento;
import com.chaveiro.repository.BoletoRecorrenteRepository;
import com.chaveiro.repository.ContaRepository;
import com.chaveiro.repository.PagamentoRepository;
import java.math.BigDecimal;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

/**
 * Gatilhos e transacoes de seguranca (migracao v17) sobre SQLite real em tmp.
 */
class SegurancaBancoTest {

    @TempDir
    Path pastaTemporaria;

    private ConnectionFactory conexao;
    private ContaRepository contas;
    private ContaService contaService;
    private PagamentoService pagamentoService;
    private long idConta;

    @BeforeEach
    void preparar() throws Exception {
        conexao = new ConnectionFactory(pastaTemporaria.resolve("seguranca.db").toString());
        new DatabaseInitializer(conexao).inicializar();
        contas = new ContaRepository(conexao);
        contaService = new ContaService(contas);
        pagamentoService = new PagamentoService(new PagamentoRepository(conexao), contas);
        idConta = contas.inserir(conta("Enel Energia", "2026-12-10"), null).id();
    }

    private static Conta conta(String nome, String vencimento) {
        return new Conta(null, nome, null, null, "Balcão 01", "PJ", "boleto", "Utilidades", null,
                new BigDecimal("150.00"), LocalDate.parse(vencimento), false, null, true, null, "PENDENTE");
    }

    private void pagar(long id) {
        pagamentoService.registrar(id, new Pagamento(null, id, LocalDate.parse("2026-12-11"),
                new BigDecimal("150.00"), null, null, null, null));
    }

    private void sql(String comando) throws SQLException {
        try (Connection conn = conexao.getConnection(); Statement stmt = conn.createStatement()) {
            stmt.execute(comando);
        }
    }

    private int contar(String consulta) throws SQLException {
        try (Connection conn = conexao.getConnection(); Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery(consulta)) {
            return rs.next() ? rs.getInt(1) : 0;
        }
    }

    private List<String> auditoria(String tabela, long id) throws SQLException {
        List<String> ops = new ArrayList<>();
        try (Connection conn = conexao.getConnection(); Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery("SELECT operacao FROM auditoria_operacoes WHERE tabela = '"
                     + tabela + "' AND id_registro = " + id + " ORDER BY id_auditoria")) {
            while (rs.next()) {
                ops.add(rs.getString(1));
            }
        }
        return ops;
    }

    @Test
    void contaPagaNaoPodeSerExcluidaENemOPagamentoSome() throws Exception {
        pagar(idConta);

        assertThatThrownBy(() -> contaService.excluir(idConta)).isInstanceOf(ConflitoIntegridadeException.class);
        assertThat(contas.buscarPorId(idConta)).isPresent();
        assertThat(contar("SELECT COUNT(*) FROM pagamentos WHERE id_conta = " + idConta)).isEqualTo(1);
        // ate um DELETE direto no banco e recusado
        assertThatThrownBy(() -> sql("DELETE FROM contas_a_pagar WHERE id_conta = " + idConta))
                .hasMessageContaining("CONTA_COM_PAGAMENTO");
    }

    @Test
    void contaPendenteContinuaPodendoSerExcluida() throws Exception {
        contaService.excluir(idConta);
        assertThat(contas.buscarPorId(idConta)).isEmpty();
    }

    @Test
    void statusSempreCoerenteComOPagamento() throws Exception {
        assertThatThrownBy(() -> sql("UPDATE contas_a_pagar SET status = 'PAGO' WHERE id_conta = " + idConta))
                .hasMessageContaining("STATUS_INVALIDO");
        assertThatThrownBy(() -> sql("INSERT INTO contas_a_pagar (nome_empresa, pagador_responsavel, forma_pagamento,"
                + " valor_centavos, vencimento, status) VALUES ('X', 'Y', 'boleto', 100, '2026-12-01', 'PAGO')"))
                .hasMessageContaining("STATUS_INVALIDO");

        pagar(idConta);
        assertThatThrownBy(() -> sql("UPDATE contas_a_pagar SET status = 'PENDENTE' WHERE id_conta = " + idConta))
                .hasMessageContaining("STATUS_INVALIDO");
        // o fluxo normal (estorno) segue funcionando
        pagamentoService.estornar(idConta);
        assertThat(contas.buscarPorId(idConta).orElseThrow().status()).isEqualTo("PENDENTE");
    }

    @Test
    void pagamentoNaoMudaDeConta() throws Exception {
        long outra = contas.inserir(conta("Sabesp", "2026-12-15"), null).id();
        pagar(idConta);
        assertThatThrownBy(() -> sql("UPDATE pagamentos SET id_conta = " + outra + " WHERE id_conta = " + idConta))
                .hasMessageContaining("PAGAMENTO_INVALIDO");
    }

    @Test
    void auditoriaRegistraContasEPagamentosEEhSomenteLeitura() throws Exception {
        Conta atual = contas.buscarPorId(idConta).orElseThrow();
        contaService.atualizar(idConta, new Conta(null, "Enel Energia SP", null, null, atual.pagadorResponsavel(),
                atual.tipoPessoa(), atual.formaPagamento(), atual.categoria(), null, new BigDecimal("175.00"),
                atual.vencimento(), false, null, true, null, null), null);
        pagar(idConta);
        long idPagamento = pagamentoService.buscarPorConta(idConta).id();
        pagamentoService.estornar(idConta);
        contaService.excluir(idConta);

        // INSERT, UPDATE (dados), UPDATE (PAGO), UPDATE (PENDENTE), DELETE
        assertThat(auditoria("contas_a_pagar", idConta)).containsExactly("INSERT", "UPDATE", "UPDATE", "UPDATE", "DELETE");
        assertThat(auditoria("pagamentos", idPagamento)).containsExactly("INSERT", "DELETE");
        assertThat(contar("SELECT COUNT(*) FROM auditoria_operacoes WHERE tabela = 'contas_a_pagar'"
                + " AND operacao = 'UPDATE' AND json_extract(antes, '$.valor_centavos') = 15000"
                + " AND json_extract(depois, '$.valor_centavos') = 17500")).isEqualTo(1);

        assertThatThrownBy(() -> sql("DELETE FROM auditoria_operacoes"))
                .hasMessageContaining("AUDITORIA_SOMENTE_LEITURA");
        assertThatThrownBy(() -> sql("UPDATE auditoria_operacoes SET operacao = 'INSERT'"))
                .hasMessageContaining("AUDITORIA_SOMENTE_LEITURA");
    }

    @Test
    void recorrenciaEhAtomicaSeUmaContaFalharNadaFicaGravado() throws Exception {
        // simula uma falha no meio da geracao: a 3a conta gerada e recusada pelo banco
        sql("CREATE TRIGGER teste_falha_na_terceira BEFORE INSERT ON contas_a_pagar"
                + " WHEN NEW.id_recorrente IS NOT NULL"
                + " AND (SELECT COUNT(*) FROM contas_a_pagar WHERE id_recorrente IS NOT NULL) >= 2"
                + " BEGIN SELECT RAISE(ABORT, 'falha simulada'); END");
        BoletoRecorrenteRepository recorrentes = new BoletoRecorrenteRepository(conexao);
        BoletoRecorrenteService service = new BoletoRecorrenteService(recorrentes, contas);
        int contasAntes = contar("SELECT COUNT(*) FROM contas_a_pagar");

        assertThatThrownBy(() -> service.cadastrar(new BoletoRecorrente(null, "Aluguel", null, "Gerência", null,
                null, new BigDecimal("1500.00"), 10, "MENSAL", "boleto", true, "PJ")))
                .isInstanceOf(IllegalStateException.class);

        assertThat(contar("SELECT COUNT(*) FROM boletos_recorrentes")).isZero();
        assertThat(contar("SELECT COUNT(*) FROM contas_a_pagar")).isEqualTo(contasAntes);
    }

    @Test
    void bancoNaVersaoAnteriorGanhaOsGatilhosSemPerderDados() throws Exception {
        pagar(idConta);
        // volta o banco para a v16 (sem gatilhos nem auditoria), com os dados dentro
        for (String gatilho : List.of("trg_conta_paga_nao_exclui", "trg_conta_nasce_pendente",
                "trg_status_pago_exige_pagamento", "trg_status_pendente_sem_pagamento", "trg_pagamento_nao_troca_conta",
                "trg_auditoria_conta_insert", "trg_auditoria_conta_update", "trg_auditoria_conta_delete",
                "trg_auditoria_pagamento_insert", "trg_auditoria_pagamento_update", "trg_auditoria_pagamento_delete",
                "trg_auditoria_nao_altera", "trg_auditoria_nao_apaga")) {
            sql("DROP TRIGGER " + gatilho);
        }
        sql("DROP TABLE auditoria_operacoes");
        sql("PRAGMA user_version = 16");

        DatabaseInitializer inicializador = new DatabaseInitializer(conexao);
        inicializador.inicializar();

        assertThat(inicializador.lerVersao()).isEqualTo(17);
        assertThat(contas.buscarPorId(idConta).orElseThrow().status()).isEqualTo("PAGO");
        assertThat(contar("SELECT COUNT(*) FROM pagamentos WHERE id_conta = " + idConta)).isEqualTo(1);
        assertThat(contar("SELECT COUNT(*) FROM sqlite_master WHERE type = 'trigger' AND name LIKE 'trg_%'")).isEqualTo(13);
        assertThatThrownBy(() -> contaService.excluir(idConta)).isInstanceOf(ConflitoIntegridadeException.class);
    }
}
