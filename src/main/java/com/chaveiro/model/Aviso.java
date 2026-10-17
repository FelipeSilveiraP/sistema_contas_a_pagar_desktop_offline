package com.chaveiro.model;

import java.time.LocalDate;

/**
 * Entidade AVISO do quadro de recados e avisos da oficina.
 */
public record Aviso(
    Long idAviso,
    String titulo,
    String mensagem,
    LocalDate dataInicio,
    LocalDate dataFim,
    String diaSemana,
    String autor,
    boolean statusAtivo
) {}
