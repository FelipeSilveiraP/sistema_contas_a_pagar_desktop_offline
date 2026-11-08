package com.chaveiro.service;

import com.chaveiro.model.Conta;

/**
 * Possivel duplicidade detectada na insercao (regra do sistema legado).
 * O cliente decide: confirmar (forcar insercao) ou cancelar.
 */
public class PossivelDuplicataException extends RuntimeException {

    private final Conta existente;

    public PossivelDuplicataException(Conta existente) {
        super("possivel duplicidade de conta");
        this.existente = existente;
    }

    public Conta getExistente() {
        return existente;
    }
}
