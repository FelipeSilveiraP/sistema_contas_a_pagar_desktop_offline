package com.chaveiro.service;

import com.chaveiro.model.Aviso;
import com.chaveiro.repository.AvisoRepository;
import java.sql.SQLException;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Regras dos avisos internos: vigencia por periodo e dia da semana
 * (comportamento legado); sem expiracao automatica — o aviso apenas deixa
 * de ser exibido fora da vigencia.
 */
@Service
public class AvisoService {

    private static final Logger log = LoggerFactory.getLogger(AvisoService.class);

    private static final Set<String> DIAS = Set.of(
            "TODOS", "DOMINGO", "SEGUNDA", "TERCA", "QUARTA", "QUINTA", "SEXTA", "SABADO");

    private final AvisoRepository repository;

    public AvisoService(AvisoRepository repository) {
        this.repository = repository;
    }

    public List<Aviso> listar() {
        try {
            return repository.listar();
        } catch (SQLException erro) {
            log.error("falha ao listar avisos", erro);
            throw new IllegalStateException("falha ao consultar os avisos", erro);
        }
    }

    public Aviso buscarPorId(long id) {
        try {
            return repository.buscarPorId(id)
                    .orElseThrow(() -> new RecursoNaoEncontradoException("aviso"));
        } catch (SQLException erro) {
            log.error("falha ao buscar aviso id={}", id, erro);
            throw new IllegalStateException("falha ao consultar o aviso", erro);
        }
    }

    public Aviso cadastrar(Aviso dados) {
        Aviso normalizado = normalizar(dados);
        validar(normalizado);
        try {
            return repository.inserir(normalizado);
        } catch (SQLException erro) {
            log.error("falha ao cadastrar aviso", erro);
            throw new IllegalStateException("falha ao salvar o aviso", erro);
        }
    }

    public Aviso atualizar(long id, Aviso dados) {
        Aviso normalizado = normalizar(dados);
        validar(normalizado);
        try {
            if (!repository.atualizar(id, normalizado)) {
                throw new RecursoNaoEncontradoException("aviso");
            }
            return normalizado;
        } catch (SQLException erro) {
            log.error("falha ao atualizar aviso id={}", id, erro);
            throw new IllegalStateException("falha ao atualizar o aviso", erro);
        }
    }

    public void excluir(long id) {
        try {
            if (!repository.excluir(id)) {
                throw new RecursoNaoEncontradoException("aviso");
            }
        } catch (SQLException erro) {
            log.error("falha ao excluir aviso id={}", id, erro);
            throw new IllegalStateException("falha ao excluir o aviso", erro);
        }
    }

    /** Vigencia legada: data entre inicio e fim E dia da semana confere (ou TODOS). */
    public static boolean ativoEm(Aviso aviso, LocalDate data) {
        if (data.isBefore(aviso.dataInicio()) || data.isAfter(aviso.dataFim())) {
            return false;
        }
        if ("TODOS".equals(aviso.diaSemana())) {
            return true;
        }
        return switch (data.getDayOfWeek()) {
            case SUNDAY -> "DOMINGO".equals(aviso.diaSemana());
            case MONDAY -> "SEGUNDA".equals(aviso.diaSemana());
            case TUESDAY -> "TERCA".equals(aviso.diaSemana());
            case WEDNESDAY -> "QUARTA".equals(aviso.diaSemana());
            case THURSDAY -> "QUINTA".equals(aviso.diaSemana());
            case FRIDAY -> "SEXTA".equals(aviso.diaSemana());
            case SATURDAY -> "SABADO".equals(aviso.diaSemana());
        };
    }

    private static Aviso normalizar(Aviso dados) {
        return new Aviso(dados.id(), dados.dataInicio(), dados.dataFim(),
                dados.diaSemana() == null ? "TODOS" : dados.diaSemana().trim().toUpperCase(),
                dados.titulo() == null ? "" : dados.titulo().trim(),
                dados.mensagem() == null ? "" : dados.mensagem().trim());
    }

    private static void validar(Aviso dados) {
        Map<String, String> erros = new LinkedHashMap<>();
        if (dados.dataInicio() == null) {
            erros.put("dataInicio", "informe a data de inicio da vigencia");
        }
        if (dados.dataFim() == null) {
            erros.put("dataFim", "informe a data de fim da vigencia");
        }
        if (dados.dataInicio() != null && dados.dataFim() != null && dados.dataFim().isBefore(dados.dataInicio())) {
            erros.put("dataFim", "o fim da vigencia deve ser igual ou posterior ao inicio");
        }
        if (!DIAS.contains(dados.diaSemana())) {
            erros.put("diaSemana", "dia da semana invalido");
        }
        if (dados.titulo().length() < 2 || dados.titulo().length() > 100) {
            erros.put("titulo", "informe o titulo (2 a 100 caracteres)");
        }
        if (dados.mensagem().length() < 2 || dados.mensagem().length() > 500) {
            erros.put("mensagem", "informe a mensagem (2 a 500 caracteres)");
        }
        if (!erros.isEmpty()) {
            log.warn("validacao de aviso recusada: {}", erros.keySet());
            throw new DadosInvalidosException(erros);
        }
    }
}
