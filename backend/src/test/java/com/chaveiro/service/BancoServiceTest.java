package com.chaveiro.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.chaveiro.database.ConnectionFactory;
import com.chaveiro.database.DatabaseInitializer;
import com.chaveiro.model.Banco;
import com.chaveiro.repository.BancoRepository;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.Statement;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

/**
 * Regras do cadastro de bancos sobre SQLite real (banco de teste isolado em tmp).
 */
class BancoServiceTest {

    @TempDir
    Path pastaTemporaria;

    private BancoService service;
    private BancoRepository repository;
    private ConnectionFactory conexao;

    @BeforeEach
    void preparar() {
        conexao = new ConnectionFactory(pastaTemporaria.resolve("contas_teste.db").toString());
        new DatabaseInitializer(conexao).inicializar();
        repository = new BancoRepository(conexao);
        service = new BancoService(repository);
    }

    private Banco dadosValidos() {
        return new Banco(null, "Banco do Brasil", "11999990000");
    }

    @Test
    void deveCadastrarBancoValidoComCamposNormalizados() {
        Banco criado = service.cadastrar(new Banco(null, "  Itau  ", "  contato@exemplo.com "));

        assertThat(criado.id()).isNotNull();
        assertThat(criado.instituicao()).isEqualTo("Itau");
        assertThat(criado.chavePix()).isEqualTo("contato@exemplo.com");
    }

    @Test
    void deveAceitarChavePixOpcionalAusente() {
        Banco criado = service.cadastrar(new Banco(null, "Caixa Economica", null));

        assertThat(criado.chavePix()).isNull();
    }

    @Test
    void deveRecusarCadastroSemInstituicao() {
        assertThatThrownBy(() -> service.cadastrar(new Banco(null, "", null)))
                .isInstanceOf(DadosInvalidosException.class)
                .satisfies(erro -> assertThat(((DadosInvalidosException) erro).getCampos())
                        .containsKey("instituicao"));
    }

    @Test
    void deveRecusarChavePixComEspacos() {
        assertThatThrownBy(() -> service.cadastrar(
                new Banco(null, "Banco X", "chave invalida")))
                .isInstanceOf(DadosInvalidosException.class)
                .satisfies(erro -> assertThat(((DadosInvalidosException) erro).getCampos())
                        .containsKey("chavePix"));
    }

    @Test
    void deveConsultarPorIdEListar() {
        Banco criado = service.cadastrar(dadosValidos());

        assertThat(service.buscarPorId(criado.id()).instituicao()).isEqualTo("Banco do Brasil");
        assertThat(service.listar()).extracting(Banco::id).contains(criado.id());
    }

    @Test
    void deveAtualizarBancoExistente() {
        Banco criado = service.cadastrar(dadosValidos());

        Banco atualizado = service.atualizar(criado.id(),
                new Banco(null, "Itau", "pix@itau.com.br"));

        assertThat(atualizado.instituicao()).isEqualTo("Itau");
        assertThat(service.buscarPorId(criado.id()).chavePix()).isEqualTo("pix@itau.com.br");
    }

    @Test
    void deveFalharComRecursoNaoEncontradoAoAtualizarInexistente() {
        assertThatThrownBy(() -> service.atualizar(99999, dadosValidos()))
                .isInstanceOf(RecursoNaoEncontradoException.class);
    }

    @Test
    void deveExcluirBancoExistente() {
        Banco criado = service.cadastrar(dadosValidos());

        service.excluir(criado.id());

        assertThatThrownBy(() -> service.buscarPorId(criado.id()))
                .isInstanceOf(RecursoNaoEncontradoException.class);
    }

    @Test
    void deveFalharComRecursoNaoEncontradoAoExcluirInexistente() {
        assertThatThrownBy(() -> service.excluir(99999))
                .isInstanceOf(RecursoNaoEncontradoException.class);
    }

    @Test
    void devePreservarCadastroAoReabrirBanco() throws Exception {
        Banco criado = service.cadastrar(dadosValidos());

        BancoService aoReabrir = new BancoService(
                new BancoRepository(new ConnectionFactory(pastaTemporaria.resolve("contas_teste.db").toString())));

        assertThat(aoReabrir.buscarPorId(criado.id()).instituicao()).isEqualTo("Banco do Brasil");
    }

    @Test
    void devePreservarDadosAoMigrarDeV1ParaV2() throws Exception {
        ConnectionFactory conexaoV1 = new ConnectionFactory(pastaTemporaria.resolve("contas_migracao.db").toString());
        try (Connection conn = conexaoV1.getConnection();
             Statement stmt = conn.createStatement()) {
            stmt.execute("CREATE TABLE bancos (id_banco INTEGER PRIMARY KEY AUTOINCREMENT,"
                    + " instituicao TEXT NOT NULL, codigo_banco TEXT NOT NULL, agencia TEXT NOT NULL,"
                    + " conta TEXT NOT NULL, chave_pix TEXT)");
            stmt.execute("INSERT INTO bancos (instituicao, codigo_banco, agencia, conta, chave_pix)"
                    + " VALUES ('Banco Antigo', '001', '1234-5', '98765-4', 'pix@exemplo.com')");
            stmt.execute("PRAGMA user_version = 1");
        }

        DatabaseInitializer initializer = new DatabaseInitializer(conexaoV1);
        initializer.inicializar();

        assertThat(initializer.lerVersao()).isEqualTo(initializer.getVersaoAtual());
        BancoService serviceMigrado = new BancoService(new BancoRepository(conexaoV1));
        List<Banco> bancos = serviceMigrado.listar();
        assertThat(bancos).hasSize(1);
        Banco preservado = bancos.get(0);
        assertThat(preservado.id()).isEqualTo(1L);
        assertThat(preservado.instituicao()).isEqualTo("Banco Antigo");
        assertThat(preservado.chavePix()).isEqualTo("pix@exemplo.com");

        Banco novo = serviceMigrado.cadastrar(new Banco(null, "Banco Novo", null));
        assertThat(novo.id()).isEqualTo(2L);
    }

    @Test
    void deveRecusarExclusaoQuandoBancoEstiverVinculadoARegistrosFinanceiros() throws Exception {
        Banco criado = service.cadastrar(dadosValidos());
        try (Connection conn = conexao.getConnection();
             Statement stmt = conn.createStatement()) {
            stmt.execute("CREATE TABLE pagamentos_teste (id INTEGER PRIMARY KEY, id_banco INTEGER NOT NULL,"
                    + " FOREIGN KEY (id_banco) REFERENCES bancos(id_banco))");
            stmt.execute("INSERT INTO pagamentos_teste (id_banco) VALUES (" + criado.id() + ")");
        }

        assertThatThrownBy(() -> service.excluir(criado.id()))
                .isInstanceOf(ConflitoIntegridadeException.class);

        assertThat(service.buscarPorId(criado.id())).isNotNull();
    }

    @Test
    void deveArmazenarTentativaDeSqlInjectionComoTextoComum() {
        String malicioso = "'; DROP TABLE bancos; --";

        Banco criado = service.cadastrar(
                new Banco(null, malicioso, null));

        assertThat(service.buscarPorId(criado.id()).instituicao()).isEqualTo(malicioso);
        List<Banco> todos = service.listar();
        assertThat(todos).isNotEmpty();
    }
}
