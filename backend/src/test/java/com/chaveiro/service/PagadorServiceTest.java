package com.chaveiro.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.chaveiro.database.ConnectionFactory;
import com.chaveiro.database.DatabaseInitializer;
import com.chaveiro.model.Pagador;
import com.chaveiro.repository.PagadorRepository;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.Statement;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

/**
 * Regras do cadastro de pagadores sobre SQLite real (banco de teste isolado em tmp).
 */
class PagadorServiceTest {

    @TempDir
    Path pastaTemporaria;

    private PagadorService service;

    @BeforeEach
    void preparar() {
        ConnectionFactory conexao = new ConnectionFactory(pastaTemporaria.resolve("contas_teste.db").toString());
        new DatabaseInitializer(conexao).inicializar();
        service = new PagadorService(new PagadorRepository(conexao));
    }

    private Pagador dadosValidos() {
        return new Pagador(null, "Joao da Silva", "52998224725", "Gerente");
    }

    @Test
    void deveCadastrarPagadorValidoComCamposNormalizados() {
        Pagador criado = service.cadastrar(
                new Pagador(null, "  Joao Silva  ", "  529.982.247-25 ", " Gerente "));

        assertThat(criado.id()).isNotNull();
        assertThat(criado.nome()).isEqualTo("Joao Silva");
        assertThat(criado.cpf()).isEqualTo("52998224725");
        assertThat(criado.funcao()).isEqualTo("Gerente");
    }

    @Test
    void deveAceitarFuncaoOpcionalAusente() {
        Pagador criado = service.cadastrar(new Pagador(null, "Maria Souza", "12345678909", null));

        assertThat(criado.funcao()).isNull();
    }

    @Test
    void deveAceitarCpfOpcionalAusente() {
        Pagador criado = service.cadastrar(new Pagador(null, "Maria Souza", null, "Gerente"));

        assertThat(criado.cpf()).isNull();
    }

    @Test
    void deveAceitarFuncaoCom100Caracteres() {
        Pagador criado = service.cadastrar(new Pagador(null, "Joao Silva", null, "x".repeat(100)));

        assertThat(criado.funcao()).hasSize(100);
    }

    @Test
    void deveRecusarCadastroSemNome() {
        assertThatThrownBy(() -> service.cadastrar(new Pagador(null, "", "52998224725", null)))
                .isInstanceOf(DadosInvalidosException.class)
                .satisfies(erro -> assertThat(((DadosInvalidosException) erro).getCampos())
                        .containsKey("nome"));
    }

    @Test
    void deveRecusarCpfComDigitosVerificadoresInvalidos() {
        assertThatThrownBy(() -> service.cadastrar(new Pagador(null, "Banco X", "52998224724", null)))
                .isInstanceOf(DadosInvalidosException.class)
                .satisfies(erro -> assertThat(((DadosInvalidosException) erro).getCampos())
                        .containsKey("cpf"));
    }

    @Test
    void deveRecusarCpfComDigitosRepetidos() {
        assertThatThrownBy(() -> service.cadastrar(new Pagador(null, "Banco X", "11111111111", null)))
                .isInstanceOf(DadosInvalidosException.class)
                .satisfies(erro -> assertThat(((DadosInvalidosException) erro).getCampos())
                        .containsKey("cpf"));
    }

    @Test
    void deveRecusarFuncaoComMaisDe100Caracteres() {
        assertThatThrownBy(() -> service.cadastrar(
                new Pagador(null, "Joao Silva", "52998224725", "x".repeat(101))))
                .isInstanceOf(DadosInvalidosException.class)
                .satisfies(erro -> assertThat(((DadosInvalidosException) erro).getCampos())
                        .containsKey("funcao"));
    }

    @Test
    void deveConsultarPorIdEListar() {
        Pagador criado = service.cadastrar(dadosValidos());

        assertThat(service.buscarPorId(criado.id()).nome()).isEqualTo("Joao da Silva");
        assertThat(service.listar()).extracting(Pagador::id).contains(criado.id());
    }

    @Test
    void deveAtualizarPagadorExistente() {
        Pagador criado = service.cadastrar(dadosValidos());

        Pagador atualizado = service.atualizar(criado.id(),
                new Pagador(null, "Maria Souza", "12345678909", null));

        assertThat(atualizado.nome()).isEqualTo("Maria Souza");
        assertThat(service.buscarPorId(criado.id()).cpf()).isEqualTo("12345678909");
    }

    @Test
    void deveFalharComRecursoNaoEncontradoAoAtualizarInexistente() {
        assertThatThrownBy(() -> service.atualizar(99999, dadosValidos()))
                .isInstanceOf(RecursoNaoEncontradoException.class);
    }

    @Test
    void deveExcluirPagadorExistente() {
        Pagador criado = service.cadastrar(dadosValidos());

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
        Pagador criado = service.cadastrar(dadosValidos());

        PagadorService aoReabrir = new PagadorService(
                new PagadorRepository(new ConnectionFactory(pastaTemporaria.resolve("contas_teste.db").toString())));

        assertThat(aoReabrir.buscarPorId(criado.id()).nome()).isEqualTo("Joao da Silva");
    }

    @Test
    void devePreservarDadosAoMigrarDeV3ParaV4() throws Exception {
        ConnectionFactory conexaoV3 = new ConnectionFactory(pastaTemporaria.resolve("contas_migracao.db").toString());
        try (Connection conn = conexaoV3.getConnection();
             Statement stmt = conn.createStatement()) {
            stmt.execute("CREATE TABLE pagadores (id_pagador INTEGER PRIMARY KEY AUTOINCREMENT,"
                    + " nome TEXT NOT NULL, cpf TEXT NOT NULL, funcao TEXT)");
            stmt.execute("INSERT INTO pagadores (nome, cpf, funcao)"
                    + " VALUES ('Pagador Antigo', '52998224725', 'Caixa')");
            stmt.execute("PRAGMA user_version = 3");
        }

        DatabaseInitializer initializer = new DatabaseInitializer(conexaoV3);
        initializer.inicializar();

        assertThat(initializer.lerVersao()).isEqualTo(initializer.getVersaoAtual());
        PagadorService serviceMigrado = new PagadorService(new PagadorRepository(conexaoV3));
        List<Pagador> pagadores = serviceMigrado.listar();
        assertThat(pagadores).hasSize(1);
        Pagador preservado = pagadores.get(0);
        assertThat(preservado.id()).isEqualTo(1L);
        assertThat(preservado.nome()).isEqualTo("Pagador Antigo");
        assertThat(preservado.cpf()).isEqualTo("52998224725");
        assertThat(preservado.funcao()).isEqualTo("Caixa");
    }

    @Test
    void deveArmazenarTentativaDeSqlInjectionComoTextoComum() {
        String malicioso = "'; DROP TABLE pagadores; --";

        Pagador criado = service.cadastrar(new Pagador(null, malicioso, "52998224725", null));

        assertThat(service.buscarPorId(criado.id()).nome()).isEqualTo(malicioso);
        List<Pagador> todos = service.listar();
        assertThat(todos).isNotEmpty();
    }
}
