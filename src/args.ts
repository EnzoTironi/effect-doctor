import { CATEGORIES, isKnownCategory, RULES } from "./catalog.js";
import type { Category, CliOptions } from "./types.js";
import { CLI_BIN, TARGET_EFFECT_RC, VERSION } from "./version.js";

export const HELP = `Effect Doctor ${VERSION} — auditoria Effect-TS para o RC ${TARGET_EFFECT_RC}.

Uso:
  ${CLI_BIN} [diretório] [opções]
  ${CLI_BIN} explain <regra>
  ${CLI_BIN} rules

Opções:
  -h, --help              mostra esta ajuda
  -v, --version           versão
  --verbose               lista todos os arquivos/linhas por regra
  --json                  um único relatório JSON (stdout)
  --score                 imprime só a pontuação 0–100
  --fail-on <nível>       error | warning | none (padrão: none)
  --category <lista>      filtra categorias (vírgula)
  --list-rules, rules     lista as regras e o padrão ruim→bom
  explain <regra>         receita completa para o agente
  -y, --yes               no-op (nunca há prompt)
  --no-telemetry          no-op
  --dry-run               no-op (scan nunca escreve)

Categorias: ${CATEGORIES.join(", ")}

Alvo: npm install effect@rc  (${TARGET_EFFECT_RC})
Catálogo: ${RULES.length} regras. Nits (info) sempre ligam — agentes precisam do padrão, não de um score bonito.
Score 0–100 ignora nits; --fail-on warning pega aviso+erro.

Examples:
  ${CLI_BIN}
  ${CLI_BIN} ./apps/api --verbose
  ${CLI_BIN} . --json
  ${CLI_BIN} . --fail-on error
  ${CLI_BIN} . --category v4-migration,idiomatic
  ${CLI_BIN} explain missing-yield-star
  ${CLI_BIN} explain effect-doctor/v4-catch-all
  ${CLI_BIN} rules --json
`;

export function parseArgs(argv: string[]): CliOptions | { error: string; example: string } {
  const opts: CliOptions = {
    target: ".",
    verbose: false,
    json: false,
    scoreOnly: false,
    failOn: "none",
    categories: undefined,
    listRules: false,
    explain: undefined,
    help: false,
    version: false,
  };
  const categories: Category[] = [];
  const positionals: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    switch (arg) {
      case "-h":
      case "--help":
        opts.help = true;
        break;
      case "-v":
      case "--version":
        opts.version = true;
        break;
      case "--verbose":
        opts.verbose = true;
        break;
      case "--json":
        opts.json = true;
        break;
      case "--score":
        opts.scoreOnly = true;
        break;
      case "--list-rules":
      case "rules":
        opts.listRules = true;
        break;
      case "explain":
      case "--explain": {
        const value = argv[++i];
        if (!value || value.startsWith("-")) {
          return {
            error: "Erro: explain precisa do id da regra.",
            example: `  ${CLI_BIN} explain missing-yield-star`,
          };
        }
        opts.explain = value;
        break;
      }
      case "-y":
      case "--yes":
      case "--no-telemetry":
      case "--dry-run":
        break;
      case "--fail-on": {
        const value = argv[++i];
        if (value !== "error" && value !== "warning" && value !== "none") {
          return {
            error: "Erro: --fail-on precisa ser error, warning ou none.",
            example: `  ${CLI_BIN} . --fail-on error`,
          };
        }
        opts.failOn = value;
        break;
      }
      case "--category": {
        const value = argv[++i];
        if (!value || value.startsWith("-")) {
          return {
            error: "Erro: --category precisa de uma lista.",
            example: `  ${CLI_BIN} . --category v4-migration,idiomatic`,
          };
        }
        for (const raw of value.split(",")) {
          const item = raw.trim();
          if (!isKnownCategory(item)) {
            return {
              error: `Erro: categoria desconhecida "${item}".`,
              example: `  ${CLI_BIN} . --category ${CATEGORIES.join(",")}`,
            };
          }
          categories.push(item);
        }
        break;
      }
      default:
        if (arg.startsWith("-")) {
          return {
            error: `Erro: flag desconhecida ${arg}.`,
            example: `  ${CLI_BIN} --help`,
          };
        }
        positionals.push(arg);
    }
  }

  if (positionals.length > 1) {
    return {
      error: "Erro: passe um único diretório.",
      example: `  ${CLI_BIN} ./apps/api`,
    };
  }
  if (positionals[0]) opts.target = positionals[0];
  if (categories.length > 0) opts.categories = categories;
  return opts;
}
