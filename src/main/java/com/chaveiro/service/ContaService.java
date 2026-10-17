package com.chaveiro.service;

import com.chaveiro.model.Conta;
import com.chaveiro.model.StatusConta;
import com.chaveiro.repository.ContaRepository;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * Camada de Serviço que encapsula as regras de negócio financeiras.
 * Isola a lógica das telas (JavaFX) e do acesso ao banco (Repository).
 */
public class ContaService {

    private final ContaRepository repository;

    public ContaService(ContaRepository repository) {
        this.repository = repository;
    }

    public Conta cadastrar(Conta conta) {
        if (conta.valorTotal() <= 0) {
            throw new IllegalArgumentException("O valor da conta deve ser maior que zero.");
        }
        if (conta.dataVencimento() == null) {
            throw new IllegalArgumentException("A data de vencimento é obrigatória.");
        }
        return repository.salvar(conta);
    }

    /**
     * Efetua a baixa rápida atômica com auditoria e movimentação bancária.
     */
    public void darBaixaRapida(Long idConta, Long idBanco, String operador) {
        if (idConta == null) {
            throw new IllegalArgumentException("O ID da conta é obrigatório para dar baixa.");
        }
        repository.darBaixaAtomiaca(idConta, idBanco, operador);
    }

    public List<Conta> listarTodas() {
        return repository.listarTodas();
    }

    public List<Conta> listarPendentes() {
        return repository.listarPendentes();
    }

    public List<Conta> listarPagas() {
        return repository.listarPagas();
    }

    /**
     * Propaga um boleto padrão por todos os 12 meses do ano.
     * Reproduz fielmente a rotina do VBA original da planilha!
     */
    public List<Conta> propagarRecorrenciaAnual(Long idEmpresa, String nomeEmpresa, Long idCategoria,
                                                Long idPagador, String nomePagador, double valor, 
                                                int diaVencimento, String doc, int ano) {
        List<Conta> geradas = new ArrayList<>();
        for (int mes = 1; mes <= 12; mes++) {
            int diaAjustado = Math.min(diaVencimento, LocalDate.of(ano, mes, 1).lengthOfMonth());
            LocalDate vencimento = LocalDate.of(ano, mes, diaAjustado);

            Conta novaRecorrente = new Conta(
                null,
                idEmpresa != null ? idEmpresa : 1L,
                nomeEmpresa != null ? nomeEmpresa.toUpperCase().trim() : "FORNECEDOR RECORRENTE",
                idCategoria != null ? idCategoria : 1L,
                "Recorrente Mensal",
                1L,
                "Boleto Bancário",
                idPagador != null ? idPagador : 1L,
                nomePagador != null ? nomePagador : "LIVIA METIDIERI",
                null,
                vencimento,
                valor,
                StatusConta.PENDENTE,
                true, // na_pasta = true por padrão nos recorrentes físicos
                doc,
                "Gerado automaticamente por recorrência anual",
                true
            );
            geradas.add(repository.salvar(novaRecorrente));
        }
        return geradas;
    }

    /**
     * Para a recorrência excluindo lançamentos pendentes futuros,
     * mas preservando os meses já pagos no histórico.
     */
    public void cancelarRecorrencia(String identificadorEmpresa) {
        if (identificadorEmpresa != null && !identificadorEmpresa.isBlank()) {
            repository.excluirPendentesDeFornecedor(identificadorEmpresa.trim());
        }
    }

    /**
     * Retorna contas pendentes vencendo hoje ou já atrasadas.
     * Espelho da rotina VerificarVencimentosAoAbrir do VBA.
     */
    public List<Conta> obterContasVencendoHojeOuAtrasadas() {
        LocalDate hoje = LocalDate.now();
        return repository.listarPendentes().stream()
            .filter(c -> c.dataVencimento() != null && !c.dataVencimento().isAfter(hoje))
            .toList();
    }
}
