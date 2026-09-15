import * as ts from "typescript";

export type ImportNames = {
  effect: Set<string>;
  effectFns: Set<string>;
  schema: Set<string>;
  schemaFns: Set<string>;
  alchemy: Set<string>;
  alchemyFns: Set<string>;
  context: Set<string>;
  layer: Set<string>;
  option: Set<string>;
  config: Set<string>;
  match: Set<string>;
  stream: Set<string>;
  queue: Set<string>;
  schedule: Set<string>;
  cause: Set<string>;
  scope: Set<string>;
  fiber: Set<string>;
  either: Set<string>;
  data: Set<string>;
  chunk: Set<string>;
  pubsub: Set<string>;
  http: Set<string>;
  importsEffect: boolean;
  importsAlchemy: boolean;
};

const EFFECT_ROOT = /^effect(?:\/|$)/;
const ALCHEMY_ROOT = /^alchemy(?:\/|$)/;

const NS_SUFFIX: Array<[RegExp, keyof ImportNames]> = [
  [/\/Schema$/i, "schema"],
  [/\/Context$/, "context"],
  [/\/Layer$/, "layer"],
  [/\/Option$/, "option"],
  [/\/Config$/, "config"],
  [/\/Match$/, "match"],
  [/\/Stream$/, "stream"],
  [/\/Queue$/, "queue"],
  [/\/Schedule$/, "schedule"],
  [/\/Cause$/, "cause"],
  [/\/Scope$/, "scope"],
  [/\/Fiber$/, "fiber"],
  [/\/Either$/, "either"],
  [/\/Data$/, "data"],
  [/\/Chunk$/, "chunk"],
  [/\/PubSub$/, "pubsub"],
];

export function collectImports(sourceFile: ts.SourceFile): ImportNames {
  const names: ImportNames = {
    effect: new Set(),
    effectFns: new Set(),
    schema: new Set(),
    schemaFns: new Set(),
    alchemy: new Set(),
    alchemyFns: new Set(),
    context: new Set(),
    layer: new Set(),
    option: new Set(),
    config: new Set(),
    match: new Set(),
    stream: new Set(),
    queue: new Set(),
    schedule: new Set(),
    cause: new Set(),
    scope: new Set(),
    fiber: new Set(),
    either: new Set(),
    data: new Set(),
    chunk: new Set(),
    pubsub: new Set(),
    http: new Set(),
    importsEffect: false,
    importsAlchemy: false,
  };

  for (const stmt of sourceFile.statements) {
    if (!ts.isImportDeclaration(stmt) || !stmt.importClause) continue;
    if (!ts.isStringLiteral(stmt.moduleSpecifier)) continue;
    const spec = stmt.moduleSpecifier.text;
    const clause = stmt.importClause;

    if (EFFECT_ROOT.test(spec)) {
      names.importsEffect = true;
      bindNamespace(names, clause, spec);
    }

    if (ALCHEMY_ROOT.test(spec)) {
      names.importsAlchemy = true;
      if (clause.name) names.alchemy.add(clause.name.text);
      if (clause.namedBindings && ts.isNamespaceImport(clause.namedBindings)) {
        names.alchemy.add(clause.namedBindings.name.text);
      }
      if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
        for (const el of clause.namedBindings.elements) names.alchemyFns.add(el.name.text);
      }
    }
  }

  return names;
}

function bindNamespace(names: ImportNames, clause: ts.ImportClause, spec: string): void {
  let ns: keyof ImportNames | undefined;
  for (const [re, key] of NS_SUFFIX) {
    if (re.test(spec)) {
      ns = key;
      break;
    }
  }
  if (spec.includes("unstable/http")) ns = "http";

  if (clause.name) names.effect.add(clause.name.text);
  if (clause.namedBindings && ts.isNamespaceImport(clause.namedBindings)) {
    const local = clause.namedBindings.name.text;
    if (ns && ns !== "effectFns" && ns !== "schemaFns" && ns !== "alchemyFns" && ns !== "importsEffect" && ns !== "importsAlchemy") {
      (names[ns] as Set<string>).add(local);
    } else {
      names.effect.add(local);
    }
  }
  if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
    for (const el of clause.namedBindings.elements) {
      const imported = (el.propertyName ?? el.name).text;
      const local = el.name.text;
      bindNamed(names, imported, local, ns);
    }
  }
}

function bindNamed(names: ImportNames, imported: string, local: string, ns: keyof ImportNames | undefined): void {
  switch (imported) {
    case "Effect":
      names.effect.add(local);
      return;
    case "Schema":
      names.schema.add(local);
      return;
    case "Context":
      names.context.add(local);
      return;
    case "Layer":
      names.layer.add(local);
      return;
    case "Option":
      names.option.add(local);
      return;
    case "Config":
      names.config.add(local);
      return;
    case "Match":
      names.match.add(local);
      return;
    case "Stream":
      names.stream.add(local);
      return;
    case "Queue":
      names.queue.add(local);
      return;
    case "Schedule":
      names.schedule.add(local);
      return;
    case "Cause":
      names.cause.add(local);
      return;
    case "Scope":
      names.scope.add(local);
      return;
    case "Fiber":
      names.fiber.add(local);
      return;
    case "Either":
      names.either.add(local);
      return;
    case "Data":
      names.data.add(local);
      return;
    case "Chunk":
      names.chunk.add(local);
      return;
    case "PubSub":
      names.pubsub.add(local);
      return;
    case "HttpClient":
    case "HttpServerResponse":
    case "HttpServer":
      names.http.add(local);
      return;
    default: {
      if (ns === "schema") names.schemaFns.add(local);
      else names.effectFns.add(local);
    }
  }
}

export function matchCall(
  node: ts.Node,
): { receiver: string | undefined; method: string; call: ts.CallExpression } | undefined {
  if (!ts.isCallExpression(node)) return undefined;
  const expr = node.expression;
  if (ts.isPropertyAccessExpression(expr) && ts.isIdentifier(expr.expression)) {
    return { receiver: expr.expression.text, method: expr.name.text, call: node };
  }
  if (ts.isIdentifier(expr)) {
    return { receiver: undefined, method: expr.text, call: node };
  }
  return undefined;
}

const RUN_METHODS = new Set([
  "runPromise",
  "runSync",
  "runFork",
  "runCallback",
  "runPromiseExit",
  "runSyncExit",
  "runPromiseHalt",
  "runSyncHalt",
]);

const GEN_METHODS = new Set(["gen", "fn", "fnUntraced"]);

const SCHEMA_SYNC = new Set([
  "decodeUnknownSync",
  "decodeSync",
  "encodeUnknownSync",
  "encodeSync",
  "validateSync",
  "validateUnknownSync",
  "assertSync",
  "parseJsonSync",
]);

export function isRunMethod(method: string): boolean {
  return RUN_METHODS.has(method);
}

export function isGenMethod(method: string): boolean {
  return GEN_METHODS.has(method);
}

export function isSchemaSyncMethod(method: string): boolean {
  return SCHEMA_SYNC.has(method);
}

export function isEffectCall(names: ImportNames, receiver: string | undefined, method: string): boolean {
  if (receiver) return names.effect.has(receiver);
  return names.effectFns.has(method);
}

export function isSchemaCall(names: ImportNames, receiver: string | undefined, method: string): boolean {
  if (receiver) return names.schema.has(receiver);
  return names.schemaFns.has(method);
}

export function isAlchemyCall(names: ImportNames, receiver: string | undefined, method: string): boolean {
  if (receiver) return names.alchemy.has(receiver);
  return names.alchemyFns.has(method);
}

export function inSet(set: Set<string>, receiver: string | undefined): boolean {
  return Boolean(receiver && set.has(receiver));
}

export function isAlchemyEntryFile(fileName: string): boolean {
  return /(?:^|\/)alchemy\.run\.(ts|tsx|mts|js|mjs)$/.test(fileName.replaceAll("\\", "/"));
}

export function isPipeCall(node: ts.CallExpression): boolean {
  if (ts.isIdentifier(node.expression) && node.expression.text === "pipe") return true;
  return ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === "pipe";
}
