package com.chaveiro.model;

/**
 * Instituicao bancaria usada na movimentacao da oficina, com chave Pix opcional.
 */
public record Banco(
    Long id,
    String instituicao,
    String chavePix
) {}
