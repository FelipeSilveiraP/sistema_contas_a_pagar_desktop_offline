package com.chaveiro.service;

import com.chaveiro.model.BoletoRecorrente;
import com.chaveiro.model.Conta;
import com.chaveiro.repository.BoletoRecorrenteRepository;
import com.chaveiro.repository.ContaRepository;
import java.math.BigDecimal;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Regras das contas recorrentes (form roxo do Stitch + regras VBA):
 * - o dia configurado e preservado; em meses sem o dia, usa o ultimo dia do mes;
 * - geracao de 12 competencias com anti-duplicacao (mesmo nome de empresa e
 *   mesmo vencimento nao sao gerados de novo);
 * - periodicidade MENSAL/BIMESTRAL/TRIMESTRAL/ANUAL;
 * - exclusao remove apenas contas geradas ainda nao pagas.
 */
@Service
public class BoletoRecorrenteService {

    private static final Logger log = LoggerFactory.getLogger(BoletoRecorrenteService.class);

    private static final int COMPETENCIAS_A_GERAR = 12;
    private static final Set<String> PERIODICIDADES = Set.of("MENSAL", "BIMESTRAL", "TRIMESTRAL", "ANUAL");
    private static final Map<String, Integer> PASSO_MES = Map.of(
            "MENSAL", 1, "BIMESTRAL", 2, "TRIMESTRAL", 3, "ANUAL", 12);

    private final BoletoRecorrenteRepository repository;
    private final ContaRepository contas;

    public BoletoRecorrenteService(BoletoRecorrenteRepository repository, ContaRepository contas) {
        this.repository = repository;
        this.contas = contas;
    }

    public List<BoletoRecorrente> listar() {
        try {
            return repository.listar();
        } catch (SQLException erro) {
            log.error("falha ao listar recorrentes", erro);
            throw new IllegalStateException("falha ao consultar as recorrencias", erro);
        }
    }

    public BoletoRecorrente buscarPorId(long id) {
        try {
            return repository.buscarPorId(id)
                    .orElseThrow(() -> new RecursoNaoEncontradoException("recorrencia"));
        } catch (SQLException erro) {
            log.error("falha ao buscar recorrencia id={}", id, erro);
            throw new IllegalStateException("falha ao consultar a recorrencia", erro);
        }
    }

    public BoletoRecorrente cadastrar(BoletoRecorrente dados) {
        BoletoRecorrente normalizado = normalizar(dados);
        validar(normalizado);
        try {
            BoletoRecorrente criado = repository.inserir(normalizado);
            gerarContas(criado);
            return criado;
        } catch (SQLException erro) {
            log.error("falha ao cadastrar recorrencia", erro);
            throw new IllegalStateException("falha ao salvar a recorrencia", erro);
        }
    }

    public BoletoRecorrente atualizar(long id, BoletoRecorrente dados) {
        BoletoRecorrente normalizado = normalizar(dados);
        validar(normalizado);
        try {
            if (!repository.atualizar(id, normalizado)) {
                throw new RecursoNaoEncontradoException("recorrencia");
            }
            return repository.buscarPorId(id).orElse(normalizado);
        } catch (SQLException erro) {
            log.error("falha ao atualizar recorrencia id={}", id, erro);
            throw new IllegalStateException("falha ao atualizar a recorrencia", erro);
        }
    }

    public int gerarContas(BoletoRecorrente recorrente) {
        try {
            List<LocalDate> gerados = new ArrayList<>();
            int passo = PASSO_MES.get(recorrente.periodicidade());
            YearMonth mes = YearMonth.now();
            YearMonth limite = mes.plusMonths(COMPETENCIAS_A_GERAR);
            while (!mes.isAfter(limite.minusMonths(1))) {
                LocalDate vencimento = vencimentoDoMes(mes, recorrente.dia());
                if (!existeConta(recorrente, vencimento)) {
                    contas.inserirDeRecorrencia(new Conta(null, recorrente.nomeEmpresa(),
                            recorrente.idEmpresa(), null, recorrente.pagadorResponsavel(), "PJ",
                            recorrente.formaPagamento() == null ? "boleto" : recorrente.formaPagamento(),
                            recorrente.categoria(), recorrente.numeroDocumento(), recorrente.valor(),
                            vencimento, false, null, "PENDENTE"), recorrente.id());
                    gerados.add(vencimento);
                }
                mes = mes.plusMonths(passo);
            }
            log.info("recorrencia {}: {} contas geradas", recorrente.id(), gerados.size());
            return gerados.size();
        } catch (SQLException erro) {
            log.error("falha ao gerar contas da recorrencia {}", recorrente.id(), erro);
            throw new IllegalStateException("falha ao gerar as contas recorrentes", erro);
        }
    }

    public void excluir(long id) {
        try {
            if (!repository.excluir(id)) {
                throw new RecursoNaoEncontradoException("recorrencia");
            }
        } catch (SQLException erro) {
            log.error("falha ao excluir recorrencia id={}", id, erro);
            throw new IllegalStateException("falha ao excluir a recorrencia", erro);
        }
    }

    /** Ultimo dia do mes quando o dia configurado nao existe (regra aprovada). */
    static LocalDate vencimentoDoMes(YearMonth mes, int dia) {
        int ultimoDia = mes.lengthOfMonth();
        return mes.atDay(Math.min(dia, ultimoDia));
    }

    private boolean existeConta(BoletoRecorrente recorrente, LocalDate vencimento) throws SQLException {
        for (Conta conta : contas.listar(null)) {
            if (conta.vencimento().equals(vencimento)
                    && conta.nomeEmpresa().equalsIgnoreCase(recorrente.nomeEmpresa())) {
                return true;
            }
        }
        return false;
    }

    private static BoletoRecorrente normalizar(BoletoRecorrente dados) {
        return new BoletoRecorrente(dados.id(),
                dados.nomeEmpresa() == null ? "" : dados.nomeEmpresa().trim(),
                dados.idEmpresa(),
                dados.pagadorResponsavel() == null ? "" : dados.pagadorResponsavel().trim(),
                dados.categoria() == null || dados.categoria().isBlank() ? null : dados.categoria().trim(),
                dados.numeroDocumento() == null || dados.numeroDocumento().isBlank() ? null : dados.numeroDocumento().trim(),
                dados.valor(),
                dados.dia(),
                dados.periodicidade() == null ? "" : dados.periodicidade().trim().toUpperCase(),
                dados.formaPagamento() == null || dados.formaPagamento().isBlank() ? null : dados.formaPagamento().trim().toLowerCase(),
                dados.ativo());
    }

    private static void validar(BoletoRecorrente dados) {
        Map<String, String> erros = new LinkedHashMap<>();
        if (dados.nomeEmpresa().length() < 2 || dados.nomeEmpresa().length() > 120) {
            erros.put("nomeEmpresa", "informe o nome da empresa (2 a 120 caracteres)");
        }
        if (dados.pagadorResponsavel().isEmpty() || dados.pagadorResponsavel().length() > 120) {
            erros.put("pagadorResponsavel", "informe o pagador responsavel (1 a 120 caracteres)");
        }
        if (dados.valor() == null || dados.valor().signum() <= 0
                || dados.valor().stripTrailingZeros().scale() > 2) {
            erros.put("valor", "informe um valor valido (maior que zero, ate 2 casas)");
        }
        if (dados.dia() < 1 || dados.dia() > 31) {
            erros.put("dia", "informe o dia de vencimento (1 a 31)");
        }
        if (!PERIODICIDADES.contains(dados.periodicidade())) {
            erros.put("periodicidade", "selecione a periodicidade");
        }
        if (!erros.isEmpty()) {
            log.warn("validacao de recorrencia recusada: {}", erros.keySet());
            throw new DadosInvalidosException(erros);
        }
    }
}
