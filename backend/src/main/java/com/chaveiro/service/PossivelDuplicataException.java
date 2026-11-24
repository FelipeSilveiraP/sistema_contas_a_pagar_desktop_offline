package com.chaveiro.service;

import com.chaveiro.repository.ContaRepository;

import com.chaveiro.model.Conta;

/**
 * Possivel duplicidade detectada na insercao (regra do sistema legado).
 * O cliente decide: confirmar (forcar insercao) ou cancelar.
 */
public class PossivelDuplicataException extends RuntimeException {

    private final Conta existente;
    private final ContaRepository.RecorrenteResumo recorrente;

    public PossivelDuplicataException(Conta existente) {
        this(existente, null);
    }

    /** `existente` pode faltar quando so a conta recorrente bate (a conta do mes ainda nao foi gerada). */
    public PossivelDuplicataException(Conta existente, ContaRepository.RecorrenteResumo recorrente) {
        super("possivel duplicidade de conta");
        this.existente = existente;
        this.recorrente = recorrente;
    }

    public ContaRepository.RecorrenteResumo getRecorrente() {
        return recorrente;
    }

    public Conta getExistente() {
        return existente;
    }
}
