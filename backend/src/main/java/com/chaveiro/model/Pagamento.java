package com.chaveiro.model;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Pagamento integral unico de uma conta (sem parciais, decisao aprovada).
 * O valor pago pode diferir do original (juros/desconto).
 */
public record Pagamento(
    Long id,
    Long idConta,
    LocalDate dataPagamento,
    BigDecimal valorPago,
    Long idBanco,
    String instituicaoBanco,
    String nomeEmpresa,
    String statusConta
) {}
