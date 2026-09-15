import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CORPUS,
  corpusDir,
  formatCorpusMarkdown,
  runCorpus,
} from "../scripts/scan-public-repos.ts";

describe("formatCorpusMarkdown", () => {
  it("renderiza sucesso e falha", () => {
    const md = formatCorpusMarkdown(
      [
        {
          id: "effect-examples",
          url: "https://github.com/Effect-TS/examples.git",
          ok: true,
          detail: "10ms",
          filesScanned: 12,
          effectDetected: true,
          effectVersion: "4.0.0-rc.115",
          score: 91,
          errors: 0,
          warnings: 3,
          info: 8,
          topRules: [{ rule: "not-on-effect-rc", n: 2 }],
        },
        {
          id: "missing",
          url: "https://example.invalid/missing.git",
          ok: false,
          detail: "clone falhou",
        },
      ],
      "2026-09-15T00:00:00.000Z",
    );
    assert.match(md, /effect-examples/);
    assert.match(md, /91/);
    assert.match(md, /clone falhou/);
    assert.match(md, /1 com Effect detectado/);
    assert.match(md, /Como ler/);
    assert.match(md, /https:\/\/github.com\/Effect-TS\/examples/);
  });
});

const enabled = process.env.EFFECT_DOCTOR_PUBLIC_REPOS === "1";

describe("corpus público", { skip: !enabled }, () => {
  it("clona e escaneia pelo menos um repo Effect", () => {
    const rows = runCorpus(CORPUS, corpusDir());
    const ok = rows.filter((r) => r.ok && r.effectDetected);
    assert.ok(ok.length >= 1, rows.map((r) => `${r.id}: ${r.ok ? "ok" : r.detail}`).join("\n"));
  });
});
