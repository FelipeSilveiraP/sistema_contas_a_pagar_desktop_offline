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
import com.chaveiro.service.EmpresaService;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Base64;
import java.util.List;
import java.util.Map;
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
    private ObjectMapper json;

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
                "Empresa API Contas", idEmpresa, "Balcão 01", "PJ", "boleto",
                "Material", doc, new BigDecimal(valor), LocalDate.parse(vencimento),
                Boolean.FALSE, null, null, true, forcar));
    }

    @Test
    void deveCadastrarContaERetornar201ComCamposDoFormulario() throws Exception {
        long idEmpresa = cadastrarEmpresa();

        mvc.perform(post("/api/contas").header("X-FinDesk-Token", TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpo(idEmpresa, "123.45", "2026-12-10", "NF-" + sufixo(), true)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id", notNullValue()))
                .andExpect(jsonPath("$.status").value("PENDENTE"))
                .andExpect(jsonPath("$.valor").value(123.45))
                .andExpect(jsonPath("$.nomeEmpresa").value("Empresa API Contas"))
                .andExpect(jsonPath("$.pagadorResponsavel").value("Balcão 01"))
                .andExpect(jsonPath("$.formaPagamento").value("boleto"))
                .andExpect(jsonPath("$.tipoPessoa").value("PJ"));
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
                                "Empresa", idEmpresa, "Balcão", "PJ", "boleto", null, null,
                                new BigDecimal("10.00"), null, false, null, null, true, null))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.campos.vencimento").exists());

        mvc.perform(post("/api/contas").header("X-FinDesk-Token", TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(new ContaController.ContaRequest(
                                "Empresa", idEmpresa, "Balcão", "PJ", "cheque", null, null,
                                new BigDecimal("10.00"), LocalDate.parse("2026-12-10"), false, null, null, true, null))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.campos.formaPagamento").exists());
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
    void devePreservarContaAoExcluirEmpresaVinculada() throws Exception {
        // Empresa emissora e opcional (FK SET NULL): o historico financeiro sobrevive
        long idEmpresa = cadastrarEmpresa();
        String criado = mvc.perform(post("/api/contas").header("X-FinDesk-Token", TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpo(idEmpresa, "10.00", "2026-12-10", "V-" + sufixo(), true)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        long id = json.readTree(criado).get("id").asLong();

        mvc.perform(delete("/api/empresas/" + idEmpresa).header("X-FinDesk-Token", TOKEN))
                .andExpect(status().isNoContent());

        mvc.perform(get("/api/contas/" + id).header("X-FinDesk-Token", TOKEN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nomeEmpresa").value("Empresa API Contas"))
                .andExpect(jsonPath("$.idEmpresa").doesNotExist());
    }

    @Test
    void deveRetornar409ParaEmpresaInexistente() throws Exception {
        mvc.perform(post("/api/contas").header("X-FinDesk-Token", TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpo(99999L, "10.00", "2026-12-10", null, true)))
                .andExpect(status().isConflict());
    }

    @Test
    void naoDevePermitirTrocarStatusViaPut() throws Exception {
        long idEmpresa = cadastrarEmpresa();
        String criado = mvc.perform(post("/api/contas").header("X-FinDesk-Token", TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpo(idEmpresa, "10.00", "2026-12-10", "ST-" + sufixo(), true)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        long id = json.readTree(criado).get("id").asLong();

        String corpoComStatus = json.writeValueAsString(Map.of(
                "nomeEmpresa", "Empresa API Contas",
                "pagadorResponsavel", "Balcão 01",
                "tipoPessoa", "PJ",
                "formaPagamento", "boleto",
                "valor", "10.00",
                "vencimento", "2026-12-10",
                "forcar", true,
                "status", "PAGO"));
        mvc.perform(put("/api/contas/" + id).header("X-FinDesk-Token", TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpoComStatus))
                .andExpect(status().isOk());

        mvc.perform(get("/api/contas/" + id).header("X-FinDesk-Token", TOKEN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PENDENTE"));
    }

    @Test
    void forcarNaoBypassaValidacaoDeValor() throws Exception {
        long idEmpresa = cadastrarEmpresa();
        mvc.perform(post("/api/contas").header("X-FinDesk-Token", TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpo(idEmpresa, "0.00", "2026-12-10", null, true)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.campos.valor").exists());
    }

    @Test
    void deveEnviarEBaixarAnexoPdf() throws Exception {
        long idEmpresa = cadastrarEmpresa();
        String pdfBase64 = Base64.getEncoder().encodeToString("%PDF-1.4 teste de anexo".getBytes());
        String corpoComAnexo = json.writeValueAsString(new ContaController.ContaRequest(
                "Empresa API Contas", idEmpresa, "Balcão 01", "PJ", "pix", "Material",
                "AN-" + sufixo(), new BigDecimal("10.00"), LocalDate.parse("2026-12-10"),
                true, "nota.pdf", pdfBase64, false, true));
        String criado = mvc.perform(post("/api/contas").header("X-FinDesk-Token", TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpoComAnexo))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.anexoNome").value("nota.pdf"))
                .andReturn().getResponse().getContentAsString();
        long id = json.readTree(criado).get("id").asLong();

        mvc.perform(get("/api/contas/" + id + "/anexo").header("X-FinDesk-Token", TOKEN))
                .andExpect(status().isOk())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.content()
                        .contentType(MediaType.APPLICATION_PDF));

        // trocar a nota: PUT com outro arquivo (foto PNG) substitui nome e conteudo
        byte[] png = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0x0D};
        String corpoTroca = json.writeValueAsString(new ContaController.ContaRequest(
                "Empresa API Contas", idEmpresa, "Balcão 01", "PJ", "pix", "Material",
                null, new BigDecimal("10.00"), LocalDate.parse("2026-12-10"),
                true, "foto-nota.png", Base64.getEncoder().encodeToString(png), false, true));
        mvc.perform(put("/api/contas/" + id).header("X-FinDesk-Token", TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpoTroca))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.anexoNome").value("foto-nota.png"));
        mvc.perform(get("/api/contas/" + id + "/anexo").header("X-FinDesk-Token", TOKEN))
                .andExpect(status().isOk())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.content()
                        .contentType(MediaType.IMAGE_PNG));

        // excluir a nota: a conta fica sem anexo e o download responde 404
        mvc.perform(delete("/api/contas/" + id + "/anexo").header("X-FinDesk-Token", TOKEN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.anexoNome").doesNotExist())
                .andExpect(jsonPath("$.valor").value(10.00));
        mvc.perform(get("/api/contas/" + id + "/anexo").header("X-FinDesk-Token", TOKEN))
                .andExpect(status().isNotFound());
        mvc.perform(delete("/api/contas/999999999/anexo").header("X-FinDesk-Token", TOKEN))
                .andExpect(status().isNotFound());

        // anexo nao-PDF e recusado
        String corpoInvalido = json.writeValueAsString(new ContaController.ContaRequest(
                "Empresa API Contas", idEmpresa, "Balcão 01", "PJ", "pix", null,
                null, new BigDecimal("10.00"), LocalDate.parse("2026-12-11"),
                false, "nota.pdf", Base64.getEncoder().encodeToString("nao-pdf".getBytes()), false, true));
        mvc.perform(post("/api/contas").header("X-FinDesk-Token", TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpoInvalido))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.campos.anexo").exists());
    }
}
