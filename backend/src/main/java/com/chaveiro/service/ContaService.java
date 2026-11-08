package com.chaveiro.service;

import com.chaveiro.model.Conta;
import com.chaveiro.repository.ContaRepository;
import java.math.BigDecimal;
import java.sql.SQLException;
import java.time.YearMonth;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Regras das contas a pagar. Filtro de duplicidade "ultra-sensivel" herdado
 * do sistema legado (VBA cmdInserir_Click): considera duplicado se o
 * documento for identico (nao vazio), ou se o fornecedor tem nome parecido
 * E (vencimento em ate 5 dias OU valor com diferenca de ate R$ 150,00).
 */
@Service
public class ContaService {

    private static final Logger log = LoggerFactory.getLogger(ContaService.class);

    /** Diferenca maxima de dias entre vencimentos para considerar duplicata (regra VBA). */
    static final int JANELA_DIAS_DUPLICATA = 5;

    /** Diferenca maxima de valor (R$) para considerar duplicata (regra VBA). */
    static final BigDecimal TOLERANCIA_VALOR_DUPLICATA = new BigDecimal("150.00");

    private final ContaRepository repository;

    public ContaService(ContaRepository repository) {
        this.repository = repository;
    }

    public List<Conta> listar(String status) {
        try {
            return repository.listar(status);
        } catch (SQLException erro) {
            log.error("falha ao listar contas", erro);
            throw new IllegalStateException("falha ao consultar as contas", erro);
        }
    }

    public Conta buscarPorId(long id) {
        try {
            return repository.buscarPorId(id)
                    .orElseThrow(() -> new RecursoNaoEncontradoException("conta"));
        } catch (SQLException erro) {
            log.error("falha ao buscar conta id={}", id, erro);
            throw new IllegalStateException("falha ao consultar a conta", erro);
        }
    }

    public Conta cadastrar(Conta dados, boolean forcar) {
        Conta normalizado = normalizar(dados, null);
        validar(normalizado);
        try {
            if (!forcar) {
                Conta duplicata = buscarPossivelDuplicata(normalizado);
                if (duplicata != null) {
                    log.info("possivel duplicidade detectada: conta existente id={}", duplicata.id());
                    throw new PossivelDuplicataException(duplicata);
                }
            }
            Conta criada = repository.inserir(normalizado);
            return repository.buscarPorId(criada.id()).orElse(criada);
        } catch (SQLException erro) {
            log.error("falha ao cadastrar conta", erro);
            throw new IllegalStateException("falha ao salvar a conta", erro);
        }
    }

    public Conta atualizar(long id, Conta dados) {
        Conta normalizado = normalizar(dados, id);
        validar(normalizado);
        try {
            if (!repository.atualizar(id, normalizado)) {
                throw new RecursoNaoEncontradoException("conta");
            }
            return repository.buscarPorId(id).orElse(normalizado);
        } catch (SQLException erro) {
            log.error("falha ao atualizar conta id={}", id, erro);
            throw new IllegalStateException("falha ao atualizar a conta", erro);
        }
    }

    public void excluir(long id) {
        try {
            if (!repository.excluir(id)) {
                throw new RecursoNaoEncontradoException("conta");
            }
        } catch (SQLException erro) {
            log.error("falha ao excluir conta id={}", id, erro);
            throw new IllegalStateException("falha ao excluir a conta", erro);
        }
    }

    Conta buscarPossivelDuplicata(Conta nova) {
        try {
            Conta candidata = comRazaoSocialResolvida(nova);
            for (Conta existente : repository.listar(null)) {
                // Fiel ao VBA: a comparacao ocorre apenas dentro do MES do vencimento
                // (cada mes era uma aba da planilha legada). Evita falsos positivos em
                // recorrencias mensais (ex.: aluguel) — aprovado pelo usuario.
                if (!YearMonth.from(existente.vencimento()).equals(YearMonth.from(candidata.vencimento()))) {
                    continue;
                }
                if (possivelDuplicata(existente, candidata)) {
                    return existente;
                }
            }
            return null;
        } catch (SQLException erro) {
            log.error("falha ao verificar duplicidade", erro);
            throw new IllegalStateException("falha ao verificar duplicidade", erro);
        }
    }

    /**
     * A API nao envia o nome do fornecedor (vem da FK): resolve pela empresa
     * cadastrada para que a regra de nomes parecidos funcione em producao.
     */
    private Conta comRazaoSocialResolvida(Conta dados) throws SQLException {
        if (dados.razaoSocial() != null || dados.idEmpresa() == null) {
            return dados;
        }
        String razao = repository.buscarNomeEmpresa(dados.idEmpresa()).orElse(null);
        return new Conta(dados.id(), dados.idEmpresa(), razao, dados.idPagador(), dados.nomePagador(),
                dados.categoria(), dados.numeroDocumento(), dados.valor(), dados.vencimento(),
                dados.boletoNaPasta(), dados.status());
    }

    /**
     * Regra VBA cmdInserir_Click ("filtro ultra-sensivel"), aplicada apenas a
     * contas do MESMO MES de vencimento (escopo da aba mensal do legado):
     * documento identico (nao vazio), OU fornecedor com nome parecido
     * E (vencimento em ate 5 dias OU valor com diferenca de ate R$ 150,00).
     */
    static boolean possivelDuplicata(Conta existente, Conta nova) {
        String docExistente = existente.numeroDocumento() == null ? "" : existente.numeroDocumento().trim();
        String docNovo = nova.numeroDocumento() == null ? "" : nova.numeroDocumento().trim();
        if (!docExistente.isEmpty() && docExistente.equalsIgnoreCase(docNovo)) {
            return true;
        }
        boolean nomesParecidos = nomesParecidos(existente.razaoSocial(), nova.razaoSocial());
        if (!nomesParecidos) {
            return false;
        }
        long dias = Math.abs(ChronoUnit.DAYS.between(existente.vencimento(), nova.vencimento()));
        if (dias <= JANELA_DIAS_DUPLICATA) {
            return true;
        }
        BigDecimal diferenca = existente.valor().subtract(nova.valor()).abs();
        return diferenca.compareTo(TOLERANCIA_VALOR_DUPLICATA) <= 0;
    }

    private static boolean nomesParecidos(String a, String b) {
        if (a == null || b == null) {
            return false;
        }
        String na = a.trim().toLowerCase();
        String nb = b.trim().toLowerCase();
        // nomes vazios nunca sao "parecidos" (contains("") seria sempre verdadeiro)
        if (na.isEmpty() || nb.isEmpty()) {
            return false;
        }
        return na.contains(nb) || nb.contains(na);
    }

    private static Conta normalizar(Conta dados, Long id) {
        return new Conta(
                id,
                dados.idEmpresa(),
                dados.razaoSocial(),
                dados.idPagador(),
                dados.nomePagador(),
                dados.categoria() == null || dados.categoria().isBlank() ? null : dados.categoria().trim(),
                dados.numeroDocumento() == null || dados.numeroDocumento().isBlank()
                        ? null : dados.numeroDocumento().trim(),
                dados.valor(),
                dados.vencimento(),
                dados.boletoNaPasta(),
                dados.status() == null ? "PENDENTE" : dados.status()
        );
    }

    private static void validar(Conta conta) {
        Map<String, String> erros = new LinkedHashMap<>();

        if (conta.idEmpresa() == null || conta.idEmpresa() <= 0) {
            erros.put("idEmpresa", "informe o fornecedor (empresa cadastrada)");
        }
        if (conta.valor() == null) {
            erros.put("valor", "informe o valor da conta");
        } else {
            if (conta.valor().signum() <= 0) {
                erros.put("valor", "o valor deve ser maior que zero");
            } else if (conta.valor().stripTrailingZeros().scale() > 2) {
                erros.put("valor", "o valor deve ter no maximo 2 casas decimais");
            }
        }
        if (conta.vencimento() == null) {
            erros.put("vencimento", "informe a data de vencimento");
        }
        if (conta.categoria() != null && conta.categoria().length() > 60) {
            erros.put("categoria", "a categoria deve ter ate 60 caracteres");
        }
        if (conta.numeroDocumento() != null && conta.numeroDocumento().length() > 60) {
            erros.put("numeroDocumento", "o documento deve ter ate 60 caracteres");
        }
        if (!"PENDENTE".equals(conta.status()) && !"PAGO".equals(conta.status())) {
            erros.put("status", "status invalido");
        }

        if (!erros.isEmpty()) {
            log.warn("validacao de conta recusada: {}", erros.keySet());
            throw new DadosInvalidosException(erros);
        }
    }
}
