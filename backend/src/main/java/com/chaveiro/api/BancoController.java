package com.chaveiro.api;

import com.chaveiro.model.Banco;
import com.chaveiro.service.BancoService;
import java.net.URI;
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
 * API REST do cadastro de bancos. A logica de validacao vive no servico.
 */
@RestController
@RequestMapping("/api/bancos")
public class BancoController {

    public record BancoRequest(String instituicao, String chavePix) {
    }

    private final BancoService service;

    public BancoController(BancoService service) {
        this.service = service;
    }

    @GetMapping
    public List<Banco> listar() {
        return service.listar();
    }

    @GetMapping("/{id}")
    public Banco buscar(@PathVariable long id) {
        return service.buscarPorId(id);
    }

    @PostMapping
    public ResponseEntity<Banco> cadastrar(@RequestBody BancoRequest requisicao) {
        Banco criado = service.cadastrar(paraModelo(requisicao));
        return ResponseEntity.created(URI.create("/api/bancos/" + criado.id())).body(criado);
    }

    @PutMapping("/{id}")
    public Banco atualizar(@PathVariable long id, @RequestBody BancoRequest requisicao) {
        return service.atualizar(id, paraModelo(requisicao));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> excluir(@PathVariable long id) {
        service.excluir(id);
        return ResponseEntity.noContent().build();
    }

    private static Banco paraModelo(BancoRequest requisicao) {
        return new Banco(null, requisicao.instituicao(), requisicao.chavePix());
    }
}
