package com.chaveiro.service;

import com.chaveiro.model.Pagamento;
import com.chaveiro.repository.ContaRepository;
import com.chaveiro.repository.PagamentoRepository;
import java.math.BigDecimal;
import java.sql.SQLException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Regras de pagamento: um pagamento integral unico por conta (sem parciais),
 * com valor livre (juros/desconto) e banco opcional. Baixa e estorno sao
 * atomicos no repositorio (pagamento + status na mesma transacao).
 */
@Service
public class PagamentoService {

    private static final Logger log = LoggerFactory.getLogger(PagamentoService.class);

    private final PagamentoRepository repository;
    private final ContaRepository contas;

    public PagamentoService(PagamentoRepository repository, ContaRepository contas) {
        this.repository = repository;
        this.contas = contas;
    }

    public List<Pagamento> listar() {
        try {
            return repository.listar();
        } catch (SQLException erro) {
            log.error("falha ao listar pagamentos", erro);
            throw new IllegalStateException("falha ao consultar os pagamentos", erro);
        }
    }

    public Pagamento buscarPorConta(long idConta) {
        try {
            return repository.buscarPorConta(idConta)
                    .orElseThrow(() -> new RecursoNaoEncontradoException("pagamento"));
        } catch (SQLException erro) {
            log.error("falha ao buscar pagamento da conta {}", idConta, erro);
            throw new IllegalStateException("falha ao consultar o pagamento", erro);
        }
    }

    public Pagamento registrar(long idConta, Pagamento dados) {
        validar(dados);
        try {
            if (contas.buscarPorId(idConta).isEmpty()) {
                throw new RecursoNaoEncontradoException("conta");
            }
            if (repository.buscarPorConta(idConta).isPresent()) {
                throw new ConflitoIntegridadeException("a conta ja possui pagamento registrado");
            }
            return repository.registrar(idConta, normalizar(dados, idConta));
        } catch (SQLException erro) {
            log.error("falha ao registrar pagamento da conta {}", idConta, erro);
            throw new IllegalStateException("falha ao registrar o pagamento", erro);
        }
    }

    public void estornar(long idConta) {
        try {
            if (!repository.estornar(idConta)) {
                throw new RecursoNaoEncontradoException("pagamento");
            }
        } catch (SQLException erro) {
            log.error("falha ao estornar pagamento da conta {}", idConta, erro);
            throw new IllegalStateException("falha ao estornar o pagamento", erro);
        }
    }

    public Pagamento atualizar(long id, Pagamento dados) {
        validar(dados);
        try {
            if (!repository.atualizar(id, normalizar(dados, null))) {
                throw new RecursoNaoEncontradoException("pagamento");
            }
            return repository.buscarPorId(id).orElseThrow(() -> new RecursoNaoEncontradoException("pagamento"));
        } catch (SQLException erro) {
            log.error("falha ao atualizar pagamento id={}", id, erro);
            throw new IllegalStateException("falha ao atualizar o pagamento", erro);
        }
    }

    private static Pagamento normalizar(Pagamento dados, Long idConta) {
        return new Pagamento(dados.id(), idConta != null ? idConta : dados.idConta(),
                dados.dataPagamento(), dados.valorPago(), dados.idBanco(),
                dados.instituicaoBanco(), dados.nomeEmpresa(), dados.statusConta());
    }

    private static void validar(Pagamento dados) {
        Map<String, String> erros = new LinkedHashMap<>();
        if (dados.dataPagamento() == null) {
            erros.put("dataPagamento", "Informe a data do pagamento.");
        }
        if (dados.valorPago() == null) {
            erros.put("valorPago", "Informe o valor pago.");
        } else {
            if (dados.valorPago().signum() <= 0) {
                erros.put("valorPago", "O valor pago deve ser maior que zero.");
            } else if (dados.valorPago().stripTrailingZeros().scale() > 2) {
                erros.put("valorPago", "O valor deve ter no máximo 2 casas decimais.");
            }
        }
        if (!erros.isEmpty()) {
            log.warn("validacao de pagamento recusada: {}", erros.keySet());
            throw new DadosInvalidosException(erros);
        }
    }
}
