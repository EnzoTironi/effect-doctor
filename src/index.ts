export { scanProject, ScanError, scoreOf, filterByCategory } from "./scan.js";
export { RULES, RULE_BY_ID, CATEGORIES, findRule } from "./catalog.js";
export { VERSION, TARGET_EFFECT_RC, JSON_SCHEMA_VERSION, PACKAGE_NAME, CLI_BIN } from "./version.js";
export type {
  Category,
  Diagnostic,
  FailOn,
  ScanResult,
  Severity,
} from "./types.js";
