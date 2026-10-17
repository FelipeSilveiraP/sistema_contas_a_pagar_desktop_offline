package com.chaveiro.model;

/**
 * Meio ou forma de liquidação de títulos (Boleto, Pix, Cartão, Dinheiro).
 */
public record FormaPagamento(
    Long idForma,
    String tipoPagamento
) {}
