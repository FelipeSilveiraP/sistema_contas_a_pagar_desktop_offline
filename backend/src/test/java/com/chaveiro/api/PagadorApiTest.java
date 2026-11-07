package com.chaveiro.api;

import static org.hamcrest.Matchers.notNullValue;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.chaveiro.model.Pagador;
import com.chaveiro.service.PagadorService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
class PagadorApiTest {

    private static final String TOKEN = "token-teste-unitario";

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper json;

    @Autowired
    private PagadorService service;

    private String corpo(String nome, String cpf, String funcao) throws Exception {
        return json.writeValueAsString(new PagadorController.PagadorRequest(nome, cpf, funcao));
    }

    private long cadastrarExemplo() {
        return service.cadastrar(new Pagador(null, "Pagador API Teste", "52998224725", null)).id();
    }

    @Test
    void deveCadastrarPagadorERetornar201ComCorpo() throws Exception {
        mvc.perform(post("/api/pagadores").header("X-FinDesk-Token", TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpo("Pagador Novo", "529.982.247-25", "Gerente")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id", notNullValue()))
                .andExpect(jsonPath("$.nome").value("Pagador Novo"))
                .andExpect(jsonPath("$.cpf").value("52998224725"));
    }

    @Test
    void deveListarPagadores() throws Exception {
        long id = cadastrarExemplo();

        mvc.perform(get("/api/pagadores").header("X-FinDesk-Token", TOKEN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.id == " + id + ")]").exists());
    }

    @Test
    void deveConsultarPagadorPorId() throws Exception {
        long id = cadastrarExemplo();

        mvc.perform(get("/api/pagadores/" + id).header("X-FinDesk-Token", TOKEN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nome").value("Pagador API Teste"));
    }

    @Test
    void deveRetornar404ParaPagadorInexistente() throws Exception {
        mvc.perform(get("/api/pagadores/99999").header("X-FinDesk-Token", TOKEN))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.erro").exists());
    }

    @Test
    void deveAtualizarPagador() throws Exception {
        long id = cadastrarExemplo();

        mvc.perform(put("/api/pagadores/" + id).header("X-FinDesk-Token", TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpo("Pagador Atualizado", "12345678909", "Proprietario")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nome").value("Pagador Atualizado"));

        mvc.perform(get("/api/pagadores/" + id).header("X-FinDesk-Token", TOKEN))
                .andExpect(jsonPath("$.nome").value("Pagador Atualizado"));
    }

    @Test
    void deveExcluirPagador() throws Exception {
        long id = cadastrarExemplo();

        mvc.perform(delete("/api/pagadores/" + id).header("X-FinDesk-Token", TOKEN))
                .andExpect(status().isNoContent());

        mvc.perform(get("/api/pagadores/" + id).header("X-FinDesk-Token", TOKEN))
                .andExpect(status().isNotFound());
    }

    @Test
    void deveCadastrarPagadorSemCpf() throws Exception {
        mvc.perform(post("/api/pagadores").header("X-FinDesk-Token", TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpo("Pagador Sem Cpf", null, "Caixa")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.cpf").value(nullValue()));
    }

    @Test
    void deveRetornar400ComCamposInvalidos() throws Exception {
        mvc.perform(post("/api/pagadores").header("X-FinDesk-Token", TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpo("", "11111111111", "x".repeat(101))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.erro").value("dados invalidos"))
                .andExpect(jsonPath("$.campos.nome").exists())
                .andExpect(jsonPath("$.campos.cpf").exists())
                .andExpect(jsonPath("$.campos.funcao").exists());
    }

    @Test
    void deveRecusarSemToken() throws Exception {
        mvc.perform(get("/api/pagadores")).andExpect(status().isUnauthorized());
    }

    @Test
    void deveRecusarTokenInvalido() throws Exception {
        mvc.perform(get("/api/pagadores").header("X-FinDesk-Token", "token-falso"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void deveAplicarTokenCorretamenteNoCadastro() throws Exception {
        mvc.perform(post("/api/pagadores").header("X-FinDesk-Token", "outro-token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpo("Pagador X", "52998224725", null)))
                .andExpect(status().isUnauthorized());
    }
}
