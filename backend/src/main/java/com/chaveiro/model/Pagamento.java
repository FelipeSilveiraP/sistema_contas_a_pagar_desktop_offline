package com.chaveiro.model;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Pagamento integral unico de uma conta (sem parciais, decisao aprovada).
 * O valor pago pode diferir do original (juros/desconto).
 */
public record Pagamento(
    Long id,
    Long idConta,
    LocalDate dataPagamento,
    BigDecimal valorPago,
    Long idBanco,
    String instituicaoBanco,
    String nomeEmpresa,
    String statusConta,
    /** como foi pago de verdade (PIX, DINHEIRO, CRÉDITO...; texto livre), pode diferir do formato da conta */
    String formaPagamento
) {
    /** Sem a forma de pagamento (pagamentos antigos e testes). */
    public Pagamento(Long id, Long idConta, LocalDate dataPagamento, BigDecimal valorPago, Long idBanco,
            String instituicaoBanco, String nomeEmpresa, String statusConta) {
        this(id, idConta, dataPagamento, valorPago, idBanco, instituicaoBanco, nomeEmpresa, statusConta, null);
    }
}
