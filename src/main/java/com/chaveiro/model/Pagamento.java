package com.chaveiro.model;

import java.time.LocalDate;

/**
 * Liquidação efetiva de uma conta no banco, registrando o pagador e a movimentação bancária.
 */
public record Pagamento(
    Long idPagamento,
    Long idConta,
    Long idPagador,
    String nomePagador,
    Long idBanco,
    String nomeBanco,
    LocalDate dataPagamento,
    double valorPago,
    String caminhoComprovante
) {
    public static Pagamento liquidar(Long idConta, Long idPagador, Long idBanco, double valorPago, String comprovante) {
        return new Pagamento(
            null,
            idConta,
            idPagador,
            null,
            idBanco,
            null,
            LocalDate.now(),
            valorPago,
            comprovante
        );
    }
}
