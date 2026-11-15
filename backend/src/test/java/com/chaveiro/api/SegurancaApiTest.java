package com.chaveiro.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.chaveiro.web.TokenFilter;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.servlet.mvc.method.RequestMappingInfo;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;

/**
 * Auditoria de seguranca 2026-11-15: token em TODAS as rotas, limites de
 * tamanho, erros 4xx (nao 500), teto de valor e nome do anexo no download.
 */
@SpringBootTest
@AutoConfigureMockMvc
class SegurancaApiTest {

    private static final String TOKEN = "token-teste-unitario";

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper json;

    @Autowired
    @Qualifier("requestMappingHandlerMapping")
    private RequestMappingHandlerMapping rotas;

    /** Todas as rotas da API, lidas do proprio Spring: rota nova entra no teste sozinha. */
    private List<String[]> todasAsRotas() {
        List<String[]> lista = new ArrayList<>();
        for (RequestMappingInfo info : rotas.getHandlerMethods().keySet()) {
            for (String caminho : info.getPatternValues()) {
                for (RequestMethod metodo : info.getMethodsCondition().getMethods()) {
                    lista.add(new String[] {metodo.name(), caminho.replaceAll("\\{[^}]+}", "1")});
                }
            }
        }
        return lista;
    }

    @Test
    void todasAsRotasExigemOToken() throws Exception {
        List<String[]> lista = todasAsRotas();
        assertThat(lista).hasSizeGreaterThan(30);
        for (String[] rota : lista) {
            for (String tokenErrado : new String[] {null, "", "errado", TOKEN + "x", TOKEN.toUpperCase()}) {
                var pedido = request(HttpMethod.valueOf(rota[0]), rota[1])
                        .contentType(MediaType.APPLICATION_JSON).content("{}");
                if (tokenErrado != null) {
                    pedido.header("X-FinDesk-Token", tokenErrado);
                }
                MvcResult resultado = mvc.perform(pedido).andReturn();
                assertThat(resultado.getResponse().getStatus())
                        .as("%s %s com token %s", rota[0], rota[1], tokenErrado)
                        .isEqualTo(401);
            }
        }
    }

    @Test
    void rotaInexistenteSemTokenTambemDa401() throws Exception {
        // sem token nem se revela quais rotas existem
        mvc.perform(get("/api/nao-existe")).andExpect(status().isUnauthorized());
        mvc.perform(get("/actuator/env")).andExpect(status().isUnauthorized());
    }

    @Test
    void errosDoClienteDevolvem4xxENao500() throws Exception {
        mvc.perform(get("/api/nao-existe").header("X-FinDesk-Token", TOKEN)).andExpect(status().isNotFound());
        mvc.perform(request(HttpMethod.PATCH, "/api/contas/1").header("X-FinDesk-Token", TOKEN))
                .andExpect(status().isMethodNotAllowed());
        mvc.perform(post("/api/contas").header("X-FinDesk-Token", TOKEN)
                        .contentType(MediaType.TEXT_PLAIN).content("x"))
                .andExpect(status().isUnsupportedMediaType());
        mvc.perform(get("/api/contas/abc").header("X-FinDesk-Token", TOKEN)).andExpect(status().isBadRequest());
        mvc.perform(get("/api/dashboard/resumo").param("ate", "31/12/2026").header("X-FinDesk-Token", TOKEN))
                .andExpect(status().isBadRequest());
    }

    @Test
    void respostasTrazemCabecalhosDeSeguranca() throws Exception {
        mvc.perform(get("/api/status").header("X-FinDesk-Token", TOKEN))
                .andExpect(header().string("X-Content-Type-Options", "nosniff"))
                .andExpect(header().string("Cache-Control", "no-store"));
    }

    @Test
    void corpoGrandeDemaisERecusadoAntesDeSerLido() throws Exception {
        byte[] enorme = new byte[(int) TokenFilter.LIMITE_CORPO_BYTES + 1];
        mvc.perform(post("/api/contas").header("X-FinDesk-Token", TOKEN)
                        .contentType(MediaType.APPLICATION_JSON).content(enorme))
                .andExpect(status().isPayloadTooLarge());
    }

    @Test
    void corpoSemTamanhoDeclaradoERecusado() throws Exception {
        mvc.perform(post("/api/contas").header("X-FinDesk-Token", TOKEN)
                        .header("Transfer-Encoding", "chunked").contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isLengthRequired());
    }

    @Test
    void backendNaoSobeComTokenVazioOuCurto() {
        for (String token : new String[] {"", "   ", "curto"}) {
            TokenFilter filtro = new TokenFilter();
            ReflectionTestUtils.setField(filtro, "tokenEsperado", token);
            assertThatThrownBy(() -> ReflectionTestUtils.invokeMethod(filtro, "conferirToken"))
                    .isInstanceOf(IllegalStateException.class);
        }
    }

    private Map<String, Object> conta(String valor) {
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("nomeEmpresa", "Fornecedor Seguranca");
        corpo.put("pagadorResponsavel", "Caixa");
        corpo.put("tipoPessoa", "PJ");
        corpo.put("formaPagamento", "pix");
        corpo.put("valor", valor);
        corpo.put("vencimento", "2032-03-10");
        corpo.put("semNotaFiscal", true);
        corpo.put("forcar", true);
        return corpo;
    }

    @Test
    void valorAbsurdoERecusadoComMensagemENaoEstouraOBanco() throws Exception {
        for (String valor : new String[] {"1000000000.00", "99999999999999999999999", "1e30"}) {
            mvc.perform(post("/api/contas").header("X-FinDesk-Token", TOKEN)
                            .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(conta(valor))))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.campos.valor").exists());
        }
        mvc.perform(post("/api/contas").header("X-FinDesk-Token", TOKEN)
                        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(conta("999999999.99"))))
                .andExpect(status().isCreated());
    }

    @Test
    void nomeDoAnexoNaoInjetaCabecalhoNoDownload() throws Exception {
        Map<String, Object> corpo = conta("12.34");
        corpo.put("semNotaFiscal", false);
        corpo.put("anexoNome", "nota\r\nSet-Cookie: x=1\"; ação.pdf");
        corpo.put("anexoPdfBase64", Base64.getEncoder().encodeToString(
                "%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF".getBytes(StandardCharsets.ISO_8859_1)));
        MvcResult criada = mvc.perform(post("/api/contas").header("X-FinDesk-Token", TOKEN)
                        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(corpo)))
                .andExpect(status().isCreated()).andReturn();
        long id = json.readTree(criada.getResponse().getContentAsByteArray()).get("id").asLong();

        MvcResult download = mvc.perform(get("/api/contas/" + id + "/anexo").header("X-FinDesk-Token", TOKEN))
                .andExpect(status().isOk()).andReturn();
        String disposicao = download.getResponse().getHeader("Content-Disposition");
        assertThat(disposicao).startsWith("attachment;").doesNotContain("\r", "\n");
        assertThat(download.getResponse().getHeader("Set-Cookie")).isNull();
        assertThat(download.getResponse().getContentType()).isEqualTo("application/pdf");
    }
}
