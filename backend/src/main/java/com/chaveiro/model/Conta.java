package com.chaveiro.model;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Conta a pagar da oficina (boleto/despesa). Valor monetario exato (BigDecimal).
 * razaoSocial e nomePagador vem do join de cadastros para exibicao.
 */
public record Conta(
    Long id,
    Long idEmpresa,
    String razaoSocial,
    Long idPagador,
    String nomePagador,
    String categoria,
    String numeroDocumento,
    BigDecimal valor,
    LocalDate vencimento,
    boolean boletoNaPasta,
    String status
) {}
