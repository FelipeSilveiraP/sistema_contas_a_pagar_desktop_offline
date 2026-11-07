package com.chaveiro.api;

import static org.hamcrest.Matchers.notNullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.chaveiro.model.Empresa;
import com.chaveiro.model.Empresa.TelefoneEmpresa;
import com.chaveiro.service.EmpresaService;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
class EmpresaApiTest {

    private static final String TOKEN = "token-teste-unitario";

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper json;

    @Autowired
    private EmpresaService service;

    private String corpo(String cnpj, String razaoSocial, String email, String telefone) throws Exception {
        List<EmpresaController.TelefoneRequest> telefones = telefone == null ? List.of()
                : List.of(new EmpresaController.TelefoneRequest(telefone, "Comercial"));
        return json.writeValueAsString(new EmpresaController.EmpresaRequest(
                cnpj, razaoSocial, null, email, null, telefones));
    }

    private long cadastrarExemplo() {
        return service.cadastrar(new Empresa(null, null, "Empresa API Teste", null, null, null, List.of())).id();
    }

    @Test
    void deveCadastrarEmpresaERetornar201ComCorpo() throws Exception {
        mvc.perform(post("/api/empresas").header("X-FinDesk-Token", TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpo("11222333000181", "Empresa Nova", "contato@empresa.com.br", "(11) 3333-4444")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id", notNullValue()))
                .andExpect(jsonPath("$.razaoSocial").value("Empresa Nova"))
                .andExpect(jsonPath("$.telefones[0].numero").value("(11) 3333-4444"));
    }

    @Test
    void deveListarEConsultarEmpresa() throws Exception {
        long id = cadastrarExemplo();

        mvc.perform(get("/api/empresas").header("X-FinDesk-Token", TOKEN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.id == " + id + ")]").exists());

        mvc.perform(get("/api/empresas/" + id).header("X-FinDesk-Token", TOKEN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.razaoSocial").value("Empresa API Teste"));
    }

    @Test
    void deveRetornar404ParaEmpresaInexistente() throws Exception {
        mvc.perform(get("/api/empresas/99999").header("X-FinDesk-Token", TOKEN))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.erro").exists());
    }

    @Test
    void deveAtualizarEmpresa() throws Exception {
        long id = cadastrarExemplo();

        mvc.perform(put("/api/empresas/" + id).header("X-FinDesk-Token", TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpo(null, "Empresa Atualizada", null, null)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.razaoSocial").value("Empresa Atualizada"));
    }

    @Test
    void deveExcluirEmpresa() throws Exception {
        long id = cadastrarExemplo();

        mvc.perform(delete("/api/empresas/" + id).header("X-FinDesk-Token", TOKEN))
                .andExpect(status().isNoContent());

        mvc.perform(get("/api/empresas/" + id).header("X-FinDesk-Token", TOKEN))
                .andExpect(status().isNotFound());
    }

    @Test
    void deveRetornar400ComCamposInvalidos() throws Exception {
        mvc.perform(post("/api/empresas").header("X-FinDesk-Token", TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpo("11222333000182", "", "sem-arroba", "123")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.erro").value("dados invalidos"))
                .andExpect(jsonPath("$.campos.razaoSocial").exists())
                .andExpect(jsonPath("$.campos.cnpj").exists())
                .andExpect(jsonPath("$.campos.email").exists())
                .andExpect(jsonPath("$.campos.telefones").exists());
    }

    @Test
    void deveRecusarSemToken() throws Exception {
        mvc.perform(get("/api/empresas")).andExpect(status().isUnauthorized());
    }

    @Test
    void deveRecusarTokenInvalido() throws Exception {
        mvc.perform(get("/api/empresas").header("X-FinDesk-Token", "token-falso"))
                .andExpect(status().isUnauthorized());
    }
}
