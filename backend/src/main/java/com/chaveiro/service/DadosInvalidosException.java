package com.chaveiro.service;

import java.util.Map;

/**
 * Dados recebidos nao passaram nas validacoes de cadastro.
 */
public class DadosInvalidosException extends RuntimeException {

    private final Map<String, String> campos;

    public DadosInvalidosException(Map<String, String> campos) {
        super("dados invalidos");
        this.campos = Map.copyOf(campos);
    }

    public Map<String, String> getCampos() {
        return campos;
    }
}
