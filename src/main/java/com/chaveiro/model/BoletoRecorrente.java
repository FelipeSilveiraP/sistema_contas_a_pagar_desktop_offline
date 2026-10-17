package com.chaveiro.model;

/**
 * Padrão de recorrência mensal/anual que serve de molde para geração em lote.
 */
public record BoletoRecorrente(
    Long idBoletoRecorrente,
    Long idEmpresa,
    String nomeEmpresa,
    Long idCategoria,
    String nomeCategoria,
    Long idPagador,
    String nomePagador,
    Long idFormaPagamento,
    int diaVencimento,
    double valorPadrao,
    String numeroDocumento,
    boolean statusAtivo
) {}
