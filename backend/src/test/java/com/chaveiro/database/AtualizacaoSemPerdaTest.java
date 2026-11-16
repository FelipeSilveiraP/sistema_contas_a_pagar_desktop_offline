package com.chaveiro.database;

import static org.assertj.core.api.Assertions.assertThat;

import com.chaveiro.service.BackupDriveService;
import com.chaveiro.service.BackupService;
import com.chaveiro.service.LimpezaAnexosService;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

/**
 * NAO PODEMOS PERDER NENHUM REGISTRO: monta um banco igual ao de cada versao antiga do
 * sistema (v1 a v17), enche as tabelas que existiam naquela versao, roda a atualizacao de
 * verdade (InicializadorBanco: backup antes + migracoes, inclusive as que reconstroem
 * tabelas) e confere que cada registro continua la com os mesmos valores, que as chaves
 * estrangeiras continuam certas e que o backup pre-migracao tem tudo.
 */
class AtualizacaoSemPerdaTest {

    @TempDir
    Path pasta;

    /** Colunas que a tabela tem nesta versao (vazio = a tabela ainda nao existe). */
    private static Set<String> colunas(Connection c, String tabela) throws SQLException {
        Set<String> nomes = new LinkedHashSet<>();
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery("PRAGMA table_info(\"" + tabela + "\")")) {
            while (rs.next()) {
                nomes.add(rs.getString("name"));
            }
        }
        return nomes;
    }

    /** INSERT so com as colunas que existem na versao (as outras ficam no padrao). */
    private static void inserir(Connection c, String tabela, Map<String, Object> valores) throws SQLException {
        Set<String> existentes = colunas(c, tabela);
        if (existentes.isEmpty()) {
            return;
        }
        List<String> nomes = new ArrayList<>();
        List<Object> dados = new ArrayList<>();
        for (var v : valores.entrySet()) {
            if (existentes.contains(v.getKey())) {
                nomes.add(v.getKey());
                dados.add(v.getValue());
            }
        }
        String sql = "INSERT INTO \"" + tabela + "\" (" + String.join(", ", nomes) + ") VALUES ("
                + String.join(", ", nomes.stream().map(n -> "?").toList()) + ")";
        try (PreparedStatement st = c.prepareStatement(sql)) {
            for (int i = 0; i < dados.size(); i++) {
                st.setObject(i + 1, dados.get(i));
            }
            st.executeUpdate();
        }
    }

    private static Map<String, Object> m(Object... chaveValor) {
        Map<String, Object> r = new LinkedHashMap<>();
        for (int i = 0; i < chaveValor.length; i += 2) {
            r.put((String) chaveValor[i], chaveValor[i + 1]);
        }
        return r;
    }

    private static void encher(ConnectionFactory conexao) throws SQLException {
        String futuro = LocalDate.now().plusMonths(2).toString();
        try (Connection c = conexao.getConnection()) {
            inserir(c, "empresas", m("cnpj", "11222333000181", "razao_social", "FORNECEDOR DA LOJA LTDA", "nome_representante", "JOÃO",
                    "email", "fornecedor@exemplo.com", "logradouro", "RUA A, 10"));
            inserir(c, "empresas", m("razao_social", "OUTRA EMPRESA ''ASPAS''"));
            inserir(c, "telefones_empresa", m("id_empresa", 1, "numero", "11999998888", "tipo", "Celular"));
            inserir(c, "bancos", m("codigo_banco", "001", "agencia", "0001", "conta", "12345-6", "instituicao", "BANCO DA LOJA",
                    "chave_pix", "chave@pix.com"));
            inserir(c, "pagadores", m("nome", "PAGADOR DA LOJA", "cpf", "52998224725", "funcao", "DONO"));
            for (int i = 0; i < 40; i++) {
                inserir(c, "contas_a_pagar", m("nome_empresa", "FORNECEDOR DA LOJA LTDA", "id_empresa", 1, "pagador_responsavel", "PAGADOR DA LOJA",
                        "tipo_pessoa", "PJ", "forma_pagamento", "BOLETO", "categoria", "ALUGUEL", "numero_documento", "DOC-" + i,
                        "valor_centavos", 1000 + i, "vencimento", futuro, "boleto_na_pasta", i % 2, "status", "PENDENTE",
                        "anexo_nome", i == 0 ? "nota.pdf" : null, "anexo_pdf", i == 0 ? "%PDF-1.4 nota".getBytes() : null));
            }
            // conta paga do jeito que o sistema faz: nasce PENDENTE, ganha o pagamento e vira PAGO
            inserir(c, "contas_a_pagar", m("nome_empresa", "CONTA PAGA", "id_empresa", 1, "pagador_responsavel", "PAGADOR DA LOJA",
                    "forma_pagamento", "PIX", "valor_centavos", 55555, "vencimento", futuro, "status", "PENDENTE"));
            inserir(c, "pagamentos", m("id_conta", 41, "data_pagamento", LocalDate.now().toString(), "valor_pago_centavos", 55555, "id_banco", 1));
            if (!colunas(c, "contas_a_pagar").isEmpty()) {
                try (Statement st = c.createStatement()) {
                    st.execute("UPDATE contas_a_pagar SET status = 'PAGO' WHERE id_conta = 41");
                }
            }
            inserir(c, "boletos_recorrentes", m("nome_empresa", "ALUGUEL DA LOJA", "id_empresa", 1, "pagador_responsavel", "PAGADOR DA LOJA",
                    "categoria", "ALUGUEL", "valor_centavos", 300000, "dia", 10, "periodicidade", "MENSAL", "forma_pagamento", "BOLETO"));
            inserir(c, "avisos", m("data_inicio", LocalDate.now().toString(), "data_fim", futuro, "dia_semana", "TODOS",
                    "titulo", "AVISO DA LOJA", "mensagem", "Pagar o aluguel"));
            inserir(c, "legado_lancamentos", m("arquivo_origem", "PLANILHA.xlsm", "aba_origem", "JANEIRO", "linha_origem", 2, "fornecedor", "X"));
            inserir(c, "manutencao", m("chave", "teste.config", "valor", "valor"));
        }
    }

    /** Cada tabela: as linhas como mapas coluna -> valor (texto), em ordem de rowid. */
    private static Map<String, List<Map<String, String>>> foto(String banco) throws SQLException {
        Map<String, List<Map<String, String>>> tudo = new LinkedHashMap<>();
        try (Connection c = DriverManager.getConnection("jdbc:sqlite:" + banco); Statement st = c.createStatement()) {
            List<String> tabelas = new ArrayList<>();
            try (ResultSet rs = st.executeQuery("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")) {
                while (rs.next()) {
                    tabelas.add(rs.getString(1));
                }
            }
            for (String t : tabelas) {
                List<Map<String, String>> linhas = new ArrayList<>();
                try (ResultSet rs = st.executeQuery("SELECT * FROM \"" + t + "\" ORDER BY rowid")) {
                    int n = rs.getMetaData().getColumnCount();
                    while (rs.next()) {
                        Map<String, String> l = new LinkedHashMap<>();
                        for (int i = 1; i <= n; i++) {
                            l.put(rs.getMetaData().getColumnName(i), rs.getString(i));
                        }
                        linhas.add(l);
                    }
                }
                tudo.put(t, linhas);
            }
        }
        return tudo;
    }

    private static Path backupPreMigracao(BackupService backup) throws Exception {
        try (Stream<Path> arquivos = Files.list(backup.getDiretorioBackups())) {
            return arquivos.filter(p -> p.getFileName().toString().contains("pre-migracao")).findFirst().orElseThrow();
        }
    }

    private static void abrirVersaoNova(ConnectionFactory conexao, DatabaseInitializer migracoes, BackupService backup, Path banco)
            throws Exception {
        new InicializadorBanco(migracoes, backup, new LimpezaAnexosService(conexao),
                new BackupDriveService(conexao, "", banco.toString())).run(null);
    }

    @ParameterizedTest(name = "banco v{0} -> versao atual sem perder nada")
    @ValueSource(ints = {1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17})
    void atualizarNaoPerdeNemMudaNenhumRegistro(int versaoAntiga) throws Exception {
        Path banco = pasta.resolve("contas.db");
        ConnectionFactory conexao = new ConnectionFactory(banco.toString());
        DatabaseInitializer migracoes = new DatabaseInitializer(conexao);
        migracoes.inicializarAte(versaoAntiga);
        assertThat(migracoes.lerVersao()).isEqualTo(versaoAntiga);
        encher(conexao);
        Map<String, List<Map<String, String>>> antes = foto(banco.toString());
        if (antes.containsKey("contas_a_pagar")) { // a tabela de contas existe a partir da v7
            assertThat(antes.get("contas_a_pagar")).as("contas de exemplo gravadas na v%d", versaoAntiga).hasSize(41);
        }

        BackupService backup = new BackupService(conexao);
        abrirVersaoNova(conexao, migracoes, backup, banco);
        assertThat(migracoes.lerVersao()).isEqualTo(migracoes.getVersaoAtual());
        Map<String, List<Map<String, String>>> depois = foto(banco.toString());

        for (var tabela : antes.entrySet()) {
            String nome = tabela.getKey();
            if (nome.equals("auditoria_operacoes") || nome.equals("sqlite_sequence")) {
                continue;
            }
            assertThat(depois).as("tabela %s continua existindo (v%d)", nome, versaoAntiga).containsKey(nome);
            List<Map<String, String>> novas = depois.get(nome);
            if (nome.equals("manutencao")) { // configuracoes: as novas versoes podem acrescentar chaves
                assertThat(novas).as("configuracoes antigas continuam (v%d)", versaoAntiga).containsAll(tabela.getValue());
                continue;
            }
            assertThat(novas).as("quantidade de registros em %s (v%d)", nome, versaoAntiga).hasSize(tabela.getValue().size());
            // v1 a v7 sao do desenvolvimento (antes do 1o instalador): a v8 converteu de proposito o
            // formato antigo das contas (id_pagador -> nome do pagador). Nelas confere so que
            // nenhuma linha some; da v8 em diante, campo por campo.
            if (versaoAntiga < 8) {
                continue;
            }
            for (int i = 0; i < novas.size(); i++) {
                Map<String, String> velha = tabela.getValue().get(i);
                Map<String, String> nova = novas.get(i);
                for (var coluna : velha.entrySet()) {
                    // coluna que existia antes: o valor tem de ser o mesmo (colunas novas podem aparecer)
                    assertThat(nova).as("%s linha %d (v%d)", nome, i + 1, versaoAntiga).containsKey(coluna.getKey());
                    assertThat(nova.get(coluna.getKey())).as("%s.%s linha %d (v%d)", nome, coluna.getKey(), i + 1, versaoAntiga)
                            .isEqualTo(coluna.getValue());
                }
            }
        }
        // ligacoes entre tabelas continuam validas (contas -> empresa, pagamento -> conta/banco...)
        try (Connection c = DriverManager.getConnection("jdbc:sqlite:" + banco); Statement st = c.createStatement();
             ResultSet rs = st.executeQuery("PRAGMA foreign_key_check")) {
            assertThat(rs.next()).as("foreign_key_check sem erros (v%d)", versaoAntiga).isFalse();
        }
        try (Connection c = DriverManager.getConnection("jdbc:sqlite:" + banco); Statement st = c.createStatement();
             ResultSet rs = st.executeQuery("PRAGMA integrity_check")) {
            rs.next();
            assertThat(rs.getString(1)).isEqualTo("ok");
        }
        // o backup feito ANTES da migracao tem todos os registros
        assertThat(foto(backupPreMigracao(backup).toString())).isEqualTo(antes);
        // abrir de novo nao muda nada
        abrirVersaoNova(conexao, migracoes, backup, banco);
        Map<String, List<Map<String, String>>> deNovo = foto(banco.toString());
        deNovo.remove("auditoria_operacoes");
        depois.remove("auditoria_operacoes");
        assertThat(deNovo).isEqualTo(depois);
    }

    @Test
    void instaladorNuncaApagaOsDados() throws Exception {
        String empacotar = Files.readString(Path.of("../instalador/empacotar.js"));
        assertThat(empacotar).contains("deleteAppDataOnUninstall: false");
        String fabrica = Files.readString(Path.of("src/main/java/com/chaveiro/database/ConnectionFactory.java"));
        assertThat(fabrica).contains("LOCALAPPDATA").contains("ContasAPagar");
    }
}
