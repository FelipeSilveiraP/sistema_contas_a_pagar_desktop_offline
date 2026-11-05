package com.chaveiro.api;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class ContasController {

    public record ContaResumo(Long id, String empresa, BigDecimal valor,
                              LocalDate vencimento, String status) {
    }

    @GetMapping("/contas")
    public List<ContaResumo> listar() {
        return List.of(
                new ContaResumo(1L, "DADOS DE TESTE - FASE 1", new BigDecimal("840.00"),
                        LocalDate.of(2023, 10, 24), "PENDENTE"),
                new ContaResumo(2L, "DADOS DE TESTE - FASE 1", new BigDecimal("320.50"),
                        LocalDate.of(2023, 10, 25), "PENDENTE"),
                new ContaResumo(3L, "DADOS DE TESTE - FASE 1", new BigDecimal("260.00"),
                        LocalDate.of(2023, 10, 28), "PAGO")
        );
    }
}
