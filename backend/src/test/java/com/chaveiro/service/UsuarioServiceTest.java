package com.chaveiro.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.chaveiro.database.ConnectionFactory;
import com.chaveiro.database.DatabaseInitializer;
import com.chaveiro.repository.UsuarioRepository;
import com.chaveiro.service.UsuarioService.Dados;
import com.chaveiro.service.UsuarioService.Sessao;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

/** Contas com PIN, admin, bloqueio, historico, e-mail e criptografia (SQLite real em tmp). */
class UsuarioServiceTest {

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
                emails.add(new String[] {remetente, senhaApp, destino, assunto, texto});
            }
        };
        service = new UsuarioService(new UsuarioRepository(conexao), new Cripto(conexao), falso);
    }

    private Sessao admin() {
        return service.criarPrimeiroAdmin(new Dados("Felipe", "Felipe.Adm", "felipe@exemplo.com", "1234", null, null));
    }

    private long id(String nome) {
        return service.perfis().stream().filter(p -> p.nome().equals(nome)).findFirst().orElseThrow().id();
    }

    private String sql(String consulta) throws Exception {
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

    @Test
    void primeiraAberturaCriaOAdminUmaVezSo() {
        assertThat(service.primeiroAcesso()).isTrue();
        Sessao s = admin();
        assertThat(s.admin()).isTrue();
        assertThat(service.primeiroAcesso()).isFalse();
        assertThatThrownBy(() -> service.criarPrimeiroAdmin(new Dados("Outro", null, "outro@exemplo.com", "9999", null, null)))
                .isInstanceOf(AcessoNegadoException.class);
    }

    @Test
    void loginEmailEPinNuncaFicamEmTextoNoBanco() throws Exception {
        admin();
        String linha = sql("SELECT * FROM usuarios").toLowerCase();
        assertThat(linha).doesNotContain("felipe.adm").doesNotContain("felipe@exemplo.com").doesNotContain("|1234|");
        assertThat(linha).contains("v1:").contains("pbkdf2$");
        assertThat(Files.exists(pasta.resolve(Cripto.ARQUIVO_CHAVE))).isTrue();
        // a chave fica FORA do banco
        assertThat(sql("SELECT valor FROM manutencao")).doesNotContain(Files.readString(pasta.resolve(Cripto.ARQUIVO_CHAVE), java.nio.charset.StandardCharsets.ISO_8859_1));
    }

    @Test
    void pinCertoEntraEContaAcessoPinErradoBloqueiaNaQuinta() {
        Sessao adm = admin();
        service.cadastrar(adm.token(), new Dados("Renato", null, "renato@exemplo.com", "4321", false, null), null);
        long renato = id("RENATO");

        assertThat(service.entrar(renato, "4321").nome()).isEqualTo("RENATO");
        for (int i = 1; i <= 4; i++) {
            assertThatThrownBy(() -> service.entrar(renato, "0000")).isInstanceOf(AcessoNegadoException.class)
                    .satisfies(e -> assertThat(((AcessoNegadoException) e).getStatus()).isEqualTo(401));
        }
        assertThatThrownBy(() -> service.entrar(renato, "0000"))
                .satisfies(e -> assertThat(((AcessoNegadoException) e).getStatus()).isEqualTo(423));
        // bloqueada: nem o PIN certo entra
        assertThatThrownBy(() -> service.entrar(renato, "4321"))
                .satisfies(e -> assertThat(((AcessoNegadoException) e).getStatus()).isEqualTo(423));
        assertThat(service.listar(adm.token()).stream().filter(u -> u.id() == renato).findFirst().orElseThrow())
                .satisfies(u -> {
                    assertThat(u.acessos()).isEqualTo(1);
                    assertThat(u.bloqueado()).isTrue();
                });
        // o admin cria um PIN novo e desbloqueia
        service.novoPin(adm.token(), renato, "5555");
        assertThat(service.entrar(renato, "5555").id()).isEqualTo(renato);
    }

    @Test
    void soOAdminCadastraEEditaContas() {
        Sessao adm = admin();
        service.cadastrar(adm.token(), new Dados("Jonatan", null, "jonatan@exemplo.com", "1111", false, null), null);
        Sessao jonatan = service.entrar(id("JONATAN"), "1111");

        assertThatThrownBy(() -> service.listar(jonatan.token()))
                .satisfies(e -> assertThat(((AcessoNegadoException) e).getStatus()).isEqualTo(403));
        assertThatThrownBy(() -> service.novoPin(jonatan.token(), adm.id(), "9999"))
                .satisfies(e -> assertThat(((AcessoNegadoException) e).getStatus()).isEqualTo(403));
        assertThatThrownBy(() -> service.listar(null))
                .satisfies(e -> assertThat(((AcessoNegadoException) e).getStatus()).isEqualTo(401));

        var editado = service.atualizar(adm.token(), jonatan.id(), new Dados("Jonatan S.", null, "Novo@Hotmail.com.br", null, null, null));
        assertThat(editado.nome()).isEqualTo("JONATAN S.");
        // trocar o e-mail troca o login junto (qualquer provedor)
        assertThat(editado.login()).isEqualTo("novo@hotmail.com.br");
        assertThat(editado.email()).isEqualTo("novo@hotmail.com.br");
        // o proprio usuario so troca o PIN dele, sabendo o atual
        assertThatThrownBy(() -> service.trocarMeuPin(jonatan.token(), "0000", "2222")).isInstanceOf(DadosInvalidosException.class);
        service.trocarMeuPin(jonatan.token(), "1111", "2222");
        assertThat(service.entrar(jonatan.id(), "2222").id()).isEqualTo(jonatan.id());
        // desativar derruba a sessao
        service.atualizar(adm.token(), jonatan.id(), new Dados(null, null, null, null, null, false));
        assertThatThrownBy(() -> service.eu(jonatan.token())).isInstanceOf(AcessoNegadoException.class);
    }

    @Test
    void naoFicaSemAdministradorEOHistoricoNaoSome() throws Exception {
        Sessao adm = admin();
        assertThatThrownBy(() -> service.atualizar(adm.token(), adm.id(), new Dados(null, null, null, null, false, null)))
                .isInstanceOf(ConflitoIntegridadeException.class);
        service.cadastrar(adm.token(), new Dados("Habner", null, "habner@empresa.com", "7777", false, null), null);
        long habner = id("HABNER");
        service.entrar(habner, "7777");
        service.excluir(adm.token(), habner);

        assertThat(sql("SELECT nome, tipo FROM acessos_usuario WHERE id_usuario IS NULL")).contains("HABNER|ENTRADA");
        assertThatThrownBy(() -> sql("DELETE FROM acessos_usuario")).hasMessageContaining("ACESSOS_SOMENTE_LEITURA");
        assertThatThrownBy(() -> service.excluir(adm.token(), adm.id())).isInstanceOf(ConflitoIntegridadeException.class);
    }

    @Test
    void esqueciOPinMandaCodigoParaOEmailDaContaEParaOEmailDaLoja() {
        Sessao adm = admin();
        assertThatThrownBy(() -> service.esqueciPin("felipe@exemplo.com")).isInstanceOf(DadosInvalidosException.class); // sem Gmail configurado
        service.gravarConfigEmail(adm.token(), "loja@gmail.com", "abcd efgh ijkl mnop");
        assertThat(service.configEmail(adm.token())).containsEntry("configurado", true);
        assertThatThrownBy(() -> service.esqueciPin("ninguem@exemplo.com")).isInstanceOf(DadosInvalidosException.class);

        // o login e o e-mail (maiusculas nao importam); vai para a pessoa e para a loja
        String para = service.esqueciPin("FELIPE@exemplo.com");
        assertThat(para).isEqualTo("f*****@exemplo.com e l***@gmail.com (loja)");
        assertThat(emails).hasSize(2);
        assertThat(emails).extracting(e -> e[2]).containsExactly("felipe@exemplo.com", "loja@gmail.com");
        assertThat(emails.getFirst()[0]).isEqualTo("loja@gmail.com");
        assertThat(emails.getFirst()[1]).isEqualTo("abcdefghijklmnop");
        Matcher m = Pattern.compile("\\b(\\d{6})\\b").matcher(emails.getFirst()[4]);
        assertThat(m.find()).isTrue();
        String codigo = m.group(1);
        assertThat(emails.get(1)[4]).contains(codigo).contains("FELIPE");

        assertThatThrownBy(() -> service.redefinirPin("felipe@exemplo.com", "000000".equals(codigo) ? "111111" : "000000", "8888"))
                .isInstanceOf(DadosInvalidosException.class);
        service.redefinirPin("felipe@exemplo.com", codigo, "8888");
        assertThat(service.entrar(adm.id(), "8888").admin()).isTrue();
        // codigo usado nao vale de novo
        assertThatThrownBy(() -> service.redefinirPin("felipe@exemplo.com", codigo, "9999")).isInstanceOf(DadosInvalidosException.class);
    }

    @Test
    void pinFotoELoginInvalidosSaoRecusados() {
        Sessao adm = admin();
        assertThatThrownBy(() -> service.cadastrar(adm.token(), new Dados("X", null, "nao-email", "12", false, null), null))
                .isInstanceOf(DadosInvalidosException.class)
                .satisfies(e -> assertThat(((DadosInvalidosException) e).getCampos()).containsKeys("nome", "email", "pin"));
        assertThatThrownBy(() -> service.cadastrar(adm.token(), new Dados("Sem", null, null, "1234", false, null), null))
                .isInstanceOf(DadosInvalidosException.class); // e-mail obrigatorio (e o login)
        assertThatThrownBy(() -> service.cadastrar(adm.token(), new Dados("Luis", null, "FELIPE@exemplo.com", "1234", false, null), null))
                .isInstanceOf(DadosInvalidosException.class)
                .satisfies(e -> assertThat(((DadosInvalidosException) e).getCampos()).containsKey("email")); // e-mail repetido
        assertThatThrownBy(() -> service.trocarFoto(adm.token(), adm.id(), "nao e imagem".getBytes()))
                .isInstanceOf(DadosInvalidosException.class);
        byte[] png = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 0, 0};
        service.trocarFoto(adm.token(), adm.id(), png);
        assertThat(service.foto(adm.id())).isEqualTo(png);
    }
}
