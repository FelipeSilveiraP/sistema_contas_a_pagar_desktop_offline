package com.chaveiro.model;

import java.time.LocalDate;

/**
 * Entidade central Conta a Pagar derivada do DER do Chaveiro Universal.
 * Agrega os identificadores relacionais e campos de exibição direta.
 */
public record Conta(
    Long idConta,
    Long idEmpresa,
    String nomeEmpresa,
    Long idCategoria,
    String nomeCategoria,
    Long idFormaPagamento,
    String tipoFormaPagamento,
    Long idPagador,
    String nomePagador,
    Long idNota,
    LocalDate dataVencimento,
    double valorTotal,
    StatusConta statusPagamento,
    boolean naPasta,
    String numeroDocumento,
    String observacoes,
    boolean recorrente
) {
    /**
     * Construtor simplificado para cadastro rápido (sem IDs ou com defaults).
     */
    public static Conta nova(Long idEmpresa, String nomeEmpresa, Long idCategoria, 
                             Long idPagador, String nomePagador, double valorTotal, 
                             LocalDate dataVencimento, String numeroDocumento, 
                             boolean naPasta, boolean recorrente) {
        return new Conta(
            null,
            idEmpresa,
            nomeEmpresa,
            idCategoria != null ? idCategoria : 1L,
            null,
            1L, // Boleto Bancário default
            null,
            idPagador != null ? idPagador : 1L,
            nomePagador != null && !nomePagador.isBlank() ? nomePagador : "LIVIA METIDIERI",
            null,
            dataVencimento,
            valorTotal,
            StatusConta.PENDENTE,
            naPasta,
            numeroDocumento,
            null,
            recorrente
        );
    }

    /**
     * Retorna cópia com status alterado para PAGO.
     */
    public Conta liquidada() {
        return new Conta(
            this.idConta,
            this.idEmpresa,
            this.nomeEmpresa,
            this.idCategoria,
            this.nomeCategoria,
            this.idFormaPagamento,
            this.tipoFormaPagamento,
            this.idPagador,
            this.nomePagador,
            this.idNota,
            this.dataVencimento,
            this.valorTotal,
            StatusConta.PAGO,
            this.naPasta,
            this.numeroDocumento,
            this.observacoes,
            this.recorrente
        );
    }
}
