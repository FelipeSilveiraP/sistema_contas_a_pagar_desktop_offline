package com.chaveiro.service;

import com.chaveiro.model.Empresa;
import com.chaveiro.model.Empresa.TelefoneEmpresa;
import com.chaveiro.repository.EmpresaRepository;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Validacoes e regras de negocio do cadastro de empresas/fornecedoras.
 * Razao social obrigatoria; CNPJ validado por digitos quando preenchido;
 * telefones em 1FN (numero obrigatorio por linha).
 */
@Service
public class EmpresaService {

    private static final Logger log = LoggerFactory.getLogger(EmpresaService.class);

    private static final Pattern EMAIL = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");

    private final EmpresaRepository repository;

    public EmpresaService(EmpresaRepository repository) {
        this.repository = repository;
    }

    public List<Empresa> listar() {
        try {
            return repository.listar();
        } catch (SQLException erro) {
            log.error("falha ao listar empresas", erro);
            throw new IllegalStateException("falha ao consultar as empresas", erro);
        }
    }

    public Empresa buscarPorId(long id) {
        try {
            return repository.buscarPorId(id)
                    .orElseThrow(() -> new RecursoNaoEncontradoException("empresa"));
        } catch (SQLException erro) {
            log.error("falha ao buscar empresa id={}", id, erro);
            throw new IllegalStateException("falha ao consultar a empresa", erro);
        }
    }

    public Empresa cadastrar(Empresa dados) {
        Empresa normalizado = normalizar(dados, null);
        validar(normalizado);
        try {
            return repository.inserir(normalizado);
        } catch (SQLException erro) {
            throw tratar(erro, "salvar");
        }
    }

    public Empresa atualizar(long id, Empresa dados) {
        Empresa normalizado = normalizar(dados, id);
        validar(normalizado);
        try {
            if (!repository.atualizar(id, normalizado)) {
                throw new RecursoNaoEncontradoException("empresa");
            }
            return repository.buscarPorId(id).orElseThrow();
        } catch (SQLException erro) {
            throw tratar(erro, "atualizar");
        }
    }

    public void excluir(long id) {
        try {
            if (!repository.excluir(id)) {
                throw new RecursoNaoEncontradoException("empresa");
            }
        } catch (SQLException erro) {
            log.error("falha ao excluir empresa id={}", id, erro);
            throw new IllegalStateException("falha ao excluir a empresa", erro);
        }
    }

    private static IllegalStateException tratar(SQLException erro, String acao) {
        if (erro.getMessage() != null && erro.getMessage().toLowerCase().contains("unique")) {
            return new IllegalStateException("CNPJ ja cadastrado para outra empresa", erro);
        }
        log.error("falha ao {} empresa", acao, erro);
        return new IllegalStateException("falha ao " + acao + " a empresa", erro);
    }

    private static Empresa normalizar(Empresa dados, Long id) {
        String cnpj = dados.cnpj() == null ? "" : dados.cnpj().replaceAll("\\D", "");
        List<TelefoneEmpresa> telefones = new ArrayList<>();
        if (dados.telefones() != null) {
            for (TelefoneEmpresa telefone : dados.telefones()) {
                String numero = telefone.numero() == null ? "" : telefone.numero().trim();
                if (numero.isEmpty()) {
                    continue;
                }
                String tipo = telefone.tipo() == null || telefone.tipo().isBlank()
                        ? "Comercial" : telefone.tipo().trim();
                telefones.add(new TelefoneEmpresa(numero, tipo));
            }
        }
        return new Empresa(
                id,
                cnpj.isEmpty() ? null : cnpj,
                dados.razaoSocial() == null ? "" : dados.razaoSocial().trim(),
                vazioNulo(dados.nomeRepresentante()),
                vazioNulo(dados.email()),
                vazioNulo(dados.logradouro()),
                telefones
        );
    }

    private static String vazioNulo(String valor) {
        return valor == null || valor.isBlank() ? null : valor.trim();
    }

    private static void validar(Empresa empresa) {
        Map<String, String> erros = new LinkedHashMap<>();

        if (empresa.razaoSocial().length() < 2 || empresa.razaoSocial().length() > 120) {
            erros.put("razaoSocial", "informe a razao social (2 a 120 caracteres)");
        }
        if (empresa.cnpj() != null && !cnpjValido(empresa.cnpj())) {
            erros.put("cnpj", "CNPJ invalido (14 digitos com digitos verificadores)");
        }
        if (empresa.email() != null && !EMAIL.matcher(empresa.email()).matches()) {
            erros.put("email", "email invalido");
        }
        if (empresa.nomeRepresentante() != null && empresa.nomeRepresentante().length() > 120) {
            erros.put("nomeRepresentante", "nome do representante deve ter ate 120 caracteres");
        }
        if (empresa.logradouro() != null && empresa.logradouro().length() > 120) {
            erros.put("logradouro", "logradouro deve ter ate 120 caracteres");
        }
        for (int i = 0; i < empresa.telefones().size(); i++) {
            TelefoneEmpresa telefone = empresa.telefones().get(i);
            if (!telefone.numero().matches("[0-9A-Za-z().+\\- ]{8,20}")) {
                erros.put("telefones", "telefone invalido (8 a 20 caracteres) na linha " + (i + 1));
                break;
            }
            if (telefone.tipo().length() > 20) {
                erros.put("telefones", "tipo do telefone deve ter ate 20 caracteres");
                break;
            }
        }

        if (!erros.isEmpty()) {
            log.warn("validacao de empresa recusada: {}", erros.keySet());
            throw new DadosInvalidosException(erros);
        }
    }

    /**
     * Validacao de CNPJ por digitos verificadores (mod 11).
     */
    static boolean cnpjValido(String cnpj) {
        if (cnpj == null || cnpj.length() != 14 || cnpj.chars().allMatch(c -> c == cnpj.charAt(0))) {
            return false;
        }
        int[] d = new int[14];
        for (int i = 0; i < 14; i++) {
            d[i] = cnpj.charAt(i) - '0';
        }
        int[] pesos1 = {5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2};
        int[] pesos2 = {6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2};
        if (digitoMod11(d, pesos1) != d[12] || digitoMod11(d, pesos2) != d[13]) {
            return false;
        }
        return true;
    }

    private static int digitoMod11(int[] d, int[] pesos) {
        int soma = 0;
        for (int i = 0; i < pesos.length; i++) {
            soma += d[i] * pesos[i];
        }
        int resto = soma % 11;
        return resto < 2 ? 0 : 11 - resto;
    }
}
