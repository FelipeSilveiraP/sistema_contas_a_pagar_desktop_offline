package com.chaveiro.service;

import com.chaveiro.model.Pagador;
import com.chaveiro.repository.PagadorRepository;
import java.sql.SQLException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Validacoes e regras de negocio do cadastro de pagadores.
 * Regras: nome obrigatorio; CPF opcional (validado por digitos verificadores
 * quando preenchido); funcao (cargo) opcional com ate 100 caracteres.
 */
@Service
public class PagadorService {

    private static final Logger log = LoggerFactory.getLogger(PagadorService.class);

    private final PagadorRepository repository;

    public PagadorService(PagadorRepository repository) {
        this.repository = repository;
    }

    public List<Pagador> listar() {
        try {
            return repository.listar();
        } catch (SQLException erro) {
            log.error("falha ao listar pagadores", erro);
            throw new IllegalStateException("falha ao consultar os pagadores", erro);
        }
    }

    public Pagador buscarPorId(long id) {
        try {
            return repository.buscarPorId(id)
                    .orElseThrow(() -> new RecursoNaoEncontradoException("pagador"));
        } catch (SQLException erro) {
            log.error("falha ao buscar pagador id={}", id, erro);
            throw new IllegalStateException("falha ao consultar o pagador", erro);
        }
    }

    public Pagador cadastrar(Pagador dados) {
        Pagador normalizado = normalizar(dados, null);
        validar(normalizado);
        try {
            return repository.inserir(normalizado);
        } catch (SQLException erro) {
            log.error("falha ao cadastrar pagador", erro);
            throw new IllegalStateException("falha ao salvar o pagador", erro);
        }
    }

    public Pagador atualizar(long id, Pagador dados) {
        Pagador normalizado = normalizar(dados, id);
        validar(normalizado);
        try {
            if (!repository.atualizar(id, normalizado)) {
                throw new RecursoNaoEncontradoException("pagador");
            }
            return normalizado;
        } catch (SQLException erro) {
            log.error("falha ao atualizar pagador id={}", id, erro);
            throw new IllegalStateException("falha ao atualizar o pagador", erro);
        }
    }

    public void excluir(long id) {
        try {
            if (!repository.excluir(id)) {
                throw new RecursoNaoEncontradoException("pagador");
            }
        } catch (SQLException erro) {
            log.error("falha ao excluir pagador id={}", id, erro);
            throw new IllegalStateException("falha ao excluir o pagador", erro);
        }
    }

    private static Pagador normalizar(Pagador dados, Long id) {
        String cpf = dados.cpf() == null ? "" : dados.cpf().replaceAll("\\D", "");
        return new Pagador(
                id,
                dados.nome() == null ? "" : dados.nome().trim(),
                cpf.isEmpty() ? null : cpf,
                dados.funcao() == null || dados.funcao().isBlank() ? null : dados.funcao().trim()
        );
    }

    private static void validar(Pagador pagador) {
        Map<String, String> erros = new LinkedHashMap<>();

        if (pagador.nome().length() < 2 || pagador.nome().length() > 120) {
            erros.put("nome", "informe o nome do pagador (2 a 120 caracteres)");
        }
        if (pagador.cpf() != null && !cpfValido(pagador.cpf())) {
            erros.put("cpf", "CPF invalido (11 digitos com digitos verificadores)");
        }
        if (pagador.funcao() != null && pagador.funcao().length() > 100) {
            erros.put("funcao", "funcao deve ter ate 100 caracteres");
        }

        if (!erros.isEmpty()) {
            log.warn("validacao de pagador recusada: {}", erros.keySet());
            throw new DadosInvalidosException(erros);
        }
    }

    /**
     * Validacao de CPF por digitos verificadores (mod 11).
     */
    static boolean cpfValido(String cpf) {
        if (cpf == null || cpf.length() != 11 || cpf.chars().allMatch(c -> c == cpf.charAt(0))) {
            return false;
        }
        int[] d = new int[11];
        for (int i = 0; i < 11; i++) {
            d[i] = cpf.charAt(i) - '0';
        }
        int soma1 = 0;
        for (int i = 0; i < 9; i++) {
            soma1 += d[i] * (10 - i);
        }
        int dig1 = soma1 % 11 < 2 ? 0 : 11 - soma1 % 11;
        if (dig1 != d[9]) {
            return false;
        }
        int soma2 = 0;
        for (int i = 0; i < 10; i++) {
            soma2 += d[i] * (11 - i);
        }
        int dig2 = soma2 % 11 < 2 ? 0 : 11 - soma2 % 11;
        return dig2 == d[10];
    }
}
