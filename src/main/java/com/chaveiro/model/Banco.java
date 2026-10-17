package com.chaveiro.model;

/**
 * Instituição bancária e conta corrente utilizada para movimentação financeira.
 */
public record Banco(
    Long idBanco,
    String nomeInstituicao,
    String tipoConta,
    String agencia,
    String contaCorrente,
    String chavePix
) {}
