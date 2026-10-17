package com.chaveiro.model;

public enum TipoPessoa {
    PF("Pessoa Física"),
    PJ("Pessoa Jurídica");

    private final String descricao;

    TipoPessoa(String descricao) {
        this.descricao = descricao;
    }

    public String getDescricao() {
        return descricao;
    }

    public static TipoPessoa fromString(String valor) {
        if (valor == null || valor.isBlank()) return PF;
        return switch (valor.trim().toUpperCase()) {
            case "PJ", "PESSOA JURÍDICA", "PESSOA JURIDICA" -> PJ;
            default -> PF;
        };
    }
}
