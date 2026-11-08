package com.chaveiro.api;

import static org.hamcrest.Matchers.notNullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.chaveiro.model.Empresa;
import com.chaveiro.service.EmpresaService;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
class ContaApiTest {

    private static final String TOKEN = "token-teste-unitario";

    @Autowired
    private MockMvc mvc;

    @Autowired
    private com.fasterxml.jackson.databind.ObjectMapper json;

    @Autowired
    private EmpresaService empresaService;

    private long cadastrarEmpresa() {
        return empresaService.cadastrar(new Empresa(null, null, "Empresa API Contas", null, null, null, List.of())).id();
    }

    private String sufixo() {
        return java.util.UUID.randomUUID().toString().substring(0, 8);
    }

    private String corpo(long idEmpresa, String valor, String vencimento, String doc, Boolean forcar) throws Exception {
        return json.writeValueAsString(new ContaController.ContaRequest(
                idEmpresa, null, "Material", doc, new BigDecimal(valor),
                LocalDate.parse(vencimento), Boolean.FALSE, forcar));
    }

    @Test
    void deveCadastrarContaERetornar201ComStatusPendente() throws Exception {
        long idEmpresa = cadastrarEmpresa();

        mvc.perform(post("/api/contas").header("X-FinDesk-Token", TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpo(idEmpresa, "123.45", "2026-12-10", "NF-" + sufixo(), true)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id", notNullValue()))
                .andExpect(jsonPath("$.status").value("PENDENTE"))
                .andExpect(jsonPath("$.valor").value(123.45))
                .andExpect(jsonPath("$.razaoSocial").value("Empresa API Contas"));
    }

    @Test
    void deveRetornar400ParaDadosInvalidos() throws Exception {
        long idEmpresa = cadastrarEmpresa();

        mvc.perform(post("/api/contas").header("X-FinDesk-Token", TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpo(idEmpresa, "0.00", "2026-12-10", null, null)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.campos.valor").exists());

        mvc.perform(post("/api/contas").header("X-FinDesk-Token", TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(new ContaController.ContaRequest(
                                idEmpresa, null, null, null, new BigDecimal("10.00"), null, false, null))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.campos.vencimento").exists());
    }

    @Test
    void deveApontarPossivelDuplicataCom409EExistente() throws Exception {
        long idEmpresa = cadastrarEmpresa();
        String doc = "DOC-" + sufixo();
        mvc.perform(post("/api/contas").header("X-FinDesk-Token", TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpo(idEmpresa, "100.00", "2026-12-10", doc, true)))
                .andExpect(status().isCreated());

        mvc.perform(post("/api/contas").header("X-FinDesk-Token", TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpo(idEmpresa, "100.00", "2026-12-10", doc.toLowerCase(), null)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.tipo").value("possivel_duplicata"))
                .andExpect(jsonPath("$.existente.id", notNullValue()));

        // forcar insere mesmo assim
        mvc.perform(post("/api/contas").header("X-FinDesk-Token", TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpo(idEmpresa, "100.00", "2026-12-10", doc, true)))
                .andExpect(status().isCreated());
    }

    @Test
    void deveListarComFiltroDeStatus() throws Exception {
        long idEmpresa = cadastrarEmpresa();
        String doc = "L-" + sufixo();
        mvc.perform(post("/api/contas").header("X-FinDesk-Token", TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpo(idEmpresa, "10.00", "2026-12-10", doc, true)))
                .andExpect(status().isCreated());

        mvc.perform(get("/api/contas").header("X-FinDesk-Token", TOKEN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.numeroDocumento == '" + doc + "')]").exists());
        mvc.perform(get("/api/contas").header("X-FinDesk-Token", TOKEN).param("status", "PAGO"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.numeroDocumento == '" + doc + "')]").doesNotExist());
        mvc.perform(get("/api/contas").header("X-FinDesk-Token", TOKEN).param("status", "PENDENTE"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.numeroDocumento == '" + doc + "')]").exists());
    }

    @Test
    void deveAtualizarEExcluirConta() throws Exception {
        long idEmpresa = cadastrarEmpresa();
        String criado = mvc.perform(post("/api/contas").header("X-FinDesk-Token", TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpo(idEmpresa, "10.00", "2026-12-10", "E-" + sufixo(), true)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        long id = json.readTree(criado).get("id").asLong();

        mvc.perform(put("/api/contas/" + id).header("X-FinDesk-Token", TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpo(idEmpresa, "20.00", "2026-12-20", "E-EDIT-" + sufixo(), true)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.valor").value(20.00));

        mvc.perform(delete("/api/contas/" + id).header("X-FinDesk-Token", TOKEN))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/contas/" + id).header("X-FinDesk-Token", TOKEN))
                .andExpect(status().isNotFound());
    }

    @Test
    void deveRecusarExclusaoDeEmpresaVinculadaAConta() throws Exception {
        long idEmpresa = cadastrarEmpresa();
        mvc.perform(post("/api/contas").header("X-FinDesk-Token", TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpo(idEmpresa, "10.00", "2026-12-10", "V-" + sufixo(), true)))
                .andExpect(status().isCreated());

        mvc.perform(delete("/api/empresas/" + idEmpresa).header("X-FinDesk-Token", TOKEN))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.erro").exists());
    }

    @Test
    void deveRetornar409ParaEmpresaInexistente() throws Exception {
        mvc.perform(post("/api/contas").header("X-FinDesk-Token", TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpo(99999L, "10.00", "2026-12-10", null, true)))
                .andExpect(status().isConflict());
    }
}
