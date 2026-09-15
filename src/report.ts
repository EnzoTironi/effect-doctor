import { findRule, RULES } from "./catalog.js";
import type { Diagnostic, ScanResult, Severity } from "./types.js";
import { CLI_BIN, TARGET_EFFECT_RC, VERSION, JSON_SCHEMA_VERSION } from "./version.js";

const SEVERITY_LABEL: Record<Severity, string> = {
  error: "Erros",
  warning: "Avisos",
  info: "Nits",
};

export function formatReport(result: ScanResult, verbose: boolean): string {
  const lines: string[] = [];
  lines.push(`Effect Doctor ${VERSION}  ·  alvo effect@${result.targetEffectRc}`);
  lines.push(`Alvo: ${result.target} (${result.filesScanned} arquivos)`);
  if (result.effectVersion) lines.push(`effect no package.json: ${result.effectVersion}`);
  lines.push("");
  lines.push(`Pontuação  ${result.score}/100`);
  lines.push("");

  if (!result.effectDetected) {
    lines.push("Effect não detectado neste alvo.");
    lines.push("");
  }
  if (result.alchemy.present) {
    const entry = result.alchemy.entry ?? "(sem alchemy.run.ts)";
    lines.push(`Alchemy  ${entry} — checks estáticos; nenhum deploy.`);
    lines.push("");
  }

  const bySeverity = groupSeverity(result.diagnostics);
  for (const severity of ["error", "warning", "info"] as const) {
    const items = bySeverity[severity];
    if (items.length === 0) continue;
    lines.push(`━━ ${SEVERITY_LABEL[severity]} (${items.length})`);
    const grouped = groupByRule(items);
    for (const [rule, diags] of grouped) {
      const first = diags[0]!;
      lines.push(rule);
      lines.push(`  ${first.message}`);
      lines.push(`  padrão: ${first.good.split("\n")[0]}`);
      if (verbose) {
        lines.push(`  ruim: ${first.bad.split("\n")[0]}`);
        lines.push(`  ${first.hint}`);
      }
      const shown = verbose ? diags : diags.slice(0, 3);
      for (const d of shown) {
        lines.push(`  ${d.file}:${d.line}:${d.column}`);
      }
      if (!verbose && diags.length > 3) {
        lines.push(`  … e mais ${diags.length - 3} (use --verbose)`);
      }
      lines.push(`  receita: ${CLI_BIN} explain ${rule.replace("effect-doctor/", "")}`);
      lines.push("");
    }
  }

  if (result.diagnostics.length === 0) {
    lines.push(`Nenhum diagnóstico. Código alinhado ao Effect RC ${TARGET_EFFECT_RC} neste recorte.`);
    lines.push("");
  }

  const { errors, warnings, info } = counts(result.diagnostics);
  lines.push(
    `${result.filesScanned} arquivos · ${result.diagnostics.length} diagnósticos · ${errors} erros · ${warnings} avisos · ${info} nits`,
  );
  return lines.join("\n");
}

export function formatJson(result: ScanResult): string {
  return `${JSON.stringify(
    {
      tool: "effect-doctor",
      schemaVersion: JSON_SCHEMA_VERSION,
      version: VERSION,
      targetEffectRc: result.targetEffectRc,
      effectVersion: result.effectVersion,
      score: result.score,
      target: result.target,
      filesScanned: result.filesScanned,
      effectDetected: result.effectDetected,
      alchemy: result.alchemy,
      summary: {
        ...counts(result.diagnostics),
        diagnostics: result.diagnostics.length,
        rules: new Set(result.diagnostics.map((d) => d.rule)).size,
      },
      diagnostics: result.diagnostics.map((d) => ({
        id: `${d.rule}:${d.file}:${d.line}:${d.column}`,
        ...d,
      })),
    },
    null,
    2,
  )}\n`;
}

export function formatRules(json: boolean): string {
  if (json) return `${JSON.stringify(RULES, null, 2)}\n`;
  const lines = [`Regras Effect Doctor (${TARGET_EFFECT_RC})`, ""];
  for (const rule of RULES) {
    lines.push(`${rule.id}  [${rule.severity} / ${rule.category}]`);
    lines.push(`  ${rule.message}`);
    lines.push(`  ruim: ${rule.bad.split("\n")[0]}`);
    lines.push(`  bom:  ${rule.good.split("\n")[0]}`);
  }
  lines.push("");
  lines.push(`Total: ${RULES.length}  ·  ${CLI_BIN} explain <id>`);
  return lines.join("\n");
}

export function formatExplain(query: string): string | undefined {
  const rule = findRule(query);
  if (!rule) return undefined;
  return [
    rule.id,
    `[${rule.severity} / ${rule.category}]`,
    "",
    rule.message,
    "",
    `Por quê / o que fazer: ${rule.hint}`,
    "",
    "Ruim (agente, não faça):",
    rule.bad,
    "",
    `Bom (Effect ${TARGET_EFFECT_RC}):`,
    rule.good,
    "",
  ].join("\n");
}

export function counts(diagnostics: Diagnostic[]): {
  errors: number;
  warnings: number;
  info: number;
} {
  let errors = 0;
  let warnings = 0;
  let info = 0;
  for (const d of diagnostics) {
    switch (d.severity) {
      case "error":
        errors += 1;
        break;
      case "warning":
        warnings += 1;
        break;
      case "info":
        info += 1;
        break;
      default: {
        const _exhaustive: never = d.severity;
        return _exhaustive;
      }
    }
  }
  return { errors, warnings, info };
}

function groupSeverity(diagnostics: Diagnostic[]): Record<Severity, Diagnostic[]> {
  const out: Record<Severity, Diagnostic[]> = { error: [], warning: [], info: [] };
  for (const d of diagnostics) out[d.severity].push(d);
  return out;
}

function groupByRule(diagnostics: Diagnostic[]): Array<[string, Diagnostic[]]> {
  const map = new Map<string, Diagnostic[]>();
  for (const d of diagnostics) {
    const list = map.get(d.rule) ?? [];
    list.push(d);
    map.set(d.rule, list);
  }
  return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
}
