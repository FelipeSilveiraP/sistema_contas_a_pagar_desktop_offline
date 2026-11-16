package com.chaveiro.service;

import java.util.Map;

/**
 * Acesso de conta recusado: 401 (sem sessao ou PIN errado), 403 (so o admin pode)
 * ou 423 (conta bloqueada por PINs errados). "extra" vai no corpo da resposta.
 */
public class AcessoNegadoException extends RuntimeException {

    private final int status;
    private final Map<String, Object> extra;

    public AcessoNegadoException(int status, String mensagem) {
        this(status, mensagem, Map.of());
    }

    public AcessoNegadoException(int status, String mensagem, Map<String, Object> extra) {
        super(mensagem);
        this.status = status;
        this.extra = extra;
    }

    public int getStatus() {
        return status;
    }

    public Map<String, Object> getExtra() {
        return extra;
    }
}
