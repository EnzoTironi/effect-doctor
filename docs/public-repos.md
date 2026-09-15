# Corpus público

Scan do Effect Doctor contra repositórios Effect reais (clone `--depth 1`). Não é CI obrigatória: `npm run corpus`.

Gerado em 2026-09-15T15:26:55.618Z. 9/9 clonar+scan OK, 9 com Effect detectado.

## Como ler

O alvo do doctor é `effect@4.0.0-rc.115`. Repos ainda em Effect 3 disparam de propósito regras `v4-*`, `legacy-default-layer` e `v4-context-tag`. Isso valida o detector; não é um ranking de qualidade do repositório.

O monorepo `Effect-TS/effect` fica de fora de propósito (internals da lib afogam o relatório). Alchemy entra só em `examples/` (sparse checkout).

Score ignora nits (info). `--fail-on error` num codebase 3.x vai falhar até a migração RC.

| Repo | arquivos | effect | versão | score | erros | avisos | nits | top regras |
| --- | ---: | --- | --- | ---: | ---: | ---: | ---: | --- |
| [effect-examples](https://github.com/Effect-TS/examples) | 78 | sim | ^3.10.14 | 9 | 41 | 92 | 48 | v4-platform-import (23), legacy-default-layer (19), explicit-any (17), default-export (16), v4-effect-service (14), deterministic-service-key (12), array-mutation (9), eslint-disable (8) |
| [effect-days-workshop](https://github.com/Effect-TS/effect-days-2025-workshop) | 92 | sim | ^3.14.8 | 0 | 66 | 139 | 83 | legacy-default-layer (28), deterministic-service-key (26), v4-effect-service (24), v4-context-tag (23), explicit-any (22), v4-schema-tagged-error (15), eslint-disable (15), global-console (11) |
| [effect-discord-bot](https://github.com/Effect-TS/discord-bot) | 34 | sim | catalog: | 53 | 1 | 83 | 63 | non-null-assertion (48), deterministic-service-key (11), giant-gen (11), v4-unstable-import (11), fn-untraced (9), unbounded-concurrency (6), default-export (6), raw-loop (4) |
| [effect-language-service](https://github.com/Effect-TS/language-service) | 803 | sim | — | 0 | 336 | 2886 | 894 | array-mutation (435), raw-loop (375), legacy-default-layer (230), let-mutation (224), max-nesting (193), explicit-any (187), ts-ignore (175), non-null-assertion (170) |
| [effect-vscode](https://github.com/Effect-TS/vscode-extension) | 38 | sim | ^3.17.3 | 0 | 42 | 439 | 68 | object-mutation (89), tag-string-comparison (61), array-mutation (49), let-mutation (39), explicit-any (35), prefer-effect-fn (31), switch-on-tag (26), raw-loop (22) |
| [effect-atom](https://github.com/tim-smart/effect-atom) | 40 | sim | — | 0 | 50 | 967 | 151 | explicit-any (416), object-mutation (145), let-mutation (106), as-any (99), adopt-async-function (74), tag-string-comparison (36), new-promise (34), v4-platform-import (22) |
| [alchemy-examples](https://github.com/alchemy-run/alchemy) | 691 | sim | catalog: | 0 | 23 | 990 | 636 | non-null-assertion (242), v4-unstable-import (217), process-env (154), default-export (119), fail-yieldable (69), schedule-exponential-jitter (63), adopt-await-in-loop (55), instance-of-schema (54) |
| [effect-http](https://github.com/sukovanej/effect-http) | 114 | sim | — | 0 | 243 | 584 | 103 | explicit-any (253), prefer-effect-fn (97), v4-gen-adapter (92), v4-platform-import (86), ts-ignore (53), object-mutation (32), eslint-disable (27), tag-string-comparison (26) |
| [effect-aws](https://github.com/floydspace/effect-aws) | 546 | sim | ^3.16.4 | 0 | 317 | 921 | 689 | adopt-async-function (421), unsafe-assertion (277), explicit-any (182), v4-context-tag (139), deterministic-service-key (131), as-any (130), v4-fiber-ref (129), default-export (86) |
