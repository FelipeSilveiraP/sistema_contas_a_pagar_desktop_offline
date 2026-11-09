package com.chaveiro.api;

import com.chaveiro.model.Pagamento;
import com.chaveiro.service.PagamentoService;
import java.math.BigDecimal;
import java.net.URI;
import java.time.LocalDate;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * API REST dos pagamentos (baixa, estorno e correcao).
 */
@RestController
@RequestMapping("/api")
public class PagamentoController {

    public record PagamentoRequest(
            LocalDate dataPagamento,
            BigDecimal valorPago,
            Long idBanco
    ) {}

    private final PagamentoService service;

    public PagamentoController(PagamentoService service) {
        this.service = service;
    }

    @GetMapping("/pagamentos")
    public List<Pagamento> listar() {
        return service.listar();
    }

    @GetMapping("/contas/{id}/pagamento")
    public Pagamento buscarPorConta(@PathVariable long id) {
        return service.buscarPorConta(id);
    }

    @PostMapping("/contas/{id}/pagamento")
    public ResponseEntity<Pagamento> registrar(@PathVariable long id, @RequestBody PagamentoRequest requisicao) {
        Pagamento criado = service.registrar(id, paraModelo(requisicao));
        return ResponseEntity.created(URI.create("/api/pagamentos/" + criado.id())).body(criado);
    }

    @DeleteMapping("/contas/{id}/pagamento")
    public ResponseEntity<Void> estornar(@PathVariable long id) {
        service.estornar(id);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/pagamentos/{id}")
    public Pagamento atualizar(@PathVariable long id, @RequestBody PagamentoRequest requisicao) {
        return service.atualizar(id, paraModelo(requisicao));
    }

    private static Pagamento paraModelo(PagamentoRequest requisicao) {
        return new Pagamento(null, null, requisicao.dataPagamento(), requisicao.valorPago(),
                requisicao.idBanco(), null, null, null);
    }
}
