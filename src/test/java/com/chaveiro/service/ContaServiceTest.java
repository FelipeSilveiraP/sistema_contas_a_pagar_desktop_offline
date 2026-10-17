package com.chaveiro.service;

import com.chaveiro.model.Conta;
import com.chaveiro.model.StatusConta;
import com.chaveiro.repository.ContaRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.*;

@DisplayName("Testes de Regras de Negócio - ContaService (TDD)")
class ContaServiceTest {

    private ContaService contaService;
    private MockContaRepository mockRepository;

    @BeforeEach
    void setUp() {
        mockRepository = new MockContaRepository();
        contaService = new ContaService(mockRepository);
    }

    @Test
    @DisplayName("Deve rejeitar cadastro de conta com valor zero ou negativo")
    void deveRejeitarContaComValorInvalido() {
        Conta contaInvalida = Conta.nova(1L, "Empresa A", 1L, 1L, "LIVIA", 0.0, LocalDate.now(), "123", true, false);

        assertThatThrownBy(() -> contaService.cadastrar(contaInvalida))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("valor da conta deve ser maior que zero");
    }

    @Test
    @DisplayName("Deve propagar conta recorrente para exatamente 12 meses do ano")
    void devePropagarRecorrenciaParaTodosOsMeses() {
        List<Conta> geradas = contaService.propagarRecorrenciaAnual(
            1L,
            "ALUGUEL SALA",
            2L,
            1L,
            "LIVIA METIDIERI",
            1500.0,
            10,
            "DOC-ALUGUEL",
            2026
        );

        assertThat(geradas).hasSize(12);
        assertThat(geradas).allMatch(c -> c.statusPagamento() == StatusConta.PENDENTE);
        assertThat(geradas).allMatch(c -> c.recorrente());
        assertThat(geradas.get(0).dataVencimento()).isEqualTo(LocalDate.of(2026, 1, 10));
        assertThat(geradas.get(11).dataVencimento()).isEqualTo(LocalDate.of(2026, 12, 10));
    }

    // Mock simples em memória seguindo a filosofia Ponytail (sem frameworks pesados)
    private static class MockContaRepository extends ContaRepository {
        private final List<Conta> bancoEmMemoria = new ArrayList<>();
        private long seq = 1;

        @Override
        public Conta salvar(Conta conta) {
            Conta salva = new Conta(
                seq++,
                conta.idEmpresa(),
                conta.nomeEmpresa(),
                conta.idCategoria(),
                conta.nomeCategoria(),
                conta.idFormaPagamento(),
                conta.tipoFormaPagamento(),
                conta.idPagador(),
                conta.nomePagador(),
                conta.idNota(),
                conta.dataVencimento(),
                conta.valorTotal(),
                conta.statusPagamento(),
                conta.naPasta(),
                conta.numeroDocumento(),
                conta.observacoes(),
                conta.recorrente()
            );
            bancoEmMemoria.add(salva);
            return salva;
        }

        @Override
        public List<Conta> listarPendentes() {
            return bancoEmMemoria.stream()
                .filter(c -> c.statusPagamento() != StatusConta.PAGO)
                .toList();
        }
    }
}
