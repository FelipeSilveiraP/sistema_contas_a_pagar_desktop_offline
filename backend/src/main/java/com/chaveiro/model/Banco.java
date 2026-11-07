package com.chaveiro.model;

/**
 * Conta bancaria de uma instituicao financeira, usada na movimentacao da oficina.
 * Registra a instituicao (ex.: Banco do Brasil) e a conta (agencia/conta/chave Pix).
 */
public record Banco(
    Long id,
    String instituicao,
    String codigoBanco,
    String agencia,
    String conta,
    String chavePix
) {}
