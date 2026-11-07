package com.chaveiro.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.chaveiro.database.ConnectionFactory;
import com.chaveiro.database.DatabaseInitializer;
import com.chaveiro.model.Empresa;
import com.chaveiro.model.Empresa.TelefoneEmpresa;
import com.chaveiro.repository.EmpresaRepository;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.Statement;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

/**
 * Regras do cadastro de empresas sobre SQLite real (banco de teste isolado em tmp).
 */
class EmpresaServiceTest {

    @TempDir
    Path pastaTemporaria;

    private EmpresaService service;
    private ConnectionFactory conexao;

    @BeforeEach
    void preparar() {
        conexao = new ConnectionFactory(pastaTemporaria.resolve("contas_teste.db").toString());
        new DatabaseInitializer(conexao).inicializar();
        service = new EmpresaService(new EmpresaRepository(conexao));
    }

    private Empresa dadosValidos() {
        return new Empresa(null, "11222333000181", "Silca Chaves do Brasil", "Joao",
                "contato@silca.com.br", "Rua das Lages, 100",
                List.of(new TelefoneEmpresa("(11) 3333-4444", "Comercial")));
    }

    @Test
    void deveCadastrarEmpresaComTelefones() {
        Empresa criada = service.cadastrar(dadosValidos());

        assertThat(criada.id()).isNotNull();
        assertThat(criada.razaoSocial()).isEqualTo("Silca Chaves do Brasil");
        assertThat(criada.telefones()).hasSize(1);
        assertThat(criada.telefones().get(0).numero()).isEqualTo("(11) 3333-4444");
    }

    @Test
    void deveAceitarEmpresaSemCnpjENemTelefones() {
        Empresa criada = service.cadastrar(
                new Empresa(null, null, "Gold Chaves", null, null, null, List.of()));

        assertThat(criada.cnpj()).isNull();
        assertThat(criada.telefones()).isEmpty();
    }

    @Test
    void deveNormalizarCnpjParaDigitos() {
        Empresa criada = service.cadastrar(
                new Empresa(null, "11.222.333/0001-81", "Empresa CNPJ", null, null, null, List.of()));

        assertThat(criada.cnpj()).isEqualTo("11222333000181");
    }

    @Test
    void deveRecusarSemRazaoSocial() {
        assertThatThrownBy(() -> service.cadastrar(
                new Empresa(null, null, "", null, null, null, List.of())))
                .isInstanceOf(DadosInvalidosException.class)
                .satisfies(erro -> assertThat(((DadosInvalidosException) erro).getCampos())
                        .containsKey("razaoSocial"));
    }

    @Test
    void deveRecusarCnpjComDigitosVerificadoresInvalidos() {
        assertThatThrownBy(() -> service.cadastrar(
                new Empresa(null, "11222333000182", "Empresa X", null, null, null, List.of())))
                .isInstanceOf(DadosInvalidosException.class)
                .satisfies(erro -> assertThat(((DadosInvalidosException) erro).getCampos())
                        .containsKey("cnpj"));
    }

    @Test
    void deveRecusarEmailInvalido() {
        assertThatThrownBy(() -> service.cadastrar(
                new Empresa(null, null, "Empresa X", null, "sem-arroba", null, List.of())))
                .isInstanceOf(DadosInvalidosException.class)
                .satisfies(erro -> assertThat(((DadosInvalidosException) erro).getCampos())
                        .containsKey("email"));
    }

    @Test
    void deveRecusarTelefoneInvalido() {
        assertThatThrownBy(() -> service.cadastrar(
                new Empresa(null, null, "Empresa X", null, null, null,
                        List.of(new TelefoneEmpresa("123", null)))))
                .isInstanceOf(DadosInvalidosException.class)
                .satisfies(erro -> assertThat(((DadosInvalidosException) erro).getCampos())
                        .containsKey("telefones"));
    }

    @Test
    void deveAtualizarEmpresaSubstituindoTelefones() {
        Empresa criada = service.cadastrar(dadosValidos());

        Empresa atualizada = service.atualizar(criada.id(),
                new Empresa(null, null, "Silca Atualizada", null, null, null,
                        List.of(new TelefoneEmpresa("(11) 99999-0000", "Celular"),
                                new TelefoneEmpresa("(11) 2222-3333", null))));

        assertThat(atualizada.razaoSocial()).isEqualTo("Silca Atualizada");
        Empresa consultada = service.buscarPorId(criada.id());
        assertThat(consultada.telefones()).hasSize(2);
        assertThat(consultada.telefones().get(1).tipo()).isEqualTo("Comercial");
    }

    @Test
    void deveExcluirEmpresaComTelefones() {
        Empresa criada = service.cadastrar(dadosValidos());

        service.excluir(criada.id());

        assertThatThrownBy(() -> service.buscarPorId(criada.id()))
                .isInstanceOf(RecursoNaoEncontradoException.class);
    }

    @Test
    void devePreservarCadastroAoReabrirBanco() throws Exception {
        Empresa criada = service.cadastrar(dadosValidos());

        EmpresaService aoReabrir = new EmpresaService(
                new EmpresaRepository(new ConnectionFactory(pastaTemporaria.resolve("contas_teste.db").toString())));

        assertThat(aoReabrir.buscarPorId(criada.id()).razaoSocial()).isEqualTo("Silca Chaves do Brasil");
        assertThat(aoReabrir.buscarPorId(criada.id()).telefones()).hasSize(1);
    }

    @Test
    void deveArmazenarTentativaDeSqlInjectionComoTextoComum() {
        String malicioso = "'; DROP TABLE empresas; --";

        Empresa criada = service.cadastrar(
                new Empresa(null, null, malicioso, null, null, null, List.of()));

        assertThat(service.buscarPorId(criada.id()).razaoSocial()).isEqualTo(malicioso);
    }

    @Test
    void devePreservarTabelasAnterioresAposMigracaoV5() throws Exception {
        // tabelas anteriores continuam presentes e utilizaveis apos a migracao v5
        try (Connection conn = conexao.getConnection();
             Statement stmt = conn.createStatement()) {
            stmt.execute("INSERT INTO bancos (instituicao) VALUES ('Banco Intacto')");
            stmt.execute("INSERT INTO pagadores (nome) VALUES ('Pagador Intacto')");
        }
        assertThat(service.listar()).isEmpty();
    }
}
