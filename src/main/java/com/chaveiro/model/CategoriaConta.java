package com.chaveiro.model;

/**
 * Categoria financeira para agrupamento das despesas e relatórios gráficos.
 */
public record CategoriaConta(
    Long idCategoria,
    String nomeCategoria,
    String descricao
) {}
