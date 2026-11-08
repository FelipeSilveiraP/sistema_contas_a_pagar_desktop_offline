package com.chaveiro.api;

import com.chaveiro.model.Conta;
import com.chaveiro.service.ContaService;
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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * API REST das contas a pagar. A logica de validacao vive no servico.
 */
@RestController
@RequestMapping("/api/contas")
public class ContaController {

    public record ContaRequest(
            Long idEmpresa,
            Long idPagador,
            String categoria,
            String numeroDocumento,
            BigDecimal valor,
            LocalDate vencimento,
            Boolean boletoNaPasta,
            Boolean forcar
    ) {}

    private final ContaService service;

    public ContaController(ContaService service) {
        this.service = service;
    }

    @GetMapping
    public List<Conta> listar(@RequestParam(required = false) String status) {
        return service.listar(status);
    }

    @GetMapping("/{id}")
    public Conta buscar(@PathVariable long id) {
        return service.buscarPorId(id);
    }

    @PostMapping
    public ResponseEntity<Conta> cadastrar(@RequestBody ContaRequest requisicao) {
        Conta criada = service.cadastrar(paraModelo(requisicao),
                Boolean.TRUE.equals(requisicao.forcar()));
        return ResponseEntity.created(URI.create("/api/contas/" + criada.id())).body(criada);
    }

    @PutMapping("/{id}")
    public Conta atualizar(@PathVariable long id, @RequestBody ContaRequest requisicao) {
        return service.atualizar(id, paraModelo(requisicao));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> excluir(@PathVariable long id) {
        service.excluir(id);
        return ResponseEntity.noContent().build();
    }

    private static Conta paraModelo(ContaRequest requisicao) {
        return new Conta(
                null,
                requisicao.idEmpresa(),
                null,
                requisicao.idPagador(),
                null,
                requisicao.categoria(),
                requisicao.numeroDocumento(),
                requisicao.valor(),
                requisicao.vencimento(),
                Boolean.TRUE.equals(requisicao.boletoNaPasta()),
                "PENDENTE"
        );
    }
}
