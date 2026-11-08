package com.chaveiro.api;

import com.chaveiro.database.InicializadorBanco;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class StatusController {

    @GetMapping("/status")
    public Map<String, String> status() {
        return Map.of(
                "status", "ok",
                "app", "contas-a-pagar",
                "fase", "1",
                "inicializado", String.valueOf(InicializadorBanco.estaPronto())
        );
    }
}
