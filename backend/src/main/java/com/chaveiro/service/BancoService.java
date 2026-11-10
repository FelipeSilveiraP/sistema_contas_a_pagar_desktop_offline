package com.chaveiro.service;

import com.chaveiro.model.Banco;
import com.chaveiro.repository.BancoRepository;
import java.sql.SQLException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Validacoes e regras de negocio do cadastro de bancos.
 * Regras sao pragmaticas: validam o que e obrigatorio sem rejeitar
 * dados bancarios legitimos (chaves Pix variadas).
 */
@Service
public class BancoService {

    private static final Logger log = LoggerFactory.getLogger(BancoService.class);

    private final BancoRepository repository;

    public BancoService(BancoRepository repository) {
        this.repository = repository;
    }

    public List<Banco> listar() {
        try {
            return repository.listar();
        } catch (SQLException erro) {
            log.error("falha ao listar bancos", erro);
            throw new IllegalStateException("falha ao consultar os bancos", erro);
        }
    }

    public Banco buscarPorId(long id) {
        try {
            return repository.buscarPorId(id)
                    .orElseThrow(() -> new RecursoNaoEncontradoException("banco"));
        } catch (SQLException erro) {
            log.error("falha ao buscar banco id={}", id, erro);
            throw new IllegalStateException("falha ao consultar o banco", erro);
        }
    }

    public Banco cadastrar(Banco dados) {
        Banco normalizado = normalizar(dados, null);
        validar(normalizado);
        try {
            return repository.inserir(normalizado);
        } catch (SQLException erro) {
            log.error("falha ao cadastrar banco", erro);
            throw new IllegalStateException("falha ao salvar o banco", erro);
        }
    }

    public Banco atualizar(long id, Banco dados) {
        Banco normalizado = normalizar(dados, id);
        validar(normalizado);
        try {
            if (!repository.atualizar(id, normalizado)) {
                throw new RecursoNaoEncontradoException("banco");
            }
            return normalizado;
        } catch (SQLException erro) {
            log.error("falha ao atualizar banco id={}", id, erro);
            throw new IllegalStateException("falha ao atualizar o banco", erro);
        }
    }

    public void excluir(long id) {
        try {
            if (!repository.excluir(id)) {
                throw new RecursoNaoEncontradoException("banco");
            }
        } catch (SQLException erro) {
            log.error("falha ao excluir banco id={}", id, erro);
            throw new IllegalStateException("falha ao excluir o banco", erro);
        }
    }

    private static Banco normalizar(Banco dados, Long id) {
        return new Banco(
                id,
                dados.instituicao() == null ? "" : dados.instituicao().trim(),
                dados.chavePix() == null || dados.chavePix().isBlank() ? null : dados.chavePix().trim()
        );
    }

    private static void validar(Banco banco) {
        Map<String, String> erros = new LinkedHashMap<>();

        if (banco.instituicao().length() < 2 || banco.instituicao().length() > 120) {
            erros.put("instituicao", "Informe o nome do banco (de 2 a 120 caracteres).");
        }
        if (banco.chavePix() != null) {
            if (banco.chavePix().length() > 77 || banco.chavePix().contains(" ")) {
                erros.put("chavePix", "Chave Pix inválida (até 77 caracteres, sem espaços).");
            }
        }

        if (!erros.isEmpty()) {
            log.warn("validacao de banco recusada: {}", erros.keySet());
            throw new DadosInvalidosException(erros);
        }
    }
}
