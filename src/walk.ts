import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join } from "node:path";

const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  "coverage",
  ".git",
  ".next",
  "build",
  "out",
  ".turbo",
  ".alchemy",
  ".pnpm",
  ".cache",
  "vendor",
  "tmp",
  "corpus",
  ".output",
  ".svelte-kit",
  ".vercel",
]);

const SOURCE_EXT = new Set([".ts", ".tsx", ".mts", ".cts"]);

/**
 * Lista arquivos TypeScript sob `root`, ignorando build artifacts.
 */
export function collectFiles(root: string): string[] {
  const out: string[] = [];
  walk(root, out);
  return out;
}

function walk(dir: string, out: string[]): void {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name) || entry.name.startsWith(".")) continue;
      walk(path, out);
      continue;
    }
    if (!entry.isFile()) continue;
    const ext = extname(entry.name);
    if (!SOURCE_EXT.has(ext) || entry.name.endsWith(".d.ts")) continue;
    try {
      if (statSync(path).size > 1_000_000) continue;
    } catch {
      continue;
    }
    out.push(path);
  }
}

/**
 * Sobe diretórios até achar package.json.
 */
export function findPackageJson(start: string): string | undefined {
  let dir = start;
  for (;;) {
    const candidate = join(dir, "package.json");
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

export function readJsonFile(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8")) as unknown;
}
