package com.chaveiro.api;

import com.chaveiro.model.Conta;
import com.chaveiro.service.AvisoService;
import com.chaveiro.service.ContaService;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Agregacoes para o painel de Graficos (dados reais do SQLite) e alertas de
 * vencimento do Menu (regra legada: atrasados de -15 a -1 dias; a vencer de 0 a 10).
 */
@RestController
@RequestMapping("/api")
public class DashboardController {

    public record CategoriaTotal(String categoria, long totalCentavos) {}
    public record MesTotal(String mes, long totalPagoCentavos) {}
    public record Resumo(
            long totalPagoCentavos,
            long totalPendenteCentavos,
            long vencidasCentavos,
            long aVencerCentavos,
            List<CategoriaTotal> porCategoria,
            List<MesTotal> porMes
    ) {}
    public record Alerta(long id, String nomeEmpresa, LocalDate vencimento,
                         java.math.BigDecimal valor, int dias) {}
    public record Alertas(List<Alerta> atrasados, List<Alerta> aVencer, int avisosAtivos) {}

    private final ContaService contas;
    private final AvisoService avisos;

    public DashboardController(ContaService contas, AvisoService avisos) {
        this.contas = contas;
        this.avisos = avisos;
    }

    @GetMapping("/dashboard/resumo")
    public Resumo resumo(@RequestParam(required = false) String de,
                         @RequestParam(required = false) String ate) {
        LocalDate inicio = de == null || de.isBlank() ? YearMonth.now().atDay(1) : LocalDate.parse(de);
        LocalDate fim = ate == null || ate.isBlank() ? YearMonth.now().atEndOfMonth() : LocalDate.parse(ate);
        LocalDate hoje = LocalDate.now();

        long pago = 0;
        long pendente = 0;
        long vencidas = 0;
        long aVencer = 0;
        Map<String, Long> porCategoria = new LinkedHashMap<>();
        Map<String, Long> porMes = new LinkedHashMap<>();

        for (Conta conta : contas.listar(null)) {
            boolean noPeriodo = !conta.vencimento().isBefore(inicio) && !conta.vencimento().isAfter(fim);
            if ("PAGO".equals(conta.status()) && noPeriodo) {
                pago += centavos(conta);
                String mes = conta.vencimento().toString().substring(0, 7);
                porMes.merge(mes, centavos(conta), Long::sum);
            } else if ("PENDENTE".equals(conta.status()) && noPeriodo) {
                pendente += centavos(conta);
                if (conta.vencimento().isBefore(hoje)) {
                    vencidas += centavos(conta);
                } else {
                    aVencer += centavos(conta);
                }
            }
            if (noPeriodo && conta.categoria() != null) {
                porCategoria.merge(conta.categoria(), centavos(conta), Long::sum);
            }
        }

        List<CategoriaTotal> categorias = new ArrayList<>();
        porCategoria.forEach((nome, total) -> categorias.add(new CategoriaTotal(nome, total)));
        categorias.sort(Comparator.comparingLong(CategoriaTotal::totalCentavos).reversed());
        List<MesTotal> meses = new ArrayList<>();
        porMes.forEach((mes, total) -> meses.add(new MesTotal(mes, total)));
        meses.sort(Comparator.comparing(MesTotal::mes));

        return new Resumo(pago, pendente, vencidas, aVencer, categorias, meses);
    }

    @GetMapping("/contas/alertas")
    public Alertas alertas() {
        LocalDate hoje = LocalDate.now();
        List<Alerta> atrasados = new ArrayList<>();
        List<Alerta> aVencer = new ArrayList<>();
        for (Conta conta : contas.listar("PENDENTE")) {
            int dias = (int) java.time.temporal.ChronoUnit.DAYS.between(hoje, conta.vencimento());
            if (dias >= -15 && dias < 0) {
                atrasados.add(new Alerta(conta.id(), conta.nomeEmpresa(), conta.vencimento(), conta.valor(), dias));
            } else if (dias >= 0 && dias <= 10) {
                aVencer.add(new Alerta(conta.id(), conta.nomeEmpresa(), conta.vencimento(), conta.valor(), dias));
            }
        }
        int ativos = (int) avisos.listar().stream().filter(a -> AvisoService.ativoEm(a, hoje)).count();
        return new Alertas(atrasados, aVencer, ativos);
    }

    private static long centavos(Conta conta) {
        return conta.valor().movePointRight(2).longValueExact();
    }
}
