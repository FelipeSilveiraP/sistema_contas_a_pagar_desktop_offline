package com.chaveiro.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.chaveiro.database.ConnectionFactory;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

/**
 * SQL Injection (OWASP A03): manda os ataques classicos em TODOS os campos de
 * texto de todas as telas e confere que (1) a API nao quebra (nada de 500),
 * (2) o texto e gravado exatamente como digitado — como DADO, nunca como
 * comando — e (3) as tabelas continuam todas la, com a mesma quantidade de
 * registros de antes + os criados pelo teste.
 */
@SpringBootTest
@AutoConfigureMockMvc
class SqlInjectionApiTest {

    private static final String TOKEN = "token-teste-unitario";

    /** Tabelas que um "DROP TABLE" tentaria apagar. */
    private static final List<String> TABELAS = List.of("contas_a_pagar", "pagamentos", "bancos", "pagadores",
            "empresas", "telefones_empresa", "boletos_recorrentes", "avisos", "auditoria_operacoes");

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper json;

    @Autowired
    private ConnectionFactory conexao;

    private int tabelasAntes;

    @BeforeEach
    void contarTabelas() throws Exception {
        tabelasAntes = contar("SELECT COUNT(*) FROM sqlite_master WHERE type = 'table'");
    }

    @AfterEach
    void tabelasContinuamInteiras() throws Exception {
        assertThat(contar("SELECT COUNT(*) FROM sqlite_master WHERE type = 'table'")).isEqualTo(tabelasAntes);
        for (String tabela : TABELAS) {
            // so funciona se a tabela ainda existir
            contar("SELECT COUNT(*) FROM " + tabela);
        }
        try (Connection conn = conexao.getConnection(); Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery("PRAGMA integrity_check")) {
            assertThat(rs.next() && "ok".equals(rs.getString(1))).isTrue();
        }
    }

    private int contar(String sql) throws Exception {
        try (Connection conn = conexao.getConnection(); Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery(sql)) {
            return rs.next() ? rs.getInt(1) : 0;
        }
    }

    private JsonNode criar(String rota, Map<String, Object> corpo) throws Exception {
        MvcResult resultado = mvc.perform(post(rota).header("X-FinDesk-Token", TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(corpo)))
                .andExpect(status().isCreated())
                .andReturn();
        return json.readTree(resultado.getResponse().getContentAsByteArray());
    }

    private JsonNode buscar(String rota) throws Exception {
        MvcResult resultado = mvc.perform(get(rota).header("X-FinDesk-Token", TOKEN))
                .andExpect(status().isOk())
                .andReturn();
        return json.readTree(resultado.getResponse().getContentAsByteArray());
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "' OR 1=1 --",
            "'; DROP TABLE contas_a_pagar; --",
            "\"; DROP TABLE pagamentos; --",
            "1' UNION SELECT name, sql FROM sqlite_master --",
            "x'); DELETE FROM bancos; --",
            "Robert'); ATTACH DATABASE '/tmp/x.db' AS x; --",
            "%' OR '%'='",
            "<script>alert(1)</script>",
    })
    void textoMaliciosoViraDadoEmTodosOsCadastros(String ataque) throws Exception {
        // ---- conta a pagar: todos os campos de texto ----
        Map<String, Object> conta = new LinkedHashMap<>();
        conta.put("nomeEmpresa", ataque);
        conta.put("pagadorResponsavel", ataque);
        conta.put("tipoPessoa", "PJ");
        conta.put("formaPagamento", "boleto");
        conta.put("categoria", ataque);
        conta.put("numeroDocumento", ataque);
        conta.put("valor", "10.00");
        conta.put("vencimento", "2031-01-15");
        conta.put("semNotaFiscal", true);
        conta.put("forcar", true);
        long idConta = criar("/api/contas", conta).get("id").asLong();
        JsonNode lida = buscar("/api/contas/" + idConta);
        assertThat(lida.get("nomeEmpresa").asText()).isEqualTo(ataque.trim());
        assertThat(lida.get("pagadorResponsavel").asText()).isEqualTo(ataque.trim());
        assertThat(lida.get("categoria").asText()).isEqualTo(ataque.trim());
        assertThat(lida.get("numeroDocumento").asText()).isEqualTo(ataque.trim());

        // ---- conta fixa (recorrencia) ----
        Map<String, Object> recorrente = new LinkedHashMap<>();
        recorrente.put("nomeEmpresa", ataque);
        recorrente.put("pagadorResponsavel", ataque);
        recorrente.put("categoria", ataque);
        recorrente.put("numeroDocumento", ataque);
        recorrente.put("valor", "20.00");
        recorrente.put("dia", 5);
        recorrente.put("periodicidade", "MENSAL");
        recorrente.put("formaPagamento", "boleto");
        recorrente.put("tipoPessoa", "PJ");
        JsonNode recorrenteCriado = criar("/api/recorrentes", recorrente);
        assertThat(recorrenteCriado.get("nomeEmpresa").asText()).isEqualTo(ataque.trim());

        // ---- banco (a chave Pix nao aceita espacos: vai o ataque sem espacos) ----
        String semEspaco = ataque.replace(" ", "");
        JsonNode banco = criar("/api/bancos", Map.of("instituicao", ataque, "chavePix", semEspaco));
        assertThat(buscar("/api/bancos/" + banco.get("id").asLong()).get("chavePix").asText()).isEqualTo(semEspaco);

        // ---- pagador ----
        JsonNode pagador = criar("/api/pagadores", Map.of("nome", ataque, "funcao", ataque));
        assertThat(buscar("/api/pagadores/" + pagador.get("id").asLong()).get("funcao").asText()).isEqualTo(ataque.trim());

        // ---- empresa emissora (com telefone) ----
        Map<String, Object> empresa = new LinkedHashMap<>();
        empresa.put("razaoSocial", ataque);
        empresa.put("nomeRepresentante", ataque);
        empresa.put("logradouro", ataque);
        empresa.put("telefones", List.of(Map.of("numero", "(11) 3333-4444", "tipo", ataque.length() > 20 ? ataque.substring(0, 20) : ataque)));
        JsonNode empresaCriada = criar("/api/empresas", empresa);
        assertThat(buscar("/api/empresas/" + empresaCriada.get("id").asLong()).get("logradouro").asText()).isEqualTo(ataque.trim());

        // ---- mensagem (aviso) ----
        Map<String, Object> aviso = new LinkedHashMap<>();
        aviso.put("dataInicio", "2031-01-01");
        aviso.put("dataFim", "2031-01-31");
        aviso.put("diaSemana", "TODOS");
        aviso.put("titulo", ataque);
        aviso.put("mensagem", ataque);
        JsonNode avisoCriado = criar("/api/avisos", aviso);
        assertThat(buscar("/api/avisos/" + avisoCriado.get("id").asLong()).get("mensagem").asText()).isEqualTo(ataque.trim());
    }

    @ParameterizedTest
    @ValueSource(strings = {"' OR 1=1 --", "PAGO' OR '1'='1", "PENDENTE; DROP TABLE contas_a_pagar"})
    void filtroDeStatusNaoVazaContas(String ataque) throws Exception {
        // se o filtro fosse concatenado, "' OR 1=1" devolveria TODAS as contas
        mvc.perform(get("/api/contas").param("status", ataque).header("X-FinDesk-Token", TOKEN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }

    @ParameterizedTest
    @ValueSource(strings = {"' OR 1=1 --", "2026-01-01' OR '1'='1", "2026-01-01; DROP TABLE contas_a_pagar"})
    void filtroDeDataDoPainelRecusaAtaqueSemErroInterno(String ataque) throws Exception {
        mvc.perform(get("/api/dashboard/resumo").param("de", ataque).header("X-FinDesk-Token", TOKEN))
                .andExpect(status().isBadRequest());
    }

    @ParameterizedTest
    @ValueSource(strings = {"1 OR 1=1", "999999;DROP TABLE contas_a_pagar", "1'--"})
    void codigoNaRotaNuncaViraConsulta(String ataque) throws Exception {
        // 400 (nao e numero) ou 404 (o ";" corta o resto da rota e sobra um id inexistente):
        // nunca 200 com dados nem 500
        mvc.perform(get("/api/contas/{id}", ataque).header("X-FinDesk-Token", TOKEN))
                .andExpect(status().is4xxClientError());
    }
}
