package com.chaveiro.model;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Conta a pagar da oficina (boleto/despesa), conforme o formulario Stitch
 * "Inserir Conta - Formulario em 2 Etapas". Nome da empresa e pagador
 * responsavel em texto livre (regra do sistema legado); empresa emissora e
 * um vinculo opcional com o cadastro. Valor monetario exato (BigDecimal).
 */
public record Conta(
    Long id,
    String nomeEmpresa,
    Long idEmpresa,
    String razaoSocial,
    String pagadorResponsavel,
    String tipoPessoa,
    String formaPagamento,
    String categoria,
    String numeroDocumento,
    BigDecimal valor,
    LocalDate vencimento,
    boolean boletoNaPasta,
    String anexoNome,
    boolean semNotaFiscal,
    /** data (aaaa-mm-dd) em que a limpeza trimestral apagou o arquivo da nota */
    String anexoRemovidoEm,
    String status
) {}
