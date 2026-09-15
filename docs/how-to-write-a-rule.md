# Como escrever uma regra

1. Id estável: `effect-doctor/<kebab>`.
2. Sempre `bad` e `good` no Effect RC de `src/version.ts`.
3. Detector só com AST (`typescript` compiler API). Sem checker.
4. `error` = quebra runtime/tipos do canal E. `warning` = anti-padrão. `info` = nit.
5. Fixture ruim dispara. Fixture bom (`fixtures/good`) não pode ter error/warning.
6. `explain <id>` devolve a receita.

Pontos de extensão: `src/catalog.ts` (dados), `src/inspect.ts` / `src/nits.ts` (detecção), `src/project.ts` (package.json / tsconfig).
