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
        return new Banco(null, "Banco do Brasil", "001", "1234-5", "98765-4", "11999990000");
    }

    @Test
    void deveCadastrarBancoValidoComCamposNormalizados() {
        Banco criado = service.cadastrar(new Banco(null, "  Itau  ", "341", "0001", "12345-6", "  contato@exemplo.com "));

        assertThat(criado.id()).isNotNull();
        assertThat(criado.instituicao()).isEqualTo("Itau");
        assertThat(criado.codigoBanco()).isEqualTo("341");
        assertThat(criado.chavePix()).isEqualTo("contato@exemplo.com");
    }

    @Test
    void deveManterZerosAEsquerdaDoCodigoBanco() {
        Banco criado = service.cadastrar(dadosValidos());

        assertThat(criado.codigoBanco()).isEqualTo("001");
    }

    @Test
    void deveAceitarChavePixOpcionalAusente() {
        Banco criado = service.cadastrar(new Banco(null, "Caixa Economica", "104", "0001", "87654-3", null));

        assertThat(criado.chavePix()).isNull();
    }

    @Test
    void deveRecusarCadastroSemInstituicao() {
        assertThatThrownBy(() -> service.cadastrar(new Banco(null, "", "001", "1234", "999", null)))
                .isInstanceOf(DadosInvalidosException.class)
                .satisfies(erro -> assertThat(((DadosInvalidosException) erro).getCampos())
                        .containsKey("instituicao"));
    }

    @Test
    void deveRecusarCodigoBancoComLetras() {
        assertThatThrownBy(() -> service.cadastrar(new Banco(null, "Banco X", "ABC", "1234", "999", null)))
                .isInstanceOf(DadosInvalidosException.class)
                .satisfies(erro -> assertThat(((DadosInvalidosException) erro).getCampos())
                        .containsKey("codigoBanco"));
    }

    @Test
    void deveRecusarAgenciaVazia() {
        assertThatThrownBy(() -> service.cadastrar(new Banco(null, "Banco X", "001", "", "999", null)))
                .isInstanceOf(DadosInvalidosException.class)
                .satisfies(erro -> assertThat(((DadosInvalidosException) erro).getCampos())
                        .containsKey("agencia"));
    }

    @Test
    void deveRecusarChavePixComEspacos() {
        assertThatThrownBy(() -> service.cadastrar(
                new Banco(null, "Banco X", "001", "1234", "999", "chave invalida")))
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
                new Banco(null, "Itau", "341", "4321", "11111-2", null));

        assertThat(atualizado.instituicao()).isEqualTo("Itau");
        assertThat(service.buscarPorId(criado.id()).conta()).isEqualTo("11111-2");
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
                new Banco(null, malicioso, "001", "1234", "999", null));

        assertThat(service.buscarPorId(criado.id()).instituicao()).isEqualTo(malicioso);
        List<Banco> todos = service.listar();
        assertThat(todos).isNotEmpty();
    }
}
