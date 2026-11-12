package com.chaveiro.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.chaveiro.database.ConnectionFactory;
import com.chaveiro.database.DatabaseInitializer;
import com.chaveiro.model.Aviso;
import com.chaveiro.repository.AvisoRepository;
import java.nio.file.Path;
import java.time.LocalDate;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class AvisoServiceTest {

    @TempDir
    Path pastaTemporaria;

    private AvisoService service;

    @BeforeEach
    void preparar() throws Exception {
        ConnectionFactory conexao = new ConnectionFactory(pastaTemporaria.resolve("contas_teste.db").toString());
        new DatabaseInitializer(conexao).inicializar();
        service = new AvisoService(new AvisoRepository(conexao));
    }

    @Test
    void deveCadastrarEditarEExcluirAviso() {
        Aviso criado = service.cadastrar(new Aviso(null, LocalDate.parse("2026-12-01"),
                LocalDate.parse("2026-12-31"), "TODOS", "Reunião", "Reunião as 18h"));
        assertThat(criado.id()).isNotNull();

        Aviso editado = service.atualizar(criado.id(), new Aviso(criado.id(), LocalDate.parse("2026-12-01"),
                LocalDate.parse("2026-12-31"), "SEXTA", "Reunião", "Reunião as 19h"));
        assertThat(editado.diaSemana()).isEqualTo("SEXTA");

        service.excluir(criado.id());
        assertThat(service.listar()).isEmpty();
    }

    @Test
    void deveValidarVigenciaTituloEMensagem() {
        assertThatThrownBy(() -> service.cadastrar(new Aviso(null, LocalDate.parse("2026-12-31"),
                LocalDate.parse("2026-12-01"), "TODOS", "Título", "Mensagem")))
                .isInstanceOf(DadosInvalidosException.class);
        assertThatThrownBy(() -> service.cadastrar(new Aviso(null, LocalDate.parse("2026-12-01"),
                LocalDate.parse("2026-12-31"), "TODOS", "T", "Mensagem")))
                .isInstanceOf(DadosInvalidosException.class);
    }

    @Test
    void vigenciaConsideraPeriodoEDiaDaSemana() {
        Aviso apenasSexta = new Aviso(null, LocalDate.parse("2026-12-01"),
                LocalDate.parse("2026-12-31"), "SEXTA", "Título", "Mensagem");
        LocalDate sexta = LocalDate.parse("2026-12-04");
        LocalDate sabado = LocalDate.parse("2026-12-05");

        assertThat(AvisoService.ativoEm(apenasSexta, sexta)).isTrue();
        assertThat(AvisoService.ativoEm(apenasSexta, sabado)).isFalse();
        assertThat(AvisoService.ativoEm(apenasSexta, LocalDate.parse("2027-01-01"))).isFalse();

        Aviso todos = new Aviso(null, LocalDate.parse("2026-12-01"),
                LocalDate.parse("2026-12-31"), "TODOS", "Título", "Mensagem");
        assertThat(AvisoService.ativoEm(todos, sabado)).isTrue();
    }

    @Test
    void migracaoV15RemoveCheckAntigoEAceitaVariosDias() throws Exception {
        // reproduz o banco da loja: avisos criada pela 1a versao da v11 (CHECK de um dia so)
        ConnectionFactory conexao = new ConnectionFactory(pastaTemporaria.resolve("banco_antigo.db").toString());
        try (java.sql.Connection conn = conexao.getConnection(); java.sql.Statement st = conn.createStatement()) {
            st.execute("""
                    CREATE TABLE avisos (
                        id_aviso INTEGER PRIMARY KEY AUTOINCREMENT,
                        data_inicio TEXT NOT NULL, data_fim TEXT NOT NULL,
                        dia_semana TEXT NOT NULL DEFAULT 'TODOS'
                            CHECK (dia_semana IN ('TODOS','DOMINGO','SEGUNDA','TERCA','QUARTA','QUINTA','SEXTA','SABADO')),
                        titulo TEXT NOT NULL, mensagem TEXT NOT NULL,
                        criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime')))""");
            st.execute("CREATE INDEX idx_avisos_vigencia ON avisos(data_inicio, data_fim)");
            st.execute("INSERT INTO avisos (data_inicio, data_fim, dia_semana, titulo, mensagem)"
                    + " VALUES ('2026-01-01', '2026-12-31', 'SEGUNDA', 'REVISAR DDA', 'Revise o DDA')");
            st.execute("PRAGMA user_version = 14");
        }
        new DatabaseInitializer(conexao).inicializar();
        AvisoService antigo = new AvisoService(new AvisoRepository(conexao));

        assertThat(antigo.listar()).extracting(Aviso::titulo).containsExactly("REVISAR DDA");
        Aviso varios = antigo.cadastrar(new Aviso(null, LocalDate.parse("2026-12-01"),
                LocalDate.parse("2026-12-31"), "SEGUNDA,TERCA,QUARTA,QUINTA,SEXTA", "TESTE", "TESTE"));
        assertThat(varios.id()).isNotNull();
        assertThat(antigo.listar()).hasSize(2);
    }
}
