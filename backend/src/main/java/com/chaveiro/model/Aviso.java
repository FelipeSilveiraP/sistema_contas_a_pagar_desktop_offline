package com.chaveiro.model;

import java.time.LocalDate;

/**
 * Mensagem/aviso interno com vigencia (periodo + dia da semana).
 */
public record Aviso(
    Long id,
    LocalDate dataInicio,
    LocalDate dataFim,
    String diaSemana,
    String titulo,
    String mensagem
) {}
