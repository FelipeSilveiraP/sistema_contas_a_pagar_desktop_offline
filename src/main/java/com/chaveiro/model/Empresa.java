package com.chaveiro.model;

import java.time.LocalDate;

/**
 * Entidade que representa os fornecedores e empresas emitentes de despesas.
 */
public record Empresa(
    Long idEmpresa,
    String cnpj,
    String razaoSocial,
    String nomeRepresentante,
    String email,
    String logradouro,
    LocalDate dataCadastro
) {}
