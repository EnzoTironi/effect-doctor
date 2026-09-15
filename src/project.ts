import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { RULE_BY_ID } from "./catalog.js";
import type { Diagnostic } from "./types.js";
import { TARGET_EFFECT_RC } from "./version.js";

export type PackageShape = {
  effect: boolean;
  alchemy: boolean;
  legacyEffect: boolean;
  effectVersion: string | null;
};

export function packageShape(pkg: unknown): PackageShape {
  const deps = depMap(pkg);
  return {
    effect: deps.has("effect"),
    alchemy: deps.has("alchemy"),
    legacyEffect: deps.has("@effect/io") || deps.has("@effect/data") || deps.has("@effect/schema") || deps.has("@effect/match"),
    effectVersion: deps.get("effect") ?? null,
  };
}

function depMap(pkg: unknown): Map<string, string> {
  const names = new Map<string, string>();
  if (!pkg || typeof pkg !== "object") return names;
  const record = pkg as Record<string, unknown>;
  for (const key of ["dependencies", "devDependencies", "peerDependencies"] as const) {
    const block = record[key];
    if (!block || typeof block !== "object") continue;
    for (const [name, version] of Object.entries(block as Record<string, unknown>)) {
      if (typeof version === "string") names.set(name, version);
    }
  }
  return names;
}

export function isEffectRcVersion(version: string | null): boolean {
  if (!version) return false;
  const cleaned = version.replace(/^[^0-9a-zA-Z]+/, "");
  return cleaned.startsWith("4.") || cleaned === "rc" || version.includes("-rc.") || version === "rc";
}

export function analyzePackage(args: {
  shape: PackageShape;
  relFiles: string[];
  importsEffect: boolean;
}): Diagnostic[] {
  const diags: Diagnostic[] = [];
  const file = "package.json";

  if (args.importsEffect && !args.shape.effect) {
    diags.push(projectDiag("effect-doctor/missing-effect-dependency", file));
  }
  if (args.shape.effect && args.shape.legacyEffect) {
    diags.push(projectDiag("effect-doctor/duplicate-effect-package", file));
  }
  if (args.shape.effect && !isEffectRcVersion(args.shape.effectVersion)) {
    diags.push(projectDiag("effect-doctor/not-on-effect-rc", file));
  }
  if (args.shape.alchemy) {
    const hasEntry = args.relFiles.some((rel) => /(?:^|\/)alchemy\.run\.(ts|tsx|mts|js|mjs)$/.test(rel));
    if (!hasEntry) diags.push(projectDiag("effect-doctor/alchemy-missing-entry", file));
  }

  return diags;
}

/**
 * Só alerta se o tsconfig existe e `strict` não está true.
 * Sem tsconfig → sem diagnóstico (não é um projeto TS incompleto por omissão).
 */
export function analyzeTsconfig(pkgDir: string | undefined): Diagnostic[] {
  if (!pkgDir) return [];
  const file = join(pkgDir, "tsconfig.json");
  if (!existsSync(file)) return [];
  const raw = readFileSync(file, "utf8");
  if (/"strict"\s*:\s*true/.test(raw)) return [];
  return [projectDiag("effect-doctor/tsconfig-not-strict", "tsconfig.json")];
}

function projectDiag(ruleId: string, file: string): Diagnostic {
  const rule = RULE_BY_ID.get(ruleId);
  if (!rule) throw new Error(`regra desconhecida: ${ruleId}`);
  return {
    rule: rule.id,
    severity: rule.severity,
    category: rule.category,
    message: rule.message,
    hint: `${rule.hint} (alvo: effect@${TARGET_EFFECT_RC})`,
    bad: rule.bad,
    good: rule.good,
    file,
    line: 1,
    column: 1,
  };
}

export function alchemyEntryFrom(relFiles: string[]): string | null {
  const found = relFiles.find((rel) => basename(rel).startsWith("alchemy.run."));
  return found ?? null;
}
