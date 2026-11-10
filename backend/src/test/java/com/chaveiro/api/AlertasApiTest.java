package com.chaveiro.api;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.chaveiro.model.Aviso;
import com.chaveiro.model.Conta;
import com.chaveiro.model.Empresa;
import com.chaveiro.service.AvisoService;
import com.chaveiro.service.ContaService;
import com.chaveiro.service.EmpresaService;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Alertas do Menu ("Mensagens do dia") — regra do VBA VerificarVencimentosAoAbrir:
 * atrasadas de 1 a 15 dias, a vencer de hoje ate 10 dias, recados vigentes hoje.
 */
@SpringBootTest
@AutoConfigureMockMvc
class AlertasApiTest {

    private static final String TOKEN = "token-teste-unitario";

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ContaService contas;

    @Autowired
    private EmpresaService empresas;

    @Autowired
    private AvisoService avisos;

    private void conta(long idEmpresa, String nome, int diasAteVencimento, boolean naPasta) {
        contas.cadastrar(new Conta(null, nome, idEmpresa, null, "Balcão 01", "PJ", "boleto", "Aluguel",
                null, new BigDecimal("150.75"), LocalDate.now().plusDays(diasAteVencimento), naPasta, null, null),
                null, true);
    }

    @Test
    void deveSepararAtrasadasEAVencerNaJanelaDoVbaComPastaEPagador() throws Exception {
        String s = UUID.randomUUID().toString().substring(0, 8);
        long idEmpresa = empresas.cadastrar(new Empresa(null, null, "Empresa Alertas " + s, null, null, null, List.of())).id();
        conta(idEmpresa, "ATRASADA 3 DIAS " + s, -3, true);
        conta(idEmpresa, "ATRASADA 16 DIAS " + s, -16, false);
        conta(idEmpresa, "VENCE HOJE " + s, 0, false);
        conta(idEmpresa, "VENCE EM 10 " + s, 10, false);
        conta(idEmpresa, "VENCE EM 11 " + s, 11, false);

        mvc.perform(get("/api/contas/alertas").header("X-FinDesk-Token", TOKEN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.hoje").value(LocalDate.now().toString()))
                .andExpect(jsonPath("$.atrasados[?(@.nomeEmpresa == 'ATRASADA 3 DIAS " + s + "')].dias").value(contains(-3)))
                .andExpect(jsonPath("$.atrasados[?(@.nomeEmpresa == 'ATRASADA 3 DIAS " + s + "')].boletoNaPasta").value(contains(true)))
                .andExpect(jsonPath("$.atrasados[?(@.nomeEmpresa == 'ATRASADA 3 DIAS " + s + "')].pagadorResponsavel").value(contains("Balcão 01")))
                .andExpect(jsonPath("$.atrasados[?(@.nomeEmpresa == 'ATRASADA 16 DIAS " + s + "')]").value(empty()))
                .andExpect(jsonPath("$.aVencer[*].nomeEmpresa").value(hasItem("VENCE HOJE " + s)))
                .andExpect(jsonPath("$.aVencer[*].nomeEmpresa").value(hasItem("VENCE EM 10 " + s)))
                .andExpect(jsonPath("$.aVencer[?(@.nomeEmpresa == 'VENCE EM 11 " + s + "')]").value(empty()));
    }

    @Test
    void resumoDeveConsolidarPendentesPorMesEMaioresFornecedores() throws Exception {
        String s = UUID.randomUUID().toString().substring(0, 6).toUpperCase();
        long idEmpresa = empresas.cadastrar(new Empresa(null, null, "Empresa Resumo " + s, null, null, null, List.of())).id();
        LocalDate base = LocalDate.of(2031, 3, 10);
        for (String[] c : new String[][] {{"GRANDE " + s, "900.00"}, {"GRANDE " + s, "100.00"}, {"PEQUENO " + s, "50.25"}}) {
            contas.cadastrar(new Conta(null, c[0], idEmpresa, null, "Balcão 01", "PJ", "boleto", "Aluguel",
                    null, new BigDecimal(c[1]), base, false, null, null), null, true);
        }

        mvc.perform(get("/api/dashboard/resumo").param("de", "2031-03-01").param("ate", "2031-03-31")
                        .header("X-FinDesk-Token", TOKEN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalPendenteCentavos").value(105025))
                .andExpect(jsonPath("$.quantidadePendentes").value(3))
                .andExpect(jsonPath("$.porMes[0].mes").value("2031-03"))
                .andExpect(jsonPath("$.porMes[0].totalPendenteCentavos").value(105025))
                .andExpect(jsonPath("$.maioresFornecedores[0].nomeEmpresa").value("GRANDE " + s))
                .andExpect(jsonPath("$.maioresFornecedores[0].totalCentavos").value(100000))
                .andExpect(jsonPath("$.maioresFornecedores[0].quantidade").value(2))
                .andExpect(jsonPath("$.maioresFornecedores[1].nomeEmpresa").value("PEQUENO " + s));
    }

    @Test
    void deveTrazerSomenteRecadosVigentesHoje() throws Exception {
        String s = UUID.randomUUID().toString().substring(0, 8);
        LocalDate hoje = LocalDate.now();
        avisos.cadastrar(new Aviso(null, hoje.minusDays(1), hoje.plusDays(1), "TODOS", "VIGENTE " + s, "Conferir o caixa"));
        avisos.cadastrar(new Aviso(null, hoje.minusDays(10), hoje.minusDays(2), "TODOS", "EXPIRADO " + s, "Ja passou"));

        mvc.perform(get("/api/contas/alertas").header("X-FinDesk-Token", TOKEN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.avisosHoje[*].titulo").value(hasItem("VIGENTE " + s)))
                .andExpect(jsonPath("$.avisosHoje[?(@.titulo == 'VIGENTE " + s + "')].mensagem").value(contains("Conferir o caixa")))
                .andExpect(jsonPath("$.avisosHoje[?(@.titulo == 'EXPIRADO " + s + "')]").value(empty()));
    }
}
