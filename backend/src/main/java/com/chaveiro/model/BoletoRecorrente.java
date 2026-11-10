package com.chaveiro.model;

import java.math.BigDecimal;

/**
 * Conta recorrente (form roxo do Stitch). O dia configurado e preservado;
 * em meses sem o dia, a geracao usa o ultimo dia do mes.
 */
public record BoletoRecorrente(
    Long id,
    String nomeEmpresa,
    Long idEmpresa,
    String pagadorResponsavel,
    String categoria,
    String numeroDocumento,
    BigDecimal valor,
    int dia,
    String periodicidade,
    String formaPagamento,
    boolean ativo,
    String tipoPessoa
) {}
