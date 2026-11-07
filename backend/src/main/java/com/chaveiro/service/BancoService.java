package com.chaveiro.service;

import com.chaveiro.model.Banco;
import com.chaveiro.repository.BancoRepository;
import java.sql.SQLException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Validacoes e regras de negocio do cadastro de bancos.
 * Regras sao pragmaticas: validam o que e obrigatorio sem rejeitar
 * dados bancarios legitimos (agencias/contas com digitos, chaves Pix variadas).
 */
@Service
public class BancoService {

    private static final Logger log = LoggerFactory.getLogger(BancoService.class);

    private static final Pattern AGENCIA_CONTA = Pattern.compile("[0-9A-Za-z./-]{1,20}");
    private static final Pattern SOMENTE_DIGITOS = Pattern.compile("\\d{1,5}");

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
                dados.codigoBanco() == null ? "" : dados.codigoBanco().trim(),
                dados.agencia() == null ? "" : dados.agencia().trim(),
                dados.conta() == null ? "" : dados.conta().trim(),
                dados.chavePix() == null || dados.chavePix().isBlank() ? null : dados.chavePix().trim()
        );
    }

    private static void validar(Banco banco) {
        Map<String, String> erros = new LinkedHashMap<>();

        if (banco.instituicao().length() < 2 || banco.instituicao().length() > 120) {
            erros.put("instituicao", "informe a instituicao bancaria (2 a 120 caracteres)");
        }
        if (!SOMENTE_DIGITOS.matcher(banco.codigoBanco()).matches()) {
            erros.put("codigoBanco", "codigo bancario deve conter apenas digitos (ate 5)");
        }
        if (banco.agencia().isEmpty() || !AGENCIA_CONTA.matcher(banco.agencia()).matches()) {
            erros.put("agencia", "informe a agencia (ate 20 caracteres)");
        }
        if (banco.conta().isEmpty() || !AGENCIA_CONTA.matcher(banco.conta()).matches()) {
            erros.put("conta", "informe a conta (ate 20 caracteres)");
        }
        if (banco.chavePix() != null) {
            if (banco.chavePix().length() > 77 || banco.chavePix().contains(" ")) {
                erros.put("chavePix", "chave Pix invalida (ate 77 caracteres, sem espacos)");
            }
        }

        if (!erros.isEmpty()) {
            log.warn("validacao de banco recusada: {}", erros.keySet());
            throw new DadosInvalidosException(erros);
        }
    }
}
