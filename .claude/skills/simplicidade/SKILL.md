---
name: simplicidade
description: Escrever e revisar código com o mínimo de complexidade (YAGNI, reuso, stdlib/plataforma antes de dependência) e listar o que pode ser cortado num diff. Use ao implementar qualquer mudança, ao revisar código ou quando o usuário pedir revisão de complexidade/over-engineering.
---

# Simplicidade (escrever e revisar)

Consolida `ponytail` e `ponytail-review`.

## Ao escrever: pare no primeiro degrau que resolve

1. Isso precisa existir? Se a necessidade é especulativa, não faça e diga isso em uma linha.
2. Já existe no projeto? Reuse antes de escrever: `mascaras.ts`, `dialogos.ts`, `componentes.ts`, `navegacao.ts`, `api.ts`, exceções de `service/`, `ConnectionFactory`.
3. A biblioteca padrão (Java/TS) resolve?
4. A plataforma resolve? (`<input type="date">`, CSS em vez de JS, constraint do SQLite em vez de código)
5. Uma dependência já instalada resolve? **Não adicione dependência nova** para o que poucas linhas fazem.
6. Só então escreva o mínimo que funciona.

**Entenda antes de simplificar:** leia o fluxo inteiro que a mudança toca. O menor diff no lugar errado é um segundo bug.

## Regras

- Sem interface com uma implementação só, factory para um produto só ou configuração para valor que nunca muda.
- Sem andaime "para depois". Apagar vale mais que acrescentar; o óbvio vale mais que o esperto. O menor número de arquivos possível.
- Atalho consciente com limite conhecido leva um comentário `// simplificação: <limite>; trocar por <X> se <Y>`.

## Nunca simplificar

Validação na entrada da API, transações e tratamento de erro que evitam perda de dados, segurança (token, CSP, DOM seguro), acessibilidade básica, isolamento do banco nos testes e qualquer coisa pedida explicitamente.

## Ao revisar um diff

Uma linha por achado:

`arquivo:L<linha>: <tag> <o quê>. <substituto>.`

| Tag | Quando |
|---|---|
| `apagar:` | Código morto, flexibilidade sem uso, recurso especulativo |
| `stdlib:` | Algo feito à mão que a biblioteca padrão já tem (diga qual função) |
| `nativo:` | Algo que a plataforma ou o navegador já fazem |
| `yagni:` | Abstração com um uso só |
| `encurtar:` | Mesma lógica em menos linhas (mostre a versão curta) |

- Termine com `líquido: -N linhas possíveis`, ou `Já está enxuto.`
- **Escopo:** só complexidade. Bugs e segurança vão para uma revisão normal (`/code-review`).
