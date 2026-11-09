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
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Regras das contas a pagar, conforme o formulario Stitch "Inserir Conta"
 * e as regras do sistema legado (VBA). Filtro de duplicidade
 * "ultra-sensivel" restrito ao MES do vencimento (escopo da aba mensal
 * legado, aprovado pelo usuario).
 */
@Service
public class ContaService {

    private static final Logger log = LoggerFactory.getLogger(ContaService.class);

    static final int JANELA_DIAS_DUPLICATA = 5;
    static final BigDecimal TOLERANCIA_VALOR_DUPLICATA = new BigDecimal("150.00");
    static final long LIMITE_ANEXO_BYTES = 15L * 1024 * 1024;

    static final Set<String> FORMAS_PAGAMENTO =
            Set.of("boleto", "pix", "cartao", "transferencia", "dinheiro");
    static final Set<String> TIPOS_PESSOA = Set.of("PF", "PJ");

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

    public List<Conta> listarFixas() {
        try {
            return repository.listar(null, true);
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

    public byte[] buscarAnexoPdf(long id) {
        try {
            return repository.buscarAnexoPdf(id)
                    .orElseThrow(() -> new RecursoNaoEncontradoException("anexo"));
        } catch (SQLException erro) {
            log.error("falha ao buscar anexo da conta id={}", id, erro);
            throw new IllegalStateException("falha ao consultar o anexo", erro);
        }
    }

    public Conta cadastrar(Conta dados, byte[] anexoPdf, boolean forcar) {
        Conta normalizado = normalizar(dados, null);
        validar(normalizado, anexoPdf);
        try {
            if (!forcar) {
                Conta duplicata = buscarPossivelDuplicata(normalizado);
                if (duplicata != null) {
                    log.info("possivel duplicidade detectada: conta existente id={}", duplicata.id());
                    throw new PossivelDuplicataException(duplicata);
                }
            }
            Conta criada = repository.inserir(normalizado, anexoPdf);
            return repository.buscarPorId(criada.id()).orElse(criada);
        } catch (SQLException erro) {
            log.error("falha ao cadastrar conta", erro);
            throw new IllegalStateException("falha ao salvar a conta", erro);
        }
    }

    public Conta atualizar(long id, Conta dados, byte[] anexoPdf) {
        Conta normalizado = normalizar(dados, id);
        validar(normalizado, anexoPdf);
        try {
            if (!repository.atualizar(id, normalizado, anexoPdf)) {
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
            for (Conta existente : repository.listar(null)) {
                // Fiel ao VBA: comparacao apenas dentro do MES do vencimento.
                if (!YearMonth.from(existente.vencimento()).equals(YearMonth.from(nova.vencimento()))) {
                    continue;
                }
                if (possivelDuplicata(existente, nova)) {
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
     * Regra VBA cmdInserir_Click ("filtro ultra-sensivel"), aplicada a contas
     * do mesmo mes: documento identico (nao vazio), OU nome de empresa parecido
     * E (vencimento em ate 5 dias OU valor com diferenca de ate R$ 150,00).
     */
    static boolean possivelDuplicata(Conta existente, Conta nova) {
        String docExistente = existente.numeroDocumento() == null ? "" : existente.numeroDocumento().trim();
        String docNovo = nova.numeroDocumento() == null ? "" : nova.numeroDocumento().trim();
        if (!docExistente.isEmpty() && docExistente.equalsIgnoreCase(docNovo)) {
            return true;
        }
        boolean nomesParecidos = nomesParecidos(existente.nomeEmpresa(), nova.nomeEmpresa());
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
        if (na.isEmpty() || nb.isEmpty()) {
            return false;
        }
        return na.contains(nb) || nb.contains(na);
    }

    private static Conta normalizar(Conta dados, Long id) {
        return new Conta(
                id,
                dados.nomeEmpresa() == null ? "" : dados.nomeEmpresa().trim(),
                dados.idEmpresa(),
                dados.razaoSocial(),
                dados.pagadorResponsavel() == null ? "" : dados.pagadorResponsavel().trim(),
                dados.tipoPessoa() == null ? "PJ" : dados.tipoPessoa().trim().toUpperCase(),
                dados.formaPagamento() == null ? "" : dados.formaPagamento().trim().toLowerCase(),
                dados.categoria() == null || dados.categoria().isBlank() ? null : dados.categoria().trim(),
                dados.numeroDocumento() == null || dados.numeroDocumento().isBlank()
                        ? null : dados.numeroDocumento().trim(),
                dados.valor(),
                dados.vencimento(),
                dados.boletoNaPasta(),
                dados.anexoNome() == null || dados.anexoNome().isBlank() ? null : dados.anexoNome().trim(),
                dados.status() == null ? "PENDENTE" : dados.status()
        );
    }

    private static void validar(Conta conta, byte[] anexoPdf) {
        Map<String, String> erros = new LinkedHashMap<>();

        if (conta.nomeEmpresa().length() < 2 || conta.nomeEmpresa().length() > 120) {
            erros.put("nomeEmpresa", "informe o nome da empresa (2 a 120 caracteres)");
        }
        if (conta.pagadorResponsavel().isEmpty() || conta.pagadorResponsavel().length() > 120) {
            erros.put("pagadorResponsavel", "informe o pagador responsavel (1 a 120 caracteres)");
        }
        if (!TIPOS_PESSOA.contains(conta.tipoPessoa())) {
            erros.put("tipoPessoa", "informe o tipo de conta (PF ou PJ)");
        }
        if (!FORMAS_PAGAMENTO.contains(conta.formaPagamento())) {
            erros.put("formaPagamento", "selecione o documento de cobranca");
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
        if (conta.anexoNome() != null && conta.anexoNome().length() > 200) {
            erros.put("anexoNome", "o nome do anexo deve ter ate 200 caracteres");
        }
        if (anexoPdf != null) {
            if (anexoPdf.length > LIMITE_ANEXO_BYTES) {
                erros.put("anexo", "o anexo deve ter no maximo 15MB");
            } else if (anexoPdf.length < 5
                    || anexoPdf[0] != '%' || anexoPdf[1] != 'P' || anexoPdf[2] != 'D' || anexoPdf[3] != 'F') {
                erros.put("anexo", "o anexo deve ser um arquivo PDF");
            }
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
