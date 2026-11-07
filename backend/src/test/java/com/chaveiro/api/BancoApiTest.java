package com.chaveiro.api;

import static org.hamcrest.Matchers.notNullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.chaveiro.model.Banco;
import com.chaveiro.service.BancoService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
class BancoApiTest {

    private static final String TOKEN = "token-teste-unitario";

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper json;

    @Autowired
    private BancoService service;

    private String corpo(String instituicao, String pix) throws Exception {
        return json.writeValueAsString(new BancoController.BancoRequest(instituicao, pix));
    }

    private long cadastrarExemplo() {
        return service.cadastrar(new Banco(null, "Banco API Teste", null)).id();
    }

    @Test
    void deveCadastrarBancoERetornar201ComCorpo() throws Exception {
        mvc.perform(post("/api/bancos").header("X-FinDesk-Token", TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpo("Banco Novo", "pix@exemplo.com")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id", notNullValue()))
                .andExpect(jsonPath("$.instituicao").value("Banco Novo"))
                .andExpect(jsonPath("$.chavePix").value("pix@exemplo.com"));
    }

    @Test
    void deveListarBancos() throws Exception {
        long id = cadastrarExemplo();

        mvc.perform(get("/api/bancos").header("X-FinDesk-Token", TOKEN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.id == " + id + ")]").exists());
    }

    @Test
    void deveConsultarBancoPorId() throws Exception {
        long id = cadastrarExemplo();

        mvc.perform(get("/api/bancos/" + id).header("X-FinDesk-Token", TOKEN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.instituicao").value("Banco API Teste"));
    }

    @Test
    void deveRetornar404ParaBancoInexistente() throws Exception {
        mvc.perform(get("/api/bancos/99999").header("X-FinDesk-Token", TOKEN))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.erro").exists());
    }

    @Test
    void deveAtualizarBanco() throws Exception {
        long id = cadastrarExemplo();

        mvc.perform(put("/api/bancos/" + id).header("X-FinDesk-Token", TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpo("Banco Atualizado", "pix@atualizado.com")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.instituicao").value("Banco Atualizado"));

        mvc.perform(get("/api/bancos/" + id).header("X-FinDesk-Token", TOKEN))
                .andExpect(jsonPath("$.instituicao").value("Banco Atualizado"));
    }

    @Test
    void deveExcluirBanco() throws Exception {
        long id = cadastrarExemplo();

        mvc.perform(delete("/api/bancos/" + id).header("X-FinDesk-Token", TOKEN))
                .andExpect(status().isNoContent());

        mvc.perform(get("/api/bancos/" + id).header("X-FinDesk-Token", TOKEN))
                .andExpect(status().isNotFound());
    }

    @Test
    void deveRetornar400ComCamposInvalidos() throws Exception {
        mvc.perform(post("/api/bancos").header("X-FinDesk-Token", TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpo("", "chave invalida")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.erro").value("dados invalidos"))
                .andExpect(jsonPath("$.campos.instituicao").exists())
                .andExpect(jsonPath("$.campos.chavePix").exists());
    }

    @Test
    void deveRecusarSemToken() throws Exception {
        mvc.perform(get("/api/bancos")).andExpect(status().isUnauthorized());
    }

    @Test
    void deveRecusarTokenInvalido() throws Exception {
        mvc.perform(get("/api/bancos").header("X-FinDesk-Token", "token-falso"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void deveAplicarTokenCorretamenteNoCadastro() throws Exception {
        mvc.perform(post("/api/bancos").header("X-FinDesk-Token", "outro-token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpo("Banco X", null)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void deveManterTabelaIntactaAposTentativaDeSqlInjection() throws Exception {
        String malicioso = "x'; DROP TABLE bancos; --";
        String resposta = mvc.perform(post("/api/bancos").header("X-FinDesk-Token", TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpo(malicioso, null)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        JsonNode criado = json.readTree(resposta);

        mvc.perform(get("/api/bancos/" + criado.get("id").asLong()).header("X-FinDesk-Token", TOKEN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.instituicao").value(malicioso));
    }
}
