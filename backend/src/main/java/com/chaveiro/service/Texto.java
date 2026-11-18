package com.chaveiro.service;

import java.util.Locale;

/**
 * Todo texto digitado e gravado em MAIUSCULAS (pedido do usuario, 2026-11-18), com acento
 * (ç → Ç, ã → Ã). Ficam de fora so os campos tecnicos que quebrariam: e-mail, PIN, senha,
 * chave Pix, nomes de arquivo e codigos (forma de pagamento etc.).
 */
public final class Texto {

    private static final Locale PT_BR = Locale.of("pt", "BR");

    private Texto() {
    }

    /** "  aluguel do galpão " → "ALUGUEL DO GALPÃO"; nulo continua nulo. */
    public static String maiusculas(String valor) {
        return valor == null ? null : valor.trim().toUpperCase(PT_BR);
    }

    /** Igual a {@link #maiusculas}, mas vazio vira nulo (campos opcionais). */
    public static String maiusculasOuNulo(String valor) {
        return valor == null || valor.isBlank() ? null : maiusculas(valor);
    }
}
