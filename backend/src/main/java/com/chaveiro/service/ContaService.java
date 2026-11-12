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

    static final Set<String> FORMAS_PAGAMENTO =
            Set.of("boleto", "pix", "cartao", "transferencia", "dinheiro", "debito");
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
        Conta normalizado = comAnexo(normalizar(dados, null), anexoPdf);
        if (anexoPdf == null && !normalizado.semNotaFiscal()) {
            // regra do usuario: toda conta nova tem nota anexada OU a marca "sem nota"
            throw new DadosInvalidosException(Map.of("anexo",
                    "Anexe a nota fiscal ou marque \"Conta sem nota fiscal\"."));
        }
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
        Conta normalizado = comAnexo(normalizar(dados, id), anexoPdf);
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
                dados.semNotaFiscal(),
                dados.status() == null ? "PENDENTE" : dados.status()
        );
    }

    /** Com arquivo: nome com a extensao do tipo REAL e "sem nota" desmarcado. */
    private static Conta comAnexo(Conta c, byte[] anexo) {
        if (anexo == null) {
            return c;
        }
        String nome = AnexoNotaFiscal.detectar(anexo)
                .map(tipo -> AnexoNotaFiscal.nomeComExtensao(c.anexoNome(), tipo))
                .orElse(c.anexoNome());
        return new Conta(c.id(), c.nomeEmpresa(), c.idEmpresa(), c.razaoSocial(), c.pagadorResponsavel(),
                c.tipoPessoa(), c.formaPagamento(), c.categoria(), c.numeroDocumento(), c.valor(),
                c.vencimento(), c.boletoNaPasta(), nome, false, c.status());
    }

    /** Tipo MIME do anexo pelo conteudo (para o download). */
    public static String tipoMimeAnexo(byte[] anexo) {
        return AnexoNotaFiscal.detectar(anexo).map(t -> t.mime).orElse("application/octet-stream");
    }

    private static void validar(Conta conta, byte[] anexoPdf) {
        Map<String, String> erros = new LinkedHashMap<>();

        if (conta.nomeEmpresa().length() < 2 || conta.nomeEmpresa().length() > 120) {
            erros.put("nomeEmpresa", "Informe o nome da empresa (de 2 a 120 caracteres).");
        }
        if (conta.pagadorResponsavel().isEmpty() || conta.pagadorResponsavel().length() > 120) {
            erros.put("pagadorResponsavel", "Informe o pagador responsável (de 1 a 120 caracteres).");
        }
        if (!TIPOS_PESSOA.contains(conta.tipoPessoa())) {
            erros.put("tipoPessoa", "Escolha o tipo de conta (pessoa física ou jurídica).");
        }
        if (!FORMAS_PAGAMENTO.contains(conta.formaPagamento())) {
            erros.put("formaPagamento", "Selecione o documento de cobrança.");
        }
        if (conta.valor() == null) {
            erros.put("valor", "Informe o valor da conta.");
        } else {
            if (conta.valor().signum() <= 0) {
                erros.put("valor", "O valor deve ser maior que zero.");
            } else if (conta.valor().stripTrailingZeros().scale() > 2) {
                erros.put("valor", "O valor deve ter no máximo 2 casas decimais.");
            }
        }
        if (conta.vencimento() == null) {
            erros.put("vencimento", "Informe a data de vencimento.");
        }
        if (conta.categoria() != null && conta.categoria().length() > 60) {
            erros.put("categoria", "A categoria deve ter até 60 caracteres.");
        }
        if (conta.numeroDocumento() != null && conta.numeroDocumento().length() > 60) {
            erros.put("numeroDocumento", "O número do documento deve ter até 60 caracteres.");
        }
        if (conta.anexoNome() != null && conta.anexoNome().length() > 200) {
            erros.put("anexoNome", "O nome do arquivo deve ter até 200 caracteres.");
        }
        if (anexoPdf != null) {
            AnexoNotaFiscal.validar(anexoPdf).ifPresent(msg -> erros.put("anexo", msg));
        }
        if (!"PENDENTE".equals(conta.status()) && !"PAGO".equals(conta.status())) {
            erros.put("status", "Situação inválida.");
        }

        if (!erros.isEmpty()) {
            log.warn("validacao de conta recusada: {}", erros.keySet());
            throw new DadosInvalidosException(erros);
        }
    }
}
