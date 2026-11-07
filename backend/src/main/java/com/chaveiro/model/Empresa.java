package com.chaveiro.model;

import java.util.List;

/**
 * Empresa/fornecedora emitente de despesas da oficina.
 * Telefones seguem 1FN (tabela telefones_empresa), conforme DER legado.
 */
public record Empresa(
    Long id,
    String cnpj,
    String razaoSocial,
    String nomeRepresentante,
    String email,
    String logradouro,
    List<TelefoneEmpresa> telefones
) {
    public record TelefoneEmpresa(String numero, String tipo) {}
}
