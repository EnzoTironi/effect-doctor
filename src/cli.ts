#!/usr/bin/env node
import { HELP, parseArgs } from "./args.js";
import { formatExplain, formatJson, formatReport, formatRules } from "./report.js";
import { filterByCategory, ScanError, scanProject, scoreOf } from "./scan.js";
import type { FailOn } from "./types.js";
import { CLI_BIN, VERSION } from "./version.js";

function main(argv: string[]): number {
  const parsed = parseArgs(argv);
  if ("error" in parsed) {
    process.stderr.write(`${parsed.error}\n${parsed.example}\n`);
    return 2;
  }
  const opts = parsed;
  if (opts.help) {
    process.stdout.write(`${HELP}\n`);
    return 0;
  }
  if (opts.version) {
    process.stdout.write(`${VERSION}\n`);
    return 0;
  }
  if (opts.explain) {
    const text = formatExplain(opts.explain);
    if (!text) {
      process.stderr.write(
        `Erro: regra desconhecida "${opts.explain}".\n  ${CLI_BIN} rules\n  ${CLI_BIN} explain missing-yield-star\n`,
      );
      return 2;
    }
    process.stdout.write(`${text}\n`);
    return 0;
  }
  if (opts.listRules) {
    process.stdout.write(formatRules(opts.json));
    return 0;
  }

  let result;
  try {
    result = scanProject(opts.target);
  } catch (err) {
    if (err instanceof ScanError) {
      process.stderr.write(`Erro: ${err.message}\n${err.example}\n`);
      return 2;
    }
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Erro: falha inesperada no scan.\n  ${message}\n`);
    return 2;
  }

  const diagnostics = filterByCategory(result.diagnostics, opts.categories);
  result = {
    ...result,
    diagnostics,
    score: opts.categories ? scoreOf(diagnostics) : result.score,
  };

  if (opts.json) {
    process.stdout.write(formatJson(result));
  } else if (opts.scoreOnly) {
    process.stdout.write(`${result.score}\n`);
  } else {
    process.stdout.write(`${formatReport(result, opts.verbose)}\n`);
  }

  return failExit(
    opts.failOn,
    result.diagnostics.map((d) => d.severity),
  );
}

function failExit(failOn: FailOn, severities: Array<"error" | "warning" | "info">): number {
  switch (failOn) {
    case "none":
      return 0;
    case "error":
      return severities.includes("error") ? 1 : 0;
    case "warning":
      return severities.includes("error") || severities.includes("warning") ? 1 : 0;
    default: {
      const _exhaustive: never = failOn;
      return _exhaustive;
    }
  }
}

process.exit(main(process.argv.slice(2)));
