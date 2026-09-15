import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import * as ts from "typescript";
import { collectImports } from "./imports.js";
import { alchemyEntryFrom, analyzePackage, analyzeTsconfig, packageShape } from "./project.js";
import type { Diagnostic, ScanResult } from "./types.js";
import { CLI_BIN, TARGET_EFFECT_RC } from "./version.js";
import { analyzeSourceFile, sourceKindFor } from "./visit.js";
import { collectFiles, findPackageJson, readJsonFile } from "./walk.js";

export class ScanError extends Error {
  readonly example: string;
  constructor(message: string, example: string) {
    super(message);
    this.name = "ScanError";
    this.example = example;
  }
}

export function scanProject(target: string): ScanResult {
  const abs = resolve(target);
  if (!existsSync(abs)) {
    throw new ScanError(
      `Diretório não encontrado: ${target}`,
      `  ${CLI_BIN} ./caminho/do/projeto`,
    );
  }
  const st = statSync(abs);
  if (!st.isDirectory()) {
    throw new ScanError(`Alvo não é um diretório: ${target}`, `  ${CLI_BIN} .`);
  }

  const files = collectFiles(abs);
  const relFiles = files.map((file) => relative(abs, file) || file);
  const pkgPath = findPackageJson(abs);
  const pkg = pkgPath ? readJsonFile(pkgPath) : undefined;
  const shape = packageShape(pkg);

  let importsEffect = false;
  const diagnostics: Diagnostic[] = [];

  for (let i = 0; i < files.length; i++) {
    const absFile = files[i]!;
    const relPath = relFiles[i]!;
    const text = readFileSync(absFile, "utf8");
    const sourceFile = ts.createSourceFile(
      absFile,
      text,
      ts.ScriptTarget.Latest,
      true,
      sourceKindFor(absFile),
    );
    const names = collectImports(sourceFile);
    if (names.importsEffect) importsEffect = true;
    diagnostics.push(...analyzeSourceFile(relPath, sourceFile));
  }

  diagnostics.push(...analyzePackage({ shape, relFiles, importsEffect }));
  diagnostics.push(...analyzeTsconfig(pkgPath ? dirname(pkgPath) : undefined));

  const effectDetected = shape.effect || importsEffect;
  const entry = alchemyEntryFrom(relFiles);
  const alchemyPresent =
    shape.alchemy || entry !== null || diagnostics.some((d) => d.category === "alchemy");

  return {
    target: abs,
    filesScanned: files.length,
    effectDetected,
    effectVersion: shape.effectVersion,
    targetEffectRc: TARGET_EFFECT_RC,
    alchemy: {
      present: alchemyPresent,
      entry,
      mode: alchemyPresent ? "static" : "skipped",
    },
    diagnostics,
    score: scoreOf(diagnostics),
  };
}

/**
 * Score 0–100 por regra distinta. Info/nit não derruba a nota (aparece no relatório).
 */
export function scoreOf(diagnostics: Diagnostic[]): number {
  const seen = new Set<string>();
  let score = 100;
  for (const d of diagnostics) {
    if (seen.has(d.rule)) continue;
    seen.add(d.rule);
    switch (d.severity) {
      case "error":
        score -= 8;
        break;
      case "warning":
        score -= 3;
        break;
      case "info":
        break;
      default: {
        const _exhaustive: never = d.severity;
        return _exhaustive;
      }
    }
  }
  return Math.max(0, Math.min(100, score));
}

export function filterByCategory(
  diagnostics: Diagnostic[],
  categories: readonly string[] | undefined,
): Diagnostic[] {
  if (!categories || categories.length === 0) return diagnostics;
  const allowed = new Set(categories);
  return diagnostics.filter((d) => allowed.has(d.category));
}
