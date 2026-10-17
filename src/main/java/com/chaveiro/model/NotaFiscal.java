package com.chaveiro.model;

import java.time.LocalDate;

/**
 * Nota Fiscal vinculada opcionalmente (0,1) a uma Conta a Pagar.
 */
public record NotaFiscal(
    Long idNota,
    String numeroNota,
    LocalDate dataEmissao,
    String chaveAcesso,
    double valorTotal,
    String arquivoPdf
) {}
