package com.chaveiro.model;

/**
 * Telefones de contato do fornecedor (1FN estrita do DER).
 */
public record TelefoneEmpresa(
    Long idTelefone,
    Long idEmpresa,
    String numero,
    String tipo
) {}
