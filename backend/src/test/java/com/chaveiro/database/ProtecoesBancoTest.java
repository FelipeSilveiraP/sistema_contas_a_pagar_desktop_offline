package com.chaveiro.database;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.nio.file.Path;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

/** v22: gatilhos de protecao e auditoria completa (pedido do usuario, 2026-11-23). */
class ProtecoesBancoTest {

    @TempDir
    Path pasta;

    private ConnectionFactory conexao;

    @BeforeEach
    void preparar() {
        conexao = new ConnectionFactory(pasta.resolve("contas.db").toString());
        new DatabaseInitializer(conexao).inicializar();
    }

    private void sql(String comando) throws SQLException {
        try (Connection c = conexao.getConnection(); Statement st = c.createStatement()) {
            st.execute(comando);
        }
    }

    private String texto(String consulta) throws SQLException {
        try (Connection c = conexao.getConnection(); Statement st = c.createStatement(); ResultSet rs = st.executeQuery(consulta)) {
            return rs.next() ? rs.getString(1) : null;
        }
    }

    private void conta(String vencimento) throws SQLException {
        sql("INSERT INTO contas_a_pagar (nome_empresa, pagador_responsavel, forma_pagamento, valor_centavos, vencimento)"
                + " VALUES ('LUZ', 'FELIPE', 'BOLETO', 1000, '" + vencimento + "')");
    }

    @Test
    void versaoVinteEDois() throws SQLException {
        assertThat(texto("PRAGMA user_version")).isEqualTo("22");
    }

    @Test
    void datasSoDoCalendario() throws SQLException {
        assertThatThrownBy(() -> conta("2026-02-30")).hasMessageContaining("DATA_INVALIDA");
        assertThatThrownBy(() -> conta("30/11/2026")).hasMessageContaining("DATA_INVALIDA");
        conta("2026-11-30");
        assertThatThrownBy(() -> sql("UPDATE contas_a_pagar SET vencimento = '2026-13-01'")).hasMessageContaining("DATA_INVALIDA");
        assertThatThrownBy(() -> sql("INSERT INTO pagamentos (id_conta, data_pagamento, valor_pago_centavos) VALUES (1, 'ontem', 1000)"))
                .hasMessageContaining("DATA_INVALIDA");
        assertThatThrownBy(() -> sql("INSERT INTO avisos (data_inicio, data_fim, titulo, mensagem)"
                + " VALUES ('2026-12-01', '2026-11-01', 'AVISO', 'texto')")).hasMessageContaining("DATA_INVALIDA");
    }

    @Test
    void linhaAntigaComDataEstranhaContinuaEditavel() throws SQLException {
        conta("2026-11-30");
        // simula uma conta gravada antes da regra (os gatilhos so olham quando a data muda)
        sql("DROP TRIGGER trg_conta_vencimento_data_upd");
        sql("UPDATE contas_a_pagar SET vencimento = '2026-11-30 '");
        new DatabaseInitializer(conexao).inicializar(); // ja na v22: nada muda
        sql("CREATE TRIGGER trg_conta_vencimento_data_upd BEFORE UPDATE OF vencimento ON contas_a_pagar"
                + " WHEN NEW.vencimento IS NOT OLD.vencimento AND (NEW.vencimento IS NOT NULL AND date(NEW.vencimento) IS NOT NEW.vencimento)"
                + " BEGIN SELECT RAISE(ABORT, 'DATA_INVALIDA: x'); END");
        sql("UPDATE contas_a_pagar SET categoria = 'ENERGIA', vencimento = vencimento");
        assertThat(texto("SELECT categoria FROM contas_a_pagar")).isEqualTo("ENERGIA");
    }

    @Test
    void auditoriaDosCadastrosEDaFormaDePagamento() throws SQLException {
        sql("INSERT INTO bancos (instituicao) VALUES ('ITAU')");
        sql("INSERT INTO pagadores (nome) VALUES ('FELIPE')");
        sql("INSERT INTO empresas (razao_social) VALUES ('CEMIG')");
        sql("INSERT INTO telefones_empresa (id_empresa, numero) VALUES (1, '3133334444')");
        sql("INSERT INTO avisos (data_inicio, data_fim, titulo, mensagem) VALUES ('2026-11-01', '2026-11-30', 'AVISO', 'texto')");
        assertThat(texto("SELECT count(DISTINCT tabela) FROM auditoria_operacoes WHERE tabela IN"
                + " ('bancos', 'pagadores', 'empresas', 'telefones_empresa', 'avisos')")).isEqualTo("5");
        conta("2026-11-30");
        sql("INSERT INTO pagamentos (id_conta, data_pagamento, valor_pago_centavos, forma_pagamento) VALUES (1, '2026-11-23', 1000, 'PIX')");
        assertThat(texto("SELECT depois FROM auditoria_operacoes WHERE tabela = 'pagamentos'")).contains("\"forma_pagamento\":\"PIX\"");
    }

    @Test
    void textoGrandeDemaisERecusado() {
        assertThatThrownBy(() -> sql("INSERT INTO bancos (instituicao) VALUES ('" + "X".repeat(201) + "')"))
                .hasMessageContaining("TEXTO_LONGO");
    }

    @Test
    void planilhaAntigaFicaComoVeio() throws SQLException {
        sql("INSERT INTO legado_padroes (arquivo_origem, linha_origem, nome) VALUES ('CONTAS.xlsm', 2, 'ALUGUEL')");
        assertThatThrownBy(() -> sql("UPDATE legado_padroes SET nome = 'OUTRO'")).hasMessageContaining("LEGADO_IMUTAVEL");
    }

    @Test
    void codigoUsadoNaoVoltaAValer() throws SQLException {
        sql("INSERT INTO usuarios (nome, login_indice, login_cifrado, pin_hash, admin) VALUES ('ADM', 'i', 'c', 'h', 1)");
        sql("INSERT INTO codigos_redefinicao (id_usuario, codigo_hash, expira_em, usado) VALUES (1, 'x', '2999-01-01', 1)");
        assertThatThrownBy(() -> sql("UPDATE codigos_redefinicao SET usado = 0")).hasMessageContaining("CODIGO_IMUTAVEL");
    }
}
