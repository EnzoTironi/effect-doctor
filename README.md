# Effect Doctor

[![ci](https://img.shields.io/github/actions/workflow/status/EnzoTironi/effect-doctor/ci.yml?style=flat&colorA=000000&colorB=000000)](https://github.com/EnzoTironi/effect-doctor/actions)
[![npm](https://img.shields.io/npm/v/effect-ts-doctor?style=flat&colorA=000000&colorB=000000)](https://www.npmjs.com/package/effect-ts-doctor)
[![license](https://img.shields.io/badge/license-Modified%20MIT-black)](./LICENSE)

**Your agent writes bad Effect. This catches it.**

CLI que audita um codebase **Effect-TS** no **RC mais recente** (`effect@4.0.0-rc.115`, `npm install effect@rc`). Analog de produto do [react-doctor](https://github.com/millionco/react-doctor): scan determinístico, diagnósticos com arquivo/linha, pontuação 0–100, receita **ruim → bom** em cada regra.

Repositório: [github.com/EnzoTironi/effect-doctor](https://github.com/EnzoTironi/effect-doctor).

O pacote no npm é **`effect-ts-doctor`**. O nome `effect-doctor` já está publicado por outro autor ([JGalbss/effect-doctor](https://github.com/JGalbss/effect-doctor)). Os ids das regras continuam `effect-doctor/<regra>`.

## Install

### 1. Quick start

Na raiz do seu projeto Effect:

```bash
npx tsx src/cli.ts .
```

Depois do publish:

```bash
npx effect-ts-doctor@latest
```

```bash
npm install effect@rc
npx effect-ts-doctor . --verbose --fail-on warning
```

Sem prompt. `-y` é no-op.

### 2. Agentes

```bash
npx effect-ts-doctor . --json
npx effect-ts-doctor explain v4-catch-all
npx effect-ts-doctor rules --json
```

`explain` cola o rewrite do RC. Não invente API v3. Ver [AGENTS.md](./AGENTS.md).

Há **177 regras** (correção, anti-padrão, idioma, v4, higiene de agente, tipos, performance, adoption, Alchemy estático). Relatório JSON: [docs/json-report.md](./docs/json-report.md).

### 3. CI

O workflow [`.github/workflows/effect-doctor.yml`](./.github/workflows/effect-doctor.yml) dogfooda o CLI do próprio PR. Num projeto consumidor, depois do publish:

```yaml
- run: npx effect-ts-doctor@latest . --fail-on error --json
```

## Flags

| Flag | Função |
| --- | --- |
| `--verbose` | arquivo/linha + ruim/bom |
| `--json` | relatório JSON (`schemaVersion: 1`) |
| `--score` | só 0–100 (nits não derrubam) |
| `--fail-on error\|warning\|none` | exit 1 |
| `--category v4-migration,idiomatic` | filtra |
| `rules` / `--list-rules` | catálogo |
| `explain <id>` | receita |
| `-y` / `--dry-run` / `--no-telemetry` | no-op |

## Telemetry

O CLI **não coleta telemetria**. Não envia crashes, stacks, nem contagem de regras. `--no-telemetry` existe só para compatibilidade com o padrão do react-doctor e é no-op.

## Desenvolvimento

```bash
npm install
npm test
npm run typecheck
npx tsx src/cli.ts fixtures/good --fail-on warning
npm run corpus
```

Corpus público (clona repos Effect e roda o doctor): [docs/public-repos.md](./docs/public-repos.md). Como contribuir: [CONTRIBUTING.md](./CONTRIBUTING.md).

## Licença

Modified MIT — igual à ideia do react-doctor: uso livre, **exceto** treinar modelo/IA e oferecer o software como SaaS/API paga sem permissão. Texto completo em [LICENSE](./LICENSE).

## Segurança

[SECURITY.md](./SECURITY.md). O CLI só lê o disco local.
