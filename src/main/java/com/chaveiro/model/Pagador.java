package com.chaveiro.model;

import java.time.LocalDate;

/**
 * Entidade Pagador com especialização exclusiva e total (xt) entre PF e PJ.
 */
public record Pagador(
    Long idPagador,
    String nome,
    String telefone,
    LocalDate dataCadastro,
    TipoPessoa tipoPessoa,
    String cpf,
    String razaoSocial,
    String cnpj
) {
    public static Pagador pessoaFisica(String nome, String telefone, String cpf) {
        return new Pagador(null, nome, telefone, LocalDate.now(), TipoPessoa.PF, cpf, null, null);
    }

    public static Pagador pessoaJuridica(String nome, String telefone, String razaoSocial, String cnpj) {
        return new Pagador(null, nome, telefone, LocalDate.now(), TipoPessoa.PJ, null, razaoSocial, cnpj);
    }
}
