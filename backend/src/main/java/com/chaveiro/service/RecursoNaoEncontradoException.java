package com.chaveiro.service;

/**
 * Registro solicitado nao existe.
 */
public class RecursoNaoEncontradoException extends RuntimeException {

    public RecursoNaoEncontradoException(String recurso) {
        super(recurso + " nao encontrado");
    }
}
