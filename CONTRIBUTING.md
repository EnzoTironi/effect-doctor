# Contributing

Obrigado por contribuir. O Effect Doctor é um CLI determinístico: cada regra precisa de um padrão **ruim → bom** que um agente consiga colar. Sem prompt. Sem telemetria.

## Setup

```bash
npm install
npm test
npm run typecheck
npx tsx src/cli.ts fixtures/bad --verbose
npx tsx src/cli.ts fixtures/good --fail-on warning
```

Node 22+.

## Como adicionar uma regra

Guia curto: [docs/how-to-write-a-rule.md](./docs/how-to-write-a-rule.md).

1. `src/catalog.ts` — `r(id, severity, category, message, hint, bad, good)`.
   - `bad` e `good` no Effect RC atual (`src/version.ts`).
   - Mensagens em pt-BR.
2. Detector AST em `src/inspect.ts` ou `src/nits.ts` (sem typechecker).
3. Caso no `fixtures/bad` (dispara) e, se for warning/error, o `fixtures/good` **não** pode disparar.
4. Teste em `test/cli.test.ts` ou `test/catalog.test.ts`.
5. `effect-ts-doctor explain <id>` tem que devolver a receita.

Não adicione regra que precisa de tipos (`missingEffectContext`). Isso é outro produto.

## Padrões de CLI (agentes)

- Sem prompt interativo. Flags sempre bastam (`-y` e `--no-telemetry` são no-op).
- `--help` com `Examples:`.
- Erro: uma linha + invocação correta.
- `--json` ramifica em `schemaVersion`. Ver [docs/json-report.md](./docs/json-report.md).

## Corpus público

`npm run corpus` clona repositórios Effect reais e escreve [docs/public-repos.md](./docs/public-repos.md). Não roda no CI.

```bash
npm run test:public-effect-repos
```

## Licença

Modified MIT — ver `LICENSE`. Mesma ideia do [react-doctor](https://github.com/millionco/react-doctor): uso livre, **exceto** treinar modelo/IA e oferecer o software como SaaS/API paga sem permissão. Pedidos: enzo.tironi.2001@gmail.com.
