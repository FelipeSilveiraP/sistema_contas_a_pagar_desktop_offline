package com.chaveiro.api;

import com.chaveiro.model.Empresa;
import com.chaveiro.model.Empresa.TelefoneEmpresa;
import com.chaveiro.service.EmpresaService;
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
 * API REST do cadastro de empresas. A logica de validacao vive no servico.
 */
@RestController
@RequestMapping("/api/empresas")
public class EmpresaController {

    public record TelefoneRequest(String numero, String tipo) {
    }

    public record EmpresaRequest(String cnpj, String razaoSocial, String nomeRepresentante,
                                 String email, String logradouro, List<TelefoneRequest> telefones) {
    }

    private final EmpresaService service;

    public EmpresaController(EmpresaService service) {
        this.service = service;
    }

    @GetMapping
    public List<Empresa> listar() {
        return service.listar();
    }

    @GetMapping("/{id}")
    public Empresa buscar(@PathVariable long id) {
        return service.buscarPorId(id);
    }

    @PostMapping
    public ResponseEntity<Empresa> cadastrar(@RequestBody EmpresaRequest requisicao) {
        Empresa criada = service.cadastrar(paraModelo(requisicao));
        return ResponseEntity.created(URI.create("/api/empresas/" + criada.id())).body(criada);
    }

    @PutMapping("/{id}")
    public Empresa atualizar(@PathVariable long id, @RequestBody EmpresaRequest requisicao) {
        return service.atualizar(id, paraModelo(requisicao));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> excluir(@PathVariable long id) {
        service.excluir(id);
        return ResponseEntity.noContent().build();
    }

    private static Empresa paraModelo(EmpresaRequest requisicao) {
        List<TelefoneEmpresa> telefones = requisicao.telefones() == null ? List.of()
                : requisicao.telefones().stream()
                        .map(t -> new TelefoneEmpresa(t.numero(), t.tipo()))
                        .toList();
        return new Empresa(null, requisicao.cnpj(), requisicao.razaoSocial(),
                requisicao.nomeRepresentante(), requisicao.email(), requisicao.logradouro(), telefones);
    }
}
