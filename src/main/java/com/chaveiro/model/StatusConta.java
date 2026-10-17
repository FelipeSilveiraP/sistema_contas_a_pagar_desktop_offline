package com.chaveiro.model;

/**
 * Status operacional de um título ou despesa a pagar.
 */
public enum StatusConta {
    PENDENTE("Pendente", "#FACC15"),
    PAGO("Pago", "#10B981"),
    ATRASADO("Atrasado", "#EF4444");

    private final String descricao;
    private final String corHex;

    StatusConta(String descricao, String corHex) {
        this.descricao = descricao;
        this.corHex = corHex;
    }

    public String getDescricao() {
        return descricao;
    }

    public String getCorHex() {
        return corHex;
    }

    public static StatusConta fromString(String valor) {
        if (valor == null || valor.isBlank()) return PENDENTE;
        return switch (valor.trim().toUpperCase()) {
            case "PAGO" -> PAGO;
            case "ATRASADO" -> ATRASADO;
            default -> PENDENTE;
        };
    }
}
