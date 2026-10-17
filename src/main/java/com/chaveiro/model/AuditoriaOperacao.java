package com.chaveiro.model;

import java.time.LocalDateTime;

/**
 * Trilha de auditoria financeira append-only para conformidade e segurança.
 */
public record AuditoriaOperacao(
    Long idAuditoria,
    LocalDateTime dataHora,
    String operador,
    String tipoAcao,
    String entidade,
    Long registroId,
    String detalhesJson
) {}
