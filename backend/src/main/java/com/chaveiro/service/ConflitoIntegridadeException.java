package com.chaveiro.service;

/**
 * Operacao recusada para preservar integridade referencial de registros financeiros.
 */
public class ConflitoIntegridadeException extends RuntimeException {

    public ConflitoIntegridadeException(String mensagem) {
        super(mensagem);
    }
}
