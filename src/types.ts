import type * as ts from "typescript";

export type Severity = "error" | "warning" | "info";

export type Category =
  | "correctness"
  | "anti-pattern"
  | "idiomatic"
  | "v4-migration"
  | "agent-hygiene"
  | "type-safety"
  | "maintainability"
  | "performance"
  | "adoption"
  | "oop"
  | "alchemy"
  | "security"
  | "architecture";

export type Push = (ruleId: string, node: ts.Node) => void;

export type FailOn = "error" | "warning" | "none";

export type Diagnostic = {
  rule: string;
  severity: Severity;
  category: Category;
  message: string;
  hint: string;
  bad: string;
  good: string;
  file: string;
  line: number;
  column: number;
};

export type AlchemyInfo = {
  present: boolean;
  entry: string | null;
  mode: "static" | "skipped";
};

export type ScanResult = {
  target: string;
  filesScanned: number;
  effectDetected: boolean;
  effectVersion: string | null;
  targetEffectRc: string;
  alchemy: AlchemyInfo;
  diagnostics: Diagnostic[];
  score: number;
};

export type CliOptions = {
  target: string;
  verbose: boolean;
  json: boolean;
  scoreOnly: boolean;
  failOn: FailOn;
  categories: Category[] | undefined;
  listRules: boolean;
  explain: string | undefined;
  help: boolean;
  version: boolean;
};
