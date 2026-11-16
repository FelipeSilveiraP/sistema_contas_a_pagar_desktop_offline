package com.chaveiro.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.chaveiro.database.ConnectionFactory;
import com.chaveiro.database.DatabaseInitializer;
import com.chaveiro.repository.UsuarioRepository;
import com.chaveiro.service.UsuarioService.Dados;
import com.chaveiro.service.UsuarioService.Sessao;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

/**
 * Forca bruta no PIN e no "Esqueci o PIN", envio em massa de e-mails, injecao de
 * cabecalho e a auditoria das contas (sem segredos). Banco temporario.
 */
class SegurancaContasTest {

    @TempDir
    Path pasta;

    private ConnectionFactory conexao;
    private UsuarioService service;
    private final List<String[]> emails = new ArrayList<>();

    @BeforeEach
    void preparar() {
        conexao = new ConnectionFactory(pasta.resolve("contas_teste.db").toString());
        new DatabaseInitializer(conexao).inicializar();
        Carteiro falso = new Carteiro() {
            @Override
            public void enviar(String remetente, String senhaApp, String destino, String assunto, String texto) {
                synchronized (emails) {
                    emails.add(new String[] {remetente, senhaApp, destino, assunto, texto});
                }
            }
        };
        service = new UsuarioService(new UsuarioRepository(conexao), new Cripto(conexao), falso);
    }

    private Sessao admin() {
        return service.criarPrimeiroAdmin(new Dados("Felipe", null, "felipe@exemplo.com", "1234", null, null));
    }

    private long conta(Sessao adm, String nome, String email) {
        return service.cadastrar(adm.token(), new Dados(nome, null, email, "4321", false, null), null).id();
    }

    private void sql(String comando) throws SQLException {
        try (Connection c = conexao.getConnection(); Statement st = c.createStatement()) {
            st.execute(comando);
        }
    }

    private String texto(String consulta) throws SQLException {
        try (Connection c = conexao.getConnection(); Statement st = c.createStatement(); ResultSet rs = st.executeQuery(consulta)) {
            StringBuilder tudo = new StringBuilder();
            while (rs.next()) {
                for (int i = 1; i <= rs.getMetaData().getColumnCount(); i++) {
                    tudo.append(rs.getString(i)).append('|');
                }
            }
            return tudo.toString();
        }
    }

    private int numero(String consulta) throws SQLException {
        return Integer.parseInt(texto(consulta).replace("|", ""));
    }

    private static int status(Throwable erro) {
        return ((AcessoNegadoException) erro).getStatus();
    }

    @Test
    void pinsErradosAoMesmoTempoNaoPassamDoLimiteDe5() throws Exception {
        Sessao adm = admin();
        long renato = conta(adm, "Renato", "renato@exemplo.com");
        ExecutorService pool = Executors.newFixedThreadPool(16);
        AtomicInteger bloqueadas = new AtomicInteger();
        List<Future<?>> tarefas = new ArrayList<>();
        for (int i = 0; i < 40; i++) {
            String pin = String.format("%04d", 5000 + i);
            tarefas.add(pool.submit(() -> {
                try {
                    service.entrar(renato, pin);
                } catch (AcessoNegadoException e) {
                    if (e.getStatus() == 423) {
                        bloqueadas.incrementAndGet();
                    }
                }
            }));
        }
        for (Future<?> t : tarefas) {
            t.get();
        }
        pool.shutdown();
        // so 5 PINs foram de fato conferidos; os outros 35 bateram na conta bloqueada
        assertThat(numero("SELECT COUNT(*) FROM acessos_usuario WHERE id_usuario = " + renato
                + " AND tipo IN ('PIN_ERRADO', 'BLOQUEIO')")).isEqualTo(5);
        assertThat(bloqueadas.get()).isEqualTo(36);
        // nem o PIN certo entra enquanto estiver bloqueada
        assertThatThrownBy(() -> service.entrar(renato, "4321")).satisfies(e -> assertThat(status(e)).isEqualTo(423));
    }

    @Test
    void cadaBloqueioDoDiaDobraOTempo() throws Exception {
        Sessao adm = admin();
        long renato = conta(adm, "Renato", "renato@exemplo.com");
        int[] esperado = {5, 10, 20, 40};
        for (int rodada = 0; rodada < esperado.length; rodada++) {
            Throwable ultimo = null;
            for (int i = 0; i < 5; i++) {
                try {
                    service.entrar(renato, "0000");
                } catch (AcessoNegadoException e) {
                    ultimo = e;
                }
            }
            assertThat(status(ultimo)).isEqualTo(423);
            assertThat(((AcessoNegadoException) ultimo).getExtra()).containsEntry("minutos", esperado[rodada]);
            // "espera" o bloqueio passar
            sql("UPDATE usuarios SET bloqueado_ate = datetime('now', 'localtime', '-1 minute') WHERE id_usuario = " + renato);
        }
        assertThat(service.entrar(renato, "4321").id()).isEqualTo(renato);
    }

    @Test
    void pinGiganteNaoTravaOServidor() {
        Sessao adm = admin();
        long renato = conta(adm, "Renato", "renato@exemplo.com");
        long inicio = System.nanoTime();
        assertThatThrownBy(() -> service.entrar(renato, "9".repeat(1_000_000))).isInstanceOf(AcessoNegadoException.class);
        assertThat((System.nanoTime() - inicio) / 1_000_000).isLessThan(5_000);
    }

    @Test
    void esqueciOPinTemLimiteContraEnvioEmMassa() throws Exception {
        Sessao adm = admin();
        service.gravarConfigEmail(adm.token(), "loja@gmail.com", "abcdefghijklmnop");
        conta(adm, "Renato", "renato@exemplo.com");
        service.esqueciPin("renato@exemplo.com");
        // de novo no mesmo minuto: 429 e nenhum e-mail a mais
        int antes = emails.size();
        assertThatThrownBy(() -> service.esqueciPin("renato@exemplo.com")).satisfies(e -> assertThat(status(e)).isEqualTo(429));
        assertThat(emails).hasSize(antes);
        // 5 por hora por conta
        for (int i = 0; i < 4; i++) {
            sql("UPDATE codigos_redefinicao SET criado_em = datetime(criado_em, '-2 minutes')");
            service.esqueciPin("renato@exemplo.com");
        }
        sql("UPDATE codigos_redefinicao SET criado_em = datetime(criado_em, '-2 minutes')");
        assertThatThrownBy(() -> service.esqueciPin("renato@exemplo.com")).satisfies(e -> assertThat(status(e)).isEqualTo(429));
        // depois de 1 hora volta a funcionar
        sql("UPDATE codigos_redefinicao SET criado_em = datetime(criado_em, '-61 minutes')");
        service.esqueciPin("renato@exemplo.com");
        // e no total o sistema manda no maximo 20 por hora (varias contas)
        for (int i = 0; i < 20; i++) {
            sql("INSERT INTO codigos_redefinicao (id_usuario, codigo_hash, expira_em, usado) VALUES (" + adm.id()
                    + ", 'x', datetime('now', 'localtime', '+15 minutes'), 1)");
        }
        conta(adm, "Luis", "luis@exemplo.com");
        assertThatThrownBy(() -> service.esqueciPin("luis@exemplo.com")).satisfies(e -> assertThat(status(e)).isEqualTo(429));
    }

    @Test
    void codigoDoEmailNaoPodeSerAdivinhado() throws Exception {
        Sessao adm = admin();
        service.gravarConfigEmail(adm.token(), "loja@gmail.com", "abcdefghijklmnop");
        service.esqueciPin("felipe@exemplo.com");
        Matcher m = Pattern.compile("\\b(\\d{6})\\b").matcher(emails.getFirst()[4]);
        assertThat(m.find()).isTrue();
        String certo = m.group(1);
        String errado = "000000".equals(certo) ? "111111" : "000000";
        for (int i = 0; i < 5; i++) {
            assertThatThrownBy(() -> service.redefinirPin("felipe@exemplo.com", errado, "7777")).isInstanceOf(DadosInvalidosException.class);
        }
        // depois de 5 erros o codigo morre: nem o certo funciona mais
        assertThatThrownBy(() -> service.redefinirPin("felipe@exemplo.com", certo, "7777")).isInstanceOf(DadosInvalidosException.class);
        // codigo que nao e de 6 numeros nem e conferido (e conta como tentativa? nao precisa: ja morreu)
        assertThatThrownBy(() -> service.redefinirPin("felipe@exemplo.com", "' OR 1=1 --", "7777")).isInstanceOf(DadosInvalidosException.class);
        assertThat(service.entrar(adm.id(), "1234").admin()).isTrue();
    }

    @Test
    void quemAchaASessaoAbertaNaoDescobreOPinChutando() {
        Sessao adm = admin();
        conta(adm, "Renato", "renato@exemplo.com");
        long renato = service.perfis().stream().filter(p -> p.nome().equals("RENATO")).findFirst().orElseThrow().id();
        Sessao s = service.entrar(renato, "4321");
        for (int i = 0; i < 4; i++) {
            assertThatThrownBy(() -> service.trocarMeuPin(s.token(), "0000", "5555")).isInstanceOf(DadosInvalidosException.class);
        }
        assertThatThrownBy(() -> service.trocarMeuPin(s.token(), "0000", "5555")).satisfies(e -> assertThat(status(e)).isEqualTo(423));
        // a sessao caiu e a conta ficou bloqueada
        assertThatThrownBy(() -> service.eu(s.token())).satisfies(e -> assertThat(status(e)).isEqualTo(401));
        assertThatThrownBy(() -> service.entrar(renato, "4321")).satisfies(e -> assertThat(status(e)).isEqualTo(423));
    }

    @Test
    void emailComQuebraDeLinhaOuSeparadorNaoEValido() {
        for (String e : new String[] {"a@b.com\r\nBcc: c@d.com", "a@b.com\n", "a@b.com\u0000", "a@b.com,c@d.com", "a@b.com;c@d.com",
                "<a@b.com>", "\"a\"@b.com", "a b@c.com", "a@b", "@b.com", "a@b.c" + "o".repeat(120)}) {
            assertThat(UsuarioService.emailValido(e)).as(e).isFalse();
        }
        assertThat(UsuarioService.emailValido("felipe.silva+loja@gmail.com")).isTrue();
        assertThat(UsuarioService.emailValido("contato@chaveiro-universal.com.br")).isTrue();
    }

    @Test
    void auditoriaDasContasNaoGuardaSegredos() throws Exception {
        Sessao adm = admin();
        long renato = conta(adm, "Renato", "renato@exemplo.com");
        service.atualizar(adm.token(), renato, new Dados("Renato Silva", null, null, null, true, null));
        service.novoPin(adm.token(), renato, "9999");
        service.gravarConfigEmail(adm.token(), "loja@gmail.com", "abcdefghijklmnop");
        String auditoria = texto("SELECT tabela, operacao, antes, depois FROM auditoria_operacoes WHERE tabela IN ('usuarios', 'manutencao')");
        assertThat(auditoria).contains("usuarios|INSERT", "usuarios|UPDATE", "manutencao|", "RENATO SILVA", "\"pin_trocado\":1");
        // nada de hash de PIN, login/e-mail (cifrados ou nao) nem a senha de app
        assertThat(auditoria).doesNotContain("pbkdf2", "v1:", "renato@exemplo.com", "abcdefghijklmnop", "loja@gmail.com");
        // e a auditoria continua somente-leitura
        assertThatThrownBy(() -> sql("DELETE FROM auditoria_operacoes")).hasMessageContaining("AUDITORIA_SOMENTE_LEITURA");
    }

    @Test
    void bancoRecusaFotoGrandeMesmoPorFora() throws Exception {
        Sessao adm = admin();
        assertThatThrownBy(() -> sql("UPDATE usuarios SET foto = zeroblob(1048577) WHERE id_usuario = " + adm.id()))
                .hasMessageContaining("FOTO_GRANDE");
    }
}
