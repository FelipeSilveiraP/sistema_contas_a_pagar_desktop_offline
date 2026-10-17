package com.chaveiro.model;

import java.time.LocalDateTime;

public record Mensagem(
    Long id,
    String titulo,
    String conteudo,
    String autor,
    boolean ativa,
    LocalDateTime dataCriacao
) {}
