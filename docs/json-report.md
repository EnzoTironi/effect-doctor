# JSON report

`effect-ts-doctor --json` emite um único objeto em stdout. Consumidores devem ramificar em `schemaVersion`.

## Version 1

| Campo | Significado |
| --- | --- |
| `schemaVersion` | `1` |
| `tool` | `"effect-doctor"` |
| `version` | versão do CLI |
| `targetEffectRc` | RC alvo (ex. `4.0.0-rc.115`) |
| `effectVersion` | `effect` no `package.json` do alvo, ou `null` |
| `score` | 0–100 (nits info não derrubam) |
| `target` | diretório absoluto |
| `filesScanned` | `.ts`/`.tsx` analisados |
| `effectDetected` | import ou dependência `effect` |
| `alchemy` | `{ present, entry, mode: "static" \| "skipped" }` |
| `summary` | `{ errors, warnings, info, diagnostics, rules }` |
| `diagnostics` | lista (pode ser vazia **e** o scan ter sido completo) |

Cada diagnóstico:

- `id` — `rule:file:line:column` (opaco, estável se o achado não muda)
- `rule`, `severity`, `category`, `message`, `hint`
- `bad` / `good` — receita no RC
- `file` relativo ao alvo, `line`, `column` (1-indexed)

Não infira cobertura de um array vazio: use `filesScanned` e `effectDetected`.
