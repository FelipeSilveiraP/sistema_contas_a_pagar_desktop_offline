package com.chaveiro.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
class ApiTest {

    private static final String TOKEN = "token-teste-unitario";

    @Autowired
    private MockMvc mvc;

    @Test
    void deveResponder400ParaJsonMalformadoEmVezDeErroInterno() throws Exception {
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/contas")
                        .header("X-FinDesk-Token", TOKEN)
                        .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                        .content("{\"nomeEmpresa\": "))
                .andExpect(status().isBadRequest());
    }

    @Test
    void deveNegarStatusSemToken() throws Exception {
        mvc.perform(get("/api/status")).andExpect(status().isUnauthorized());
    }

    @Test
    void deveResponderStatusComTokenValido() throws Exception {
        mvc.perform(get("/api/status").header("X-FinDesk-Token", TOKEN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ok"));
    }

    @Test
    void deveListarContasPelaApiReal() throws Exception {
        // mock da Fase 1 substituido pela implementacao real (Entrega 3.5)
        mvc.perform(get("/api/contas").header("X-FinDesk-Token", TOKEN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());
    }

    @Test
    void deveNegarRequisicaoComTokenInvalido() throws Exception {
        mvc.perform(get("/api/contas").header("X-FinDesk-Token", "errado"))
                .andExpect(status().isUnauthorized());
    }
}
