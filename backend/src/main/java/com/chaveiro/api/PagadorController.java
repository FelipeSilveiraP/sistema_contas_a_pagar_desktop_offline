package com.chaveiro.api;

import com.chaveiro.model.Pagador;
import com.chaveiro.service.PagadorService;
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
 * API REST do cadastro de pagadores. A logica de validacao vive no servico.
 */
@RestController
@RequestMapping("/api/pagadores")
public class PagadorController {

    public record PagadorRequest(String nome, String cpf, String funcao) {
    }

    private final PagadorService service;

    public PagadorController(PagadorService service) {
        this.service = service;
    }

    @GetMapping
    public List<Pagador> listar() {
        return service.listar();
    }

    @GetMapping("/{id}")
    public Pagador buscar(@PathVariable long id) {
        return service.buscarPorId(id);
    }

    @PostMapping
    public ResponseEntity<Pagador> cadastrar(@RequestBody PagadorRequest requisicao) {
        Pagador criado = service.cadastrar(paraModelo(requisicao));
        return ResponseEntity.created(URI.create("/api/pagadores/" + criado.id())).body(criado);
    }

    @PutMapping("/{id}")
    public Pagador atualizar(@PathVariable long id, @RequestBody PagadorRequest requisicao) {
        return service.atualizar(id, paraModelo(requisicao));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> excluir(@PathVariable long id) {
        service.excluir(id);
        return ResponseEntity.noContent().build();
    }

    private static Pagador paraModelo(PagadorRequest requisicao) {
        return new Pagador(null, requisicao.nome(), requisicao.cpf(), requisicao.funcao());
    }
}
