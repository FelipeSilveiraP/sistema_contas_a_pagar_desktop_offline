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

    private static final String TOKEN = "dev-token-local";

    @Autowired
    private MockMvc mvc;

    @Test
    void statusSemTokenNegado() throws Exception {
        mvc.perform(get("/api/status")).andExpect(status().isUnauthorized());
    }

    @Test
    void statusComTokenOk() throws Exception {
        mvc.perform(get("/api/status").header("X-FinDesk-Token", TOKEN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ok"))
                .andExpect(jsonPath("$.fase").value("1"));
    }

    @Test
    void contasComTokenOk() throws Exception {
        mvc.perform(get("/api/contas").header("X-FinDesk-Token", TOKEN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(3));
    }

    @Test
    void contasComTokenInvalidoNegado() throws Exception {
        mvc.perform(get("/api/contas").header("X-FinDesk-Token", "errado"))
                .andExpect(status().isUnauthorized());
    }
}
