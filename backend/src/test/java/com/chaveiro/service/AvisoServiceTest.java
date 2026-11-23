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
            // a v16 acrescenta coluna em contas_a_pagar e a v17 cria gatilhos em contas e
            // pagamentos (a v18, tambem em boletos_recorrentes): o banco simulado precisa
            // dessas tabelas (um banco v14 real ja as tem)
            // (a v22 cria gatilhos nas colunas de texto e datas e em bancos, pagadores, empresas e telefones)
            st.execute("CREATE TABLE contas_a_pagar (id_conta INTEGER PRIMARY KEY, status TEXT NOT NULL DEFAULT 'PENDENTE',"
                    + " valor_centavos INTEGER, nome_empresa TEXT, id_empresa INTEGER, pagador_responsavel TEXT, tipo_pessoa TEXT,"
                    + " forma_pagamento TEXT, categoria TEXT, numero_documento TEXT, vencimento TEXT,"
                    + " boleto_na_pasta INTEGER NOT NULL DEFAULT 0, anexo_nome TEXT, anexo_pdf BLOB)");
            st.execute("CREATE TABLE pagamentos (id_pagamento INTEGER PRIMARY KEY, id_conta INTEGER NOT NULL,"
                    + " valor_pago_centavos INTEGER, data_pagamento TEXT, id_banco INTEGER)");
            st.execute("CREATE TABLE boletos_recorrentes (id_recorrente INTEGER PRIMARY KEY, valor_centavos INTEGER, nome_empresa TEXT,"
                    + " id_empresa INTEGER, pagador_responsavel TEXT, categoria TEXT, numero_documento TEXT, dia INTEGER,"
                    + " periodicidade TEXT, forma_pagamento TEXT, ativo INTEGER NOT NULL DEFAULT 1)");
            st.execute("CREATE TABLE bancos (id_banco INTEGER PRIMARY KEY, instituicao TEXT NOT NULL, chave_pix TEXT)");
            st.execute("CREATE TABLE pagadores (id_pagador INTEGER PRIMARY KEY, nome TEXT NOT NULL, cpf TEXT, funcao TEXT)");
            st.execute("CREATE TABLE empresas (id_empresa INTEGER PRIMARY KEY, cnpj TEXT, razao_social TEXT NOT NULL,"
                    + " nome_representante TEXT, email TEXT, logradouro TEXT)");
            st.execute("CREATE TABLE legado_lancamentos (id_legado INTEGER PRIMARY KEY, arquivo_origem TEXT, aba_origem TEXT,"
                    + " linha_origem INTEGER, data_vencimento TEXT, numero_documento TEXT, fornecedor TEXT, valor_original TEXT,"
                    + " valor_centavos INTEGER, situacao TEXT, observacoes TEXT, quem_vai_pagar TEXT, cor_linha TEXT,"
                    + " id_conta_migrada INTEGER, importado_em TEXT)");
            st.execute("CREATE TABLE legado_padroes (id_legado INTEGER PRIMARY KEY, arquivo_origem TEXT, linha_origem INTEGER, dia TEXT,"
                    + " nome TEXT, valor_original TEXT, valor_centavos INTEGER, numero_documento TEXT, pagador TEXT, importado_em TEXT)");
            st.execute("CREATE TABLE legado_avisos (id_legado INTEGER PRIMARY KEY, arquivo_origem TEXT, linha_origem INTEGER,"
                    + " periodo_de TEXT, periodo_ate TEXT, dia_semana TEXT, titulo TEXT, mensagem TEXT, importado_em TEXT)");
            st.execute("CREATE TABLE telefones_empresa (id_telefone INTEGER PRIMARY KEY, id_empresa INTEGER NOT NULL, numero TEXT NOT NULL,"
                    + " tipo TEXT)");
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
