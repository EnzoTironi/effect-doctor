import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { parseArgs } from "../src/args.js";
import { RULES } from "../src/catalog.js";
import { scanProject } from "../src/scan.js";
import { TARGET_EFFECT_RC } from "../src/version.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const tsx = join(root, "node_modules/.bin/tsx");
const cli = join(root, "src/cli.ts");

function doctor(args: string[]) {
  return spawnSync(tsx, [cli, ...args], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
  });
}

describe("scan fixtures", () => {
  it("marca anti-padrões e leftovers v3 no fixture ruim", () => {
    const result = scanProject(join(root, "fixtures/bad"));
    const rules = new Set(result.diagnostics.map((d) => d.rule));
    for (const rule of [
      "effect-doctor/floating-effect",
      "effect-doctor/run-inside-effect",
      "effect-doctor/missing-yield-star",
      "effect-doctor/try-catch-in-gen",
      "effect-doctor/schema-sync-in-effect",
      "effect-doctor/return-effect-in-gen",
      "effect-doctor/promise-all",
      "effect-doctor/new-promise",
      "effect-doctor/lazy-promise-in-sync",
      "effect-doctor/multiple-provide",
      "effect-doctor/process-env",
      "effect-doctor/json-parse",
      "effect-doctor/global-console",
      "effect-doctor/global-fetch",
      "effect-doctor/hardcoded-secret",
      "effect-doctor/duplicate-effect-package",
      "effect-doctor/not-on-effect-rc",
      "effect-doctor/alchemy-missing-stack",
      "effect-doctor/alchemy-missing-providers",
      "effect-doctor/alchemy-secret-in-source",
      "effect-doctor/giant-gen",
      "effect-doctor/string-fail",
      "effect-doctor/unsafe-assertion",
      "effect-doctor/v4-catch-all",
      "effect-doctor/v4-fork",
      "effect-doctor/v4-option-from-nullable",
      "effect-doctor/v4-context-tag",
      "effect-doctor/v4-platform-import",
      "effect-doctor/let-mutation",
      "effect-doctor/v4-gen-adapter",
      "effect-doctor/v4-effect-unit",
      "effect-doctor/void-effect",
      "effect-doctor/banned-zod",
      "effect-doctor/tsconfig-not-strict",
      "effect-doctor/schema-class-self-mismatch",
      "effect-doctor/loose-equality",
      "effect-doctor/array-mutation",
      "effect-doctor/switch-on-tag",
      "effect-doctor/try-untyped-catch",
      "effect-doctor/v4-schema-literals",
    ]) {
      assert.ok(rules.has(rule), `faltou ${rule}`);
    }
    assert.ok(result.effectDetected);
    assert.equal(result.targetEffectRc, TARGET_EFFECT_RC);
    assert.ok(result.diagnostics.some((d) => d.severity === "error"));
    assert.ok(result.diagnostics.every((d) => d.bad.length > 0 && d.good.length > 0));
  });

  it("avisa Alchemy sem alchemy.run.ts", () => {
    const result = scanProject(join(root, "fixtures/alchemy-orphan"));
    assert.ok(result.diagnostics.some((d) => d.rule === "effect-doctor/alchemy-missing-entry"));
  });

  it("o fixture RC bom não tem erros nem avisos", () => {
    const result = scanProject(join(root, "fixtures/good"));
    const blocking = result.diagnostics.filter((d) => d.severity === "error" || d.severity === "warning");
    assert.deepEqual(
      blocking,
      [],
      blocking.map((d) => `${d.rule} ${d.file}:${d.line} ${d.message}`).join("\n"),
    );
    assert.equal(result.score, 100);
    assert.equal(result.effectVersion, TARGET_EFFECT_RC);
  });
});

describe("cli", () => {
  it("parseArgs aceita flags de agente", () => {
    const opts = parseArgs(["./apps/api", "--json", "--fail-on", "error", "-y"]);
    assert.ok(!("error" in opts));
    if ("error" in opts) return;
    assert.equal(opts.target, "./apps/api");
    assert.equal(opts.json, true);
    assert.equal(opts.failOn, "error");
  });

  it("--help inclui Examples e o RC", () => {
    assert.ok(existsSync(tsx), "rode npm install antes dos testes");
    const out = doctor(["--help"]);
    assert.equal(out.status, 0, out.stderr);
    assert.match(out.stdout, /Examples:/);
    assert.match(out.stdout, /effect@rc/);
    assert.match(out.stdout, /explain/);
  });

  it("diretório ausente sai 2 com exemplo", () => {
    const out = doctor(["./nao-existe-mesmo"]);
    assert.equal(out.status, 2);
    assert.match(out.stderr, /não encontrado/i);
  });

  it("--json emite score, RC e receitas", () => {
    const out = doctor(["fixtures/bad", "--json"]);
    assert.equal(out.status, 0, out.stderr);
    const report = JSON.parse(out.stdout) as {
      schemaVersion: number;
      score: number;
      targetEffectRc: string;
      diagnostics: Array<{ bad: string; good: string; id: string }>;
    };
    assert.equal(report.schemaVersion, 1);
    assert.equal(report.targetEffectRc, TARGET_EFFECT_RC);
    assert.ok(report.diagnostics.length > 0);
    assert.ok(report.diagnostics[0]?.good);
    assert.ok(report.diagnostics[0]?.id);
  });

  it("--fail-on error sai 1 no fixture ruim", () => {
    const out = doctor(["fixtures/bad", "--fail-on", "error", "--score"]);
    assert.equal(out.status, 1, out.stderr);
  });

  it("--fail-on error sai 0 no fixture bom", () => {
    const out = doctor(["fixtures/good", "--fail-on", "error"]);
    assert.equal(out.status, 0, out.stderr);
  });

  it("explain devolve ruim e bom do RC", () => {
    const out = doctor(["explain", "v4-catch-all"]);
    assert.equal(out.status, 0, out.stderr);
    assert.match(out.stdout, /Effect.catchAll/);
    assert.match(out.stdout, /Effect.catch/);
  });

  it("rules lista dezenas de ids", () => {
    const out = doctor(["--list-rules"]);
    assert.equal(out.status, 0, out.stderr);
    assert.ok(RULES.length >= 150, `catálogo curto demais: ${RULES.length}`);
    assert.match(out.stdout, /effect-doctor\/v4-fork/);
    assert.match(out.stdout, /effect-doctor\/missing-yield-star/);
  });
});
