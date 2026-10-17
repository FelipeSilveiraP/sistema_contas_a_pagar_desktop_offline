package com.chaveiro;

import com.chaveiro.repository.ContaRepository;
import com.chaveiro.service.ContaService;

/**
 * Composition Root da aplicação (Pure Dependency Injection).
 * Centraliza a instanciação e conexão entre Repositories e Services
 * sem exigir bibliotecas pesadas como Spring Boot ou Micronaut.
 */
public final class AppContainer {

    private final ContaRepository contaRepository;
    private final ContaService contaService;

    public AppContainer() {
        this.contaRepository = new ContaRepository();
        this.contaService = new ContaService(contaRepository);
    }

    public ContaRepository getContaRepository() {
        return contaRepository;
    }

    public ContaService getContaService() {
        return contaService;
    }
}
