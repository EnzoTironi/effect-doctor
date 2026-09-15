# AGENTS.md

You are using Effect Doctor, a deterministic CLI for Effect-TS (target: `effect@rc`, currently 4.0.0-rc.115).

## Run

```bash
npx tsx src/cli.ts . --json
npx tsx src/cli.ts . --verbose --fail-on warning
npx tsx src/cli.ts explain v4-catch-all
npx tsx src/cli.ts rules --json
npx effect-ts-doctor@latest . --json
```

No prompts. `-y`, `--dry-run`, and `--no-telemetry` are no-ops. Output language is pt-BR.

## How to fix findings

1. Read `message`, `hint`, `bad`, `good` on each diagnostic.
2. If unsure, run `effect-ts-doctor explain <rule-id>`.
3. Do not invent Effect v3 APIs (`catchAll`, `Context.Tag`, `Option.fromNullable`, `Effect.fork`, `Effect.unit`).
4. Info/nits are real style. Do not ignore them because the score stayed 100.
5. Do not add `eslint-disable`, `@ts-ignore`, or `as any` to silence the doctor.

## JSON

`schemaVersion` is `1`. Each diagnostic has `id` (`rule:file:line:column`), `rule`, `severity`, `category`, `file`, `line`, `column`, `bad`, `good`. Branch on `schemaVersion`. See `docs/json-report.md`.

## Adding a rule

Follow `CONTRIBUTING.md` and `docs/how-to-write-a-rule.md`. Every rule needs `bad` and `good` on the current RC.
