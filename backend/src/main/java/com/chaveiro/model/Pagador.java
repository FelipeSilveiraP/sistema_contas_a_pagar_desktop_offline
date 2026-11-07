package com.chaveiro.model;

/**
 * Pagador responsavel pelos pagamentos da oficina (pessoa fisica).
 * Cadastro simplista: nome, CPF e funcao (cargo) conforme aprovado pelo usuario.
 */
public record Pagador(
    Long id,
    String nome,
    String cpf,
    String funcao
) {}
