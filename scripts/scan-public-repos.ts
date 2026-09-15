import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { counts } from "../src/report.js";
import { scanProject } from "../src/scan.js";
import { TARGET_EFFECT_RC } from "../src/version.js";

export type CorpusRepo = {
  id: string;
  url: string;
  /** Subpasta dentro do clone; default = raiz. */
  path?: string;
  /** Sparse checkout (cone) — evita baixar monorepos enormes inteiros. */
  sparse?: readonly string[];
};

/**
 * Apps, examples e libs de ecossistema — não o monorepo `Effect-TS/effect`
 * (internals da lib afogam o relatório em nits).
 */
export const CORPUS: readonly CorpusRepo[] = [
  { id: "effect-examples", url: "https://github.com/Effect-TS/examples.git" },
  { id: "effect-days-workshop", url: "https://github.com/Effect-TS/effect-days-2025-workshop.git" },
  { id: "effect-discord-bot", url: "https://github.com/Effect-TS/discord-bot.git" },
  { id: "effect-language-service", url: "https://github.com/Effect-TS/language-service.git" },
  { id: "effect-vscode", url: "https://github.com/Effect-TS/vscode-extension.git" },
  { id: "effect-atom", url: "https://github.com/tim-smart/effect-atom.git" },
  {
    id: "alchemy-examples",
    url: "https://github.com/alchemy-run/alchemy.git",
    sparse: ["examples"],
    path: "examples",
  },
  { id: "effect-http", url: "https://github.com/sukovanej/effect-http.git" },
  { id: "effect-aws", url: "https://github.com/floydspace/effect-aws.git" },
];

const CLONE_TIMEOUT_MS = 180_000;

export function corpusDir(): string {
  return process.env.EFFECT_DOCTOR_CORPUS ?? join("/tmp", "effect-doctor-corpus");
}

function git(
  args: string[],
  cwd?: string,
): { status: number | null; stdout: string; stderr: string; error?: Error } {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    timeout: CLONE_TIMEOUT_MS,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  });
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    error: result.error,
  };
}

export function cloneRepo(repo: CorpusRepo, dest: string): { ok: boolean; detail: string } {
  if (existsSync(join(dest, ".git"))) return { ok: true, detail: "já clonado" };
  mkdirSync(dirname(dest), { recursive: true });
  const cloneArgs = ["clone", "--depth", "1", "--single-branch"];
  if (repo.sparse && repo.sparse.length > 0) {
    cloneArgs.push("--filter=blob:none", "--sparse");
  }
  cloneArgs.push(repo.url, dest);
  const cloned = git(cloneArgs);
  if (cloned.status !== 0) {
    const detail = (cloned.error?.message || cloned.stderr || cloned.stdout || "clone falhou")
      .trim()
      .slice(0, 400);
    return { ok: false, detail };
  }
  if (repo.sparse && repo.sparse.length > 0) {
    const sparse = git(["sparse-checkout", "set", "--cone", ...repo.sparse], dest);
    if (sparse.status !== 0) {
      const detail = (sparse.stderr || sparse.stdout || "sparse-checkout falhou").trim().slice(0, 400);
      return { ok: false, detail };
    }
  }
  return { ok: true, detail: "clonado" };
}

export type CorpusScan = {
  id: string;
  url: string;
  ok: boolean;
  detail: string;
  filesScanned?: number;
  effectDetected?: boolean;
  effectVersion?: string | null;
  score?: number;
  errors?: number;
  warnings?: number;
  info?: number;
  topRules?: Array<{ rule: string; n: number }>;
};

export function scanCorpusRepo(repo: CorpusRepo, root: string): CorpusScan {
  const dest = join(root, repo.id);
  const cloned = cloneRepo(repo, dest);
  if (!cloned.ok) return { id: repo.id, url: repo.url, ok: false, detail: cloned.detail };

  const target = repo.path ? join(dest, repo.path) : dest;
  if (!existsSync(target)) {
    return { id: repo.id, url: repo.url, ok: false, detail: `path ausente: ${repo.path}` };
  }

  const started = Date.now();
  try {
    const result = scanProject(target);
    const { errors, warnings, info } = counts(result.diagnostics);
    const ruleCounts = new Map<string, number>();
    for (const d of result.diagnostics) {
      ruleCounts.set(d.rule, (ruleCounts.get(d.rule) ?? 0) + 1);
    }
    const topRules = [...ruleCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([rule, n]) => ({ rule: rule.replace("effect-doctor/", ""), n }));
    return {
      id: repo.id,
      url: repo.url,
      ok: true,
      detail: `${Date.now() - started}ms`,
      filesScanned: result.filesScanned,
      effectDetected: result.effectDetected,
      effectVersion: result.effectVersion,
      score: result.score,
      errors,
      warnings,
      info,
      topRules,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { id: repo.id, url: repo.url, ok: false, detail: message };
  }
}

export function runCorpus(repos: readonly CorpusRepo[] = CORPUS, root = corpusDir()): CorpusScan[] {
  const unique = repos.filter((repo, i, all) => all.findIndex((r) => r.id === repo.id) === i);
  mkdirSync(root, { recursive: true });
  return unique.map((repo) => {
    process.stderr.write(`corpus: ${repo.id}\n`);
    return scanCorpusRepo(repo, root);
  });
}

function repoHref(url: string): string {
  return url.replace(/\.git$/, "");
}

export function formatCorpusMarkdown(rows: CorpusScan[], generatedAt = new Date().toISOString()): string {
  const ok = rows.filter((r) => r.ok);
  const withEffect = ok.filter((r) => r.effectDetected);
  const lines = [
    "# Corpus público",
    "",
    "Scan do Effect Doctor contra repositórios Effect reais (clone `--depth 1`). Não é CI obrigatória: `npm run corpus`.",
    "",
    `Gerado em ${generatedAt}. ${ok.length}/${rows.length} clonar+scan OK, ${withEffect.length} com Effect detectado.`,
    "",
    "## Como ler",
    "",
    `O alvo do doctor é \`effect@${TARGET_EFFECT_RC}\`. Repos ainda em Effect 3 disparam de propósito regras \`v4-*\`, \`legacy-default-layer\` e \`v4-context-tag\`. Isso valida o detector; não é um ranking de qualidade do repositório.`,
    "",
    "O monorepo `Effect-TS/effect` fica de fora de propósito (internals da lib afogam o relatório). Alchemy entra só em `examples/` (sparse checkout).",
    "",
    "Score ignora nits (info). `--fail-on error` num codebase 3.x vai falhar até a migração RC.",
    "",
    "| Repo | arquivos | effect | versão | score | erros | avisos | nits | top regras |",
    "| --- | ---: | --- | --- | ---: | ---: | ---: | ---: | --- |",
  ];
  for (const row of rows) {
    const name = `[${row.id}](${repoHref(row.url)})`;
    if (!row.ok) {
      lines.push(
        `| ${name} | — | falhou | — | — | — | — | — | ${row.detail.replaceAll("|", "/")} |`,
      );
      continue;
    }
    const top = (row.topRules ?? []).map((t) => `${t.rule} (${t.n})`).join(", ");
    lines.push(
      `| ${name} | ${row.filesScanned} | ${row.effectDetected ? "sim" : "não"} | ${row.effectVersion ?? "—"} | ${row.score} | ${row.errors} | ${row.warnings} | ${row.info} | ${top} |`,
    );
  }
  lines.push("");
  return lines.join("\n");
}

const invoked = process.argv[1] ? resolve(process.argv[1]) : "";
const isMain = invoked.length > 0 && fileURLToPath(import.meta.url) === invoked;
if (isMain) {
  const rows = runCorpus();
  const md = formatCorpusMarkdown(rows);
  const out = join(dirname(fileURLToPath(import.meta.url)), "..", "docs", "public-repos.md");
  writeFileSync(out, md);
  process.stdout.write(md);
  const failed = rows.filter((r) => !r.ok);
  const detected = rows.filter((r) => r.ok && r.effectDetected);
  if (failed.length === rows.length || detected.length === 0) process.exit(1);
}
