import * as ts from "typescript";
import {
  inSet,
  isEffectCall,
  isPipeCall,
  isRunMethod,
  isSchemaCall,
  matchCall,
  type ImportNames,
} from "./imports.js";
import type { Push } from "./types.js";

const CAUSE_OLD = new Set([
  "isFailType",
  "isDie",
  "isFailure",
  "isInterrupted",
  "failureOption",
  "dieOption",
  "sequential",
  "parallel",
  "isEmptyType",
  "failures",
  "defects",
  "interruptors",
]);

const MUTATING_ARRAY = new Set(["push", "pop", "splice", "shift", "unshift", "sort", "reverse"]);
const EFFECT_COMBINATORS = new Set([
  "map",
  "flatMap",
  "andThen",
  "tap",
  "tapError",
  "catch",
  "catchAll",
  "filter",
  "filterOrElse",
]);
const FLATMAPISH = new Set(["flatMap", "andThen", "zip", "zipWith"]);
const GENERIC_SPANS = new Set(["run", "fn", "x", "f", "op", "test", "main", "go", "do", "exec"]);
const BANNED_HTTP = new Set(["axios", "got", "ky", "node-fetch", "undici"]);
const BANNED_ZOD = new Set(["zod", "zod/v3", "zod/v4"]);

/**
 * Nits e regras extras (v4 leftover, agent hygiene, adoption, performance).
 * Chamado para cada nó; cada check é estreito e sai cedo.
 */
export function inspectNits(args: {
  node: ts.Node;
  names: ImportNames;
  genDepth: number;
  effectFile: boolean;
  push: Push;
}): void {
  const { node, names, genDepth, effectFile, push } = args;

  inspectImports(node, names, push);
  inspectEffectExtras(node, names, genDepth, push);
  inspectSchemaExtras(node, names, push);
  inspectV4Extras(node, names, push);
  inspectPipeExtras(node, names, push);
  inspectStreamsQueues(node, names, push);
  inspectAgentExtras(node, names, effectFile, genDepth, push);
  inspectOop(node, effectFile, push);
  inspectAdoption(node, effectFile, push);
  inspectClasses(node, push);
}

function inspectImports(node: ts.Node, names: ImportNames, push: Push): void {
  if (!ts.isImportDeclaration(node) || !ts.isStringLiteral(node.moduleSpecifier)) return;
  const spec = node.moduleSpecifier.text;
  if (/^@effect\/(schema|data|match|io|printer)(?:\/|$)/.test(spec)) {
    push("effect-doctor/v4-legacy-effect-import", node);
  }
  if (spec.startsWith("effect/unstable/")) push("effect-doctor/v4-unstable-import", node);
  if (spec === "fp-ts" || spec.startsWith("fp-ts/")) push("effect-doctor/banned-fp-ts", node);
  if (BANNED_ZOD.has(spec) || spec.startsWith("zod/")) push("effect-doctor/banned-zod", node);
  if (BANNED_HTTP.has(spec) || spec.startsWith("axios")) push("effect-doctor/banned-axios", node);
  if (spec === "dotenv" || spec === "dotenv/config") push("effect-doctor/banned-dotenv", node);
  if (spec === "neverthrow" || spec === "ts-results") push("effect-doctor/banned-neverthrow", node);
  if (spec === "node:child_process" || spec === "child_process") push("effect-doctor/node-child-process", node);
  if (
    spec === "node:http" ||
    spec === "node:https" ||
    spec === "http" ||
    spec === "https" ||
    spec === "node:net"
  ) {
    push("effect-doctor/node-http-import", node);
  }
  if ((spec === "node:path" || spec === "path") && names.importsEffect) {
    push("effect-doctor/node-path-import", node);
  }
}

function inspectEffectExtras(
  node: ts.Node,
  names: ImportNames,
  genDepth: number,
  push: Push,
): void {
  if (ts.isVoidExpression(node)) {
    const inner = matchCall(node.expression);
    if (inner && isEffectCall(names, inner.receiver, inner.method) && !isRunMethod(inner.method)) {
      push("effect-doctor/void-effect", node);
    }
  }

  const call = matchCall(node);
  if (!call) {
    inspectYieldSucceed(node, names, genDepth, push);
    return;
  }

  if (isEffectCall(names, call.receiver, call.method)) {
    switch (call.method) {
      case "catchAllDefect":
        push("effect-doctor/v4-catch-all-defect", node);
        break;
      case "catchSomeCause":
        push("effect-doctor/v4-catch-some-cause", node);
        break;
      case "catchSomeDefect":
        push("effect-doctor/v4-catch-some-defect", node);
        break;
      case "forkWithErrorHandler":
        push("effect-doctor/v4-fork-error-handler", node);
        break;
      case "unit":
        push("effect-doctor/v4-effect-unit", node);
        break;
      case "ignore":
        push("effect-doctor/ignore-errors", node);
        break;
      case "promise":
        push("effect-doctor/effect-promise-untyped", node);
        break;
      case "die":
      case "dieMessage":
        push("effect-doctor/die-string", node);
        break;
      case "forEach":
        if (call.call.arguments.length < 3) push("effect-doctor/foreach-missing-concurrency", node);
        break;
      case "retry":
        if (retryLooksBareSchedule(call.call.arguments[0], names)) {
          push("effect-doctor/retry-without-predicate", node);
        }
        break;
      case "race":
        if (call.call.arguments.some((arg) => isSleepCall(arg, names))) {
          push("effect-doctor/timeout-over-race-sleep", node);
        }
        break;
      case "try":
      case "tryPromise":
        inspectTry(call, node, push);
        break;
      case "fn":
        inspectFnSpan(call, node, push);
        inspectGenAdapter(call.call, push);
        if (ts.isCallExpression(node.parent) && node.parent.expression === node) {
          inspectGenAdapter(node.parent, push);
        }
        break;
      case "gen":
        inspectGenAdapter(call.call, push);
        inspectGenSelf(call.call, push);
        break;
      case "fail":
        inspectFailArg(call.call.arguments[0], node, push);
        break;
      case "runSync":
        if (argLooksAsync(call.call.arguments[0], names)) push("effect-doctor/runsync-on-async", node);
        break;
      case "flatMap":
        inspectFlatMap(call, names, node, push);
        break;
      case "sync":
        if (callbackIsLiteral(call.call.arguments[0])) {
          push("effect-doctor/succeed-over-sync-literal", node);
        }
        break;
      default:
        break;
    }

    if (EFFECT_COMBINATORS.has(call.method) && callbackIsAsync(call.call.arguments[1] ?? call.call.arguments[0])) {
      push("effect-doctor/async-callback-in-combinator", node);
    }
    if (call.method === "log" || call.method.startsWith("log")) {
      if (argHasJsonStringify(call.call.arguments[0])) push("effect-doctor/structured-log", node);
    }
  }

  if (inSet(names.option, call.receiver) && /^(getOrThrow|getOrUndefined|getOrNull)$/.test(call.method)) {
    push("effect-doctor/option-get-or-throw", node);
  }
  if (inSet(names.config, call.receiver) && call.method === "secret") {
    push("effect-doctor/v4-config-secret", node);
  }
  if (inSet(names.layer, call.receiver) && call.method === "mergeAll" && call.call.arguments.length >= 8) {
    push("effect-doctor/layer-mergeall-megalist", node);
  }
  if (inSet(names.schedule, call.receiver) && call.method === "exponential") {
    inspectExponential(node, push);
  }
  if (inSet(names.scope, call.receiver) && call.method === "extend") {
    push("effect-doctor/v4-scope-extend", node);
  }
  if (inSet(names.cause, call.receiver) && CAUSE_OLD.has(call.method)) {
    push("effect-doctor/v4-cause-fail-type", node);
  }
  if (inSet(names.http, call.receiver) && call.method === "text" && argHasJsonStringify(call.call.arguments[0])) {
    push("effect-doctor/json-http-response", node);
  }

  inspectYieldSucceed(node, names, genDepth, push);
}

function inspectTry(
  call: { method: string; call: ts.CallExpression },
  node: ts.Node,
  push: Push,
): void {
  const arg0 = call.call.arguments[0];
  if (!arg0) return;
  if (ts.isObjectLiteralExpression(arg0)) {
    const tryFn = propInit(arg0, "try");
    if (tryFn && fetchWithoutSignal(tryFn)) push("effect-doctor/try-promise-abort-signal", node);
    return;
  }
  push("effect-doctor/try-untyped-catch", node);
  if (fetchWithoutSignal(arg0)) push("effect-doctor/try-promise-abort-signal", node);
}

function inspectFnSpan(call: { call: ts.CallExpression }, node: ts.Node, push: Push): void {
  const arg0 = call.call.arguments[0];
  if (arg0 && ts.isStringLiteral(arg0) && GENERIC_SPANS.has(arg0.text)) {
    push("effect-doctor/span-name-generic", node);
  }
}

function inspectGenAdapter(call: ts.CallExpression, push: Push): void {
  for (const arg of call.arguments) {
    if (!(ts.isFunctionExpression(arg) || ts.isArrowFunction(arg))) continue;
    if (arg.parameters.length !== 1) continue;
    const p = arg.parameters[0]!;
    if (!ts.isIdentifier(p.name)) continue;
    if (p.name.text === "_" || p.name.text === "adapter") {
      push("effect-doctor/v4-gen-adapter", arg);
    }
  }
}

function inspectGenSelf(call: ts.CallExpression, push: Push): void {
  const arg0 = call.arguments[0];
  if (arg0 && arg0.kind === ts.SyntaxKind.ThisKeyword) push("effect-doctor/v4-gen-self", arg0);
}

function inspectFailArg(arg: ts.Expression | undefined, node: ts.Node, push: Push): void {
  if (!arg) return;
  if (ts.isNewExpression(arg) && ts.isIdentifier(arg.expression) && arg.expression.text === "Error") {
    push("effect-doctor/fail-native-error", node);
    return;
  }
  if (ts.isNewExpression(arg)) push("effect-doctor/fail-yieldable", node);
}

function inspectFlatMap(
  call: { call: ts.CallExpression },
  names: ImportNames,
  node: ts.Node,
  push: Push,
): void {
  const fn = call.call.arguments[1] ?? call.call.arguments[0];
  if (!fn) return;
  if (callbackIsSucceed(fn, names)) push("effect-doctor/flatmap-to-map", node);
  if (callbackContainsFlatMap(fn, names)) push("effect-doctor/nested-flatmap", node);
}

function inspectYieldSucceed(
  node: ts.Node,
  names: ImportNames,
  genDepth: number,
  push: Push,
): void {
  if (genDepth === 0 || !ts.isYieldExpression(node) || !node.asteriskToken || !node.expression) return;
  const inner = matchCall(node.expression);
  if (!inner || !isEffectCall(names, inner.receiver, inner.method) || inner.method !== "succeed") return;
  const arg = inner.call.arguments[0];
  if (arg && isLiteralish(arg)) push("effect-doctor/yield-succeed-literal", node);
}

function inspectSchemaExtras(node: ts.Node, names: ImportNames, push: Push): void {
  const call = matchCall(node);
  if (!call || !isSchemaCall(names, call.receiver, call.method)) return;
  if (call.method === "Union" && call.call.arguments.length >= 2) {
    push("effect-doctor/v4-schema-union-args", node);
  }
  if ((call.method === "Literal" || call.method === "literal") && call.call.arguments.length >= 2) {
    push("effect-doctor/v4-schema-literals", node);
  }
  if (call.method === "Any") push("effect-doctor/schema-any", node);
  if (call.method === "Struct" && call.call.arguments[0] && ts.isObjectLiteralExpression(call.call.arguments[0])) {
    if (hasTagLiteralField(call.call.arguments[0])) push("effect-doctor/v4-schema-tagged-struct", node);
  }
  if (call.method === "Union" && call.call.arguments.length === 1 && unionOfLiterals(call.call.arguments[0], names)) {
    push("effect-doctor/schema-union-of-literals", node);
  }
}

function inspectV4Extras(node: ts.Node, names: ImportNames, push: Push): void {
  if (
    ts.isPropertyAccessExpression(node) &&
    ts.isIdentifier(node.expression) &&
    names.effect.has(node.expression.text) &&
    node.name.text === "unit"
  ) {
    push("effect-doctor/v4-effect-unit", node);
  }
  if (ts.isIdentifier(node) && (node.text === "FiberRefs" || node.text === "Differ") && names.importsEffect) {
    const parent = node.parent;
    if (ts.isPropertyAccessExpression(parent) || ts.isCallExpression(parent) || ts.isImportSpecifier(parent)) {
      push("effect-doctor/v4-fiber-refs-differ", node);
    }
  }
  if (
    ts.isVariableDeclaration(node) &&
    node.initializer &&
    ts.isIdentifier(node.name)
  ) {
    const inner = matchCall(node.initializer);
    if (inner && inSet(names.context, inner.receiver) && inner.method === "Service") {
      push("effect-doctor/service-not-class", node);
    }
  }
}

function inspectPipeExtras(node: ts.Node, names: ImportNames, push: Push): void {
  if (!ts.isCallExpression(node) || !isPipeCall(node)) return;
  const methods: string[] = [];
  for (const arg of node.arguments) {
    const inner = matchCall(arg);
    if (inner && (isEffectCall(names, inner.receiver, inner.method) || inner.receiver === undefined)) {
      methods.push(inner.method);
    }
  }
  for (let i = 0; i < methods.length - 1; i++) {
    if (methods[i] === "map" && methods[i + 1] === "flatten") push("effect-doctor/map-flatten", node);
  }
  const flatHits = methods.filter((m) => FLATMAPISH.has(m)).length;
  if (flatHits >= 4) push("effect-doctor/long-combinator-chain", node);

  for (const arg of node.arguments) {
    const inner = matchCall(arg);
    if (!inner) continue;
    if ((inner.method === "catch" || inner.method === "catchAll") && catchIsAlwaysFail(inner.call.arguments[0])) {
      push("effect-doctor/catch-to-map-error", arg);
    }
  }
}

function inspectStreamsQueues(node: ts.Node, names: ImportNames, push: Push): void {
  const call = matchCall(node);
  if (!call) return;
  if (inSet(names.stream, call.receiver) && call.method === "mapEffect" && call.call.arguments.length === 1) {
    push("effect-doctor/stream-mapeffect-concurrency", node);
  }
  if (inSet(names.stream, call.receiver) && call.method === "fromChunk") {
    const arg = call.call.arguments[0];
    const inner = arg ? matchCall(arg) : undefined;
    if (inner && inSet(names.chunk, inner.receiver) && inner.method === "fromIterable") {
      push("effect-doctor/stream-eager-chunk", node);
    }
  }
  if (inSet(names.stream, call.receiver) && call.method === "runCollect" && ancestorHasForever(node, names)) {
    push("effect-doctor/stream-runcollect-infinite", node);
  }
  if (inSet(names.queue, call.receiver) && call.method === "unbounded") {
    push("effect-doctor/queue-unbounded", node);
  }
  if (inSet(names.pubsub, call.receiver) && call.method === "unbounded") {
    push("effect-doctor/pubsub-unbounded", node);
  }
}

function inspectAgentExtras(
  node: ts.Node,
  names: ImportNames,
  effectFile: boolean,
  genDepth: number,
  push: Push,
): void {
  if (ts.isForOfStatement(node) && node.awaitModifier) push("effect-doctor/for-await-of", node);
  if (genDepth > 0 && ts.isForOfStatement(node) && !node.awaitModifier && hasYieldStar(node.statement)) {
    push("effect-doctor/foreach-over-yield-loop", node);
  }
  if (isLoop(node) && hasAwait(node)) push("effect-doctor/adopt-await-in-loop", node);

  if (ts.isVariableDeclarationList(node) && (node.flags & ts.NodeFlags.Let) === 0 && (node.flags & ts.NodeFlags.Const) === 0) {
    push("effect-doctor/var-keyword", node);
  }

  if (
    ts.isBinaryExpression(node) &&
    (node.operatorToken.kind === ts.SyntaxKind.EqualsEqualsToken ||
      node.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsToken)
  ) {
    push("effect-doctor/loose-equality", node);
  }

  if (ts.isEnumDeclaration(node)) push("effect-doctor/typescript-enum", node);

  if (ts.isAsExpression(node) && node.type.kind === ts.SyntaxKind.AnyKeyword) {
    push("effect-doctor/as-any", node);
  }
  if (ts.isAsExpression(node) && node.type.kind === ts.SyntaxKind.NeverKeyword) {
    push("effect-doctor/as-any", node);
  }

  if (ts.isDebuggerStatement(node)) push("effect-doctor/debugger-statement", node);
  if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "eval") {
    push("effect-doctor/debugger-statement", node);
  }

  if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "require") {
    push("effect-doctor/require-commonjs", node);
  }
  if (
    ts.isPropertyAccessExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === "module" &&
    node.name.text === "exports"
  ) {
    push("effect-doctor/require-commonjs", node);
  }

  if (
    ts.isPropertyAccessExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === "process" &&
    node.name.text === "exit"
  ) {
    push("effect-doctor/process-exit", node);
  }

  if (ts.isSwitchStatement(node) && isTagAccess(node.expression)) {
    push("effect-doctor/switch-on-tag", node);
  }

  if (
    effectFile &&
    ts.isPropertyAccessExpression(node) &&
    (node.name.text === "kind" || node.name.text === "type") &&
    ts.isBinaryExpression(node.parent) &&
    node.parent.left === node &&
    (node.parent.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken ||
      node.parent.operatorToken.kind === ts.SyntaxKind.EqualsEqualsToken) &&
    ts.isStringLiteral(node.parent.right)
  ) {
    push("effect-doctor/string-kind-guard", node.parent);
  }

  if (effectFile && ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
    const method = node.expression.name.text;
    if (MUTATING_ARRAY.has(method)) push("effect-doctor/array-mutation", node);
    if (method === "includes" && node.arguments[0] && isObjectOrArrayLiteral(node.arguments[0])) {
      push("effect-doctor/object-literal-includes", node);
    }
    if (method === "forEach") {
      const recv = node.expression.expression;
      if (
        ts.isIdentifier(recv) &&
        !names.effect.has(recv.text) &&
        !names.stream.has(recv.text)
      ) {
        push("effect-doctor/adopt-array-foreach", node);
      }
    }
  }

  if (effectFile) inspectMutation(node, push);

  if (ts.isBlock(node)) inspectForkJoin(node, push);

  if (
    ts.isCallExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === "it" &&
    node.arguments.length >= 2 &&
    callbackHasRunPromise(node.arguments[1])
  ) {
    push("effect-doctor/it-effect", node);
  }

  if (ts.isTaggedTemplateExpression(node) && ts.isIdentifier(node.tag) && node.tag.text === "sql") {
    const text = node.template.getText().toUpperCase();
    if (/\bBEGIN\b|\bCOMMIT\b|\bROLLBACK\b/.test(text)) push("effect-doctor/sql-manual-transaction", node);
  }

  if (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    node.expression.name.text === "stringify" &&
    ts.isIdentifier(node.expression.expression) &&
    node.expression.expression.text === "JSON"
  ) {
    push("effect-doctor/json-stringify", node);
  }

  if (ts.isObjectLiteralExpression(node) && ts.isCallExpression(node.parent)) {
    const concurrency = propInit(node, "concurrency");
    if (concurrency && ts.isStringLiteral(concurrency) && concurrency.text === "unbounded") {
      push("effect-doctor/unbounded-concurrency", concurrency);
    }
  }
}

function inspectMutation(node: ts.Node, push: Push): void {
  if (ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) {
    if (
      node.operator === ts.SyntaxKind.PlusPlusToken ||
      node.operator === ts.SyntaxKind.MinusMinusToken
    ) {
      push("effect-doctor/object-mutation", node);
    }
  }
  if (ts.isDeleteExpression(node)) push("effect-doctor/object-mutation", node);
  if (
    ts.isBinaryExpression(node) &&
    node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
    (ts.isPropertyAccessExpression(node.left) || ts.isElementAccessExpression(node.left))
  ) {
    push("effect-doctor/object-mutation", node);
  }
}

function inspectOop(node: ts.Node, effectFile: boolean, push: Push): void {
  if (ts.isMethodDeclaration(node) && node.name && ts.isIdentifier(node.name) && node.name.text === "getInstance") {
    push("effect-doctor/singleton-get-instance", node);
  }
  if (!effectFile) return;
  if (ts.isNewExpression(node) && ts.isIdentifier(node.expression)) {
    if (node.expression.text === "Map" || node.expression.text === "Set") {
      push("effect-doctor/new-map-set", node);
    }
    if (node.expression.text === "EventEmitter") push("effect-doctor/event-emitter", node);
  }
  if (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    (node.expression.name.text === "on" || node.expression.name.text === "once")
  ) {
    const recv = node.expression.expression;
    if (ts.isIdentifier(recv) && /emit|emitter|ee|bus|hub/i.test(recv.text)) {
      push("effect-doctor/event-emitter", node);
    }
  }
}

function inspectAdoption(node: ts.Node, effectFile: boolean, push: Push): void {
  if (!effectFile) return;
  if (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node) || ts.isMethodDeclaration(node)) {
    if (node.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword) && !node.asteriskToken) {
      push("effect-doctor/adopt-async-function", node);
    }
  }
  if (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    node.expression.name.text === "then"
  ) {
    push("effect-doctor/adopt-promise-then", node);
  }
  if (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    ts.isIdentifier(node.expression.expression) &&
    node.expression.expression.text === "Promise" &&
    (node.expression.name.text === "resolve" || node.expression.name.text === "reject")
  ) {
    push("effect-doctor/promise-resolve", node);
  }
}

function inspectClasses(node: ts.Node, push: Push): void {
  if (!ts.isClassDeclaration(node) || !node.name) return;
  const selfName = node.name.text;
  for (const h of node.heritageClauses ?? []) {
    for (const t of h.types) {
      inspectHeritageCalls(t.expression, selfName, push);
    }
  }
  const schemaHeritage = (node.heritageClauses ?? []).some((h) =>
    h.types.some((t) => heritageMentions(t.expression, ["Class", "TaggedClass", "TaggedError", "TaggedErrorClass"])),
  );
  if (schemaHeritage) {
    for (const member of node.members) {
      if (ts.isConstructorDeclaration(member)) push("effect-doctor/schema-constructor-override", member);
    }
  }
}

function inspectHeritageCalls(expr: ts.Expression, selfName: string, push: Push): void {
  const stringArgs: ts.StringLiteral[] = [];
  const methods: string[] = [];
  const selfMethods = new Set([
    "Service",
    "Tag",
    "GenericTag",
    "Class",
    "TaggedClass",
    "TaggedError",
    "TaggedErrorClass",
  ]);
  let cur: ts.Expression = expr;
  while (ts.isCallExpression(cur)) {
    for (const arg of cur.arguments) {
      if (ts.isStringLiteral(arg)) stringArgs.push(arg);
    }
    if (ts.isPropertyAccessExpression(cur.expression)) {
      const method = cur.expression.name.text;
      methods.push(method);
      const typeArg = cur.typeArguments?.[0];
      if (
        selfMethods.has(method) &&
        typeArg &&
        ts.isTypeReferenceNode(typeArg) &&
        ts.isIdentifier(typeArg.typeName) &&
        typeArg.typeName.text !== selfName
      ) {
        push("effect-doctor/schema-class-self-mismatch", typeArg);
      }
    }
    cur = cur.expression;
  }
  const method = methods[0];
  if (
    method &&
    ["Service", "Tag", "GenericTag"].includes(method) &&
    stringArgs[0] &&
    stringArgs[0].text !== selfName
  ) {
    push("effect-doctor/deterministic-service-key", stringArgs[0]);
  }
  if (
    method &&
    ["TaggedError", "TaggedErrorClass", "TaggedClass"].includes(method) &&
    stringArgs.length >= 2 &&
    stringArgs[0]!.text === stringArgs[1]!.text
  ) {
    push("effect-doctor/schema-redundant-tag-id", stringArgs[1]!);
  }
}

export function inspectInstanceOf(node: ts.Node, names: ImportNames, push: Push): void {
  if (!ts.isBinaryExpression(node) || node.operatorToken.kind !== ts.SyntaxKind.InstanceOfKeyword) return;
  if (!ts.isIdentifier(node.right)) return;
  if (node.right.text === "Error") return;
  if (names.importsEffect) push("effect-doctor/instance-of-schema", node);
}

function inspectExponential(node: ts.Node, push: Push): void {
  let text = "";
  let cur: ts.Node | undefined = node;
  for (let i = 0; i < 5 && cur; i++) {
    text += cur.getText();
    cur = cur.parent;
  }
  if (!text.includes("jittered")) push("effect-doctor/schedule-exponential-jitter", node);
  if (!text.includes("spaced") && !text.includes("either")) push("effect-doctor/schedule-exponential-cap", node);
}

function inspectForkJoin(block: ts.Block, push: Push): void {
  const stmts = [...block.statements];
  for (let i = 0; i < stmts.length - 1; i++) {
    const forkName = forkedIdent(stmts[i]!);
    const joinName = joinedIdent(stmts[i + 1]!);
    if (forkName && joinName && forkName === joinName) push("effect-doctor/fork-then-join", stmts[i]!);
  }
}

function forkedIdent(stmt: ts.Statement): string | undefined {
  if (!ts.isVariableStatement(stmt)) return undefined;
  const decl = stmt.declarationList.declarations[0];
  if (!decl || !ts.isIdentifier(decl.name) || !decl.initializer) return undefined;
  const yieldExpr = unwrapYield(decl.initializer);
  const call = yieldExpr ? matchCall(yieldExpr) : matchCall(decl.initializer);
  if (!call) return undefined;
  if (call.method === "fork" || call.method === "forkChild" || call.method === "forkDaemon" || call.method === "forkDetach") {
    return decl.name.text;
  }
  return undefined;
}

function joinedIdent(stmt: ts.Statement): string | undefined {
  const expr = ts.isVariableStatement(stmt)
    ? stmt.declarationList.declarations[0]?.initializer
    : ts.isExpressionStatement(stmt)
      ? stmt.expression
      : undefined;
  if (!expr) return undefined;
  const inner = unwrapYield(expr) ?? expr;
  const call = matchCall(inner);
  if (!call || call.method !== "join") return undefined;
  const arg = call.call.arguments[0];
  return arg && ts.isIdentifier(arg) ? arg.text : undefined;
}

function unwrapYield(expr: ts.Expression): ts.Expression | undefined {
  return ts.isYieldExpression(expr) ? expr.expression : undefined;
}

function heritageMentions(expr: ts.Expression, methods: string[]): boolean {
  let cur: ts.Expression = expr;
  while (ts.isCallExpression(cur)) {
    if (ts.isPropertyAccessExpression(cur.expression) && methods.includes(cur.expression.name.text)) {
      return true;
    }
    cur = cur.expression;
  }
  return ts.isPropertyAccessExpression(cur) && methods.includes(cur.name.text);
}

function isSleepCall(expr: ts.Expression, names: ImportNames): boolean {
  const call = matchCall(expr);
  return Boolean(call && isEffectCall(names, call.receiver, call.method) && call.method === "sleep");
}

function retryLooksBareSchedule(arg: ts.Expression | undefined, names: ImportNames): boolean {
  if (!arg) return false;
  if (ts.isObjectLiteralExpression(arg)) return false;
  const call = matchCall(arg);
  if (call && inSet(names.schedule, call.receiver)) return true;
  return Boolean(call && call.method === "exponential");
}

function argLooksAsync(arg: ts.Expression | undefined, names: ImportNames): boolean {
  if (!arg) return false;
  let found = false;
  const visit = (n: ts.Node): void => {
    const call = matchCall(n);
    if (call && isEffectCall(names, call.receiver, call.method) && (call.method === "promise" || call.method === "sleep" || call.method === "async" || call.method === "tryPromise")) {
      found = true;
    }
    ts.forEachChild(n, visit);
  };
  visit(arg);
  return found;
}

function callbackIsAsync(fn: ts.Expression | undefined): boolean {
  return Boolean(
    fn &&
      (ts.isArrowFunction(fn) || ts.isFunctionExpression(fn)) &&
      fn.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword),
  );
}

function callbackIsLiteral(fn: ts.Expression | undefined): boolean {
  if (!fn || !(ts.isArrowFunction(fn) || ts.isFunctionExpression(fn))) return false;
  const body = fn.body;
  const expr = ts.isBlock(body)
    ? body.statements.length === 1 && ts.isReturnStatement(body.statements[0]!)
      ? body.statements[0].expression
      : undefined
    : body;
  return Boolean(expr && isLiteralish(expr));
}

function isLiteralish(expr: ts.Expression): boolean {
  return (
    ts.isNumericLiteral(expr) ||
    ts.isStringLiteral(expr) ||
    expr.kind === ts.SyntaxKind.TrueKeyword ||
    expr.kind === ts.SyntaxKind.FalseKeyword ||
    expr.kind === ts.SyntaxKind.NullKeyword
  );
}

function callbackIsSucceed(fn: ts.Expression, names: ImportNames): boolean {
  const expr = callbackExpr(fn);
  if (!expr) return false;
  const call = matchCall(expr);
  return Boolean(call && isEffectCall(names, call.receiver, call.method) && call.method === "succeed");
}

function callbackContainsFlatMap(fn: ts.Expression, names: ImportNames): boolean {
  let found = false;
  const visit = (n: ts.Node): void => {
    const call = matchCall(n);
    if (call && isEffectCall(names, call.receiver, call.method) && call.method === "flatMap") found = true;
    ts.forEachChild(n, visit);
  };
  visit(fn);
  return found;
}

function catchIsAlwaysFail(fn: ts.Expression | undefined): boolean {
  const expr = fn ? callbackExpr(fn) : undefined;
  if (!expr) return false;
  const call = matchCall(expr);
  return Boolean(call && call.method === "fail");
}

function callbackExpr(fn: ts.Expression): ts.Expression | undefined {
  if (!(ts.isArrowFunction(fn) || ts.isFunctionExpression(fn))) return undefined;
  const body = fn.body;
  return ts.isBlock(body)
    ? body.statements.length === 1 && ts.isReturnStatement(body.statements[0]!)
      ? body.statements[0].expression
      : undefined
    : body;
}

function fetchWithoutSignal(fn: ts.Expression): boolean {
  if (!(ts.isArrowFunction(fn) || ts.isFunctionExpression(fn))) return false;
  const hasSignalParam = fn.parameters.some((p) => ts.isIdentifier(p.name) && p.name.text === "signal");
  if (hasSignalParam) return false;
  let hasFetch = false;
  const visit = (n: ts.Node): void => {
    const call = matchCall(n);
    if (call && !call.receiver && call.method === "fetch") hasFetch = true;
    ts.forEachChild(n, visit);
  };
  visit(fn);
  return hasFetch;
}

function argHasJsonStringify(expr: ts.Expression | undefined): boolean {
  if (!expr) return false;
  let found = false;
  const visit = (n: ts.Node): void => {
    const call = matchCall(n);
    if (call && call.receiver === "JSON" && call.method === "stringify") found = true;
    ts.forEachChild(n, visit);
  };
  visit(expr);
  return found;
}

function propInit(obj: ts.ObjectLiteralExpression, name: string): ts.Expression | undefined {
  for (const p of obj.properties) {
    if (ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === name) return p.initializer;
  }
  return undefined;
}

function hasTagLiteralField(obj: ts.ObjectLiteralExpression): boolean {
  return obj.properties.some(
    (p) => ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === "_tag",
  );
}

function unionOfLiterals(arg: ts.Expression, names: ImportNames): boolean {
  if (!ts.isArrayLiteralExpression(arg)) return false;
  if (arg.elements.length < 2) return false;
  return arg.elements.every((el) => {
    const call = matchCall(el);
    return Boolean(call && isSchemaCall(names, call.receiver, call.method) && call.method === "Literal");
  });
}

function ancestorHasForever(node: ts.Node, names: ImportNames): boolean {
  let cur: ts.Node | undefined = node;
  while (cur) {
    const call = matchCall(cur);
    if (call && inSet(names.stream, call.receiver) && call.method === "forever") return true;
    if (ts.isCallExpression(cur) && isPipeCall(cur)) {
      if (cur.arguments.some((a) => {
        const inner = matchCall(a);
        return Boolean(inner && inSet(names.stream, inner.receiver) && inner.method === "forever");
      })) {
        return true;
      }
      const recv = ts.isPropertyAccessExpression(cur.expression) ? cur.expression.expression : undefined;
      if (recv && ancestorHasForeverCall(recv, names)) return true;
    }
    cur = cur.parent;
  }
  return false;
}

function ancestorHasForeverCall(expr: ts.Expression, names: ImportNames): boolean {
  let cur: ts.Node | undefined = expr;
  while (cur) {
    const call = matchCall(cur);
    if (call && inSet(names.stream, call.receiver) && call.method === "forever") return true;
    cur = ts.isCallExpression(cur) || ts.isPropertyAccessExpression(cur) ? (cur as ts.CallExpression | ts.PropertyAccessExpression).expression : undefined;
  }
  return false;
}

function isLoop(node: ts.Node): boolean {
  return (
    ts.isForStatement(node) ||
    ts.isForOfStatement(node) ||
    ts.isForInStatement(node) ||
    ts.isWhileStatement(node) ||
    ts.isDoStatement(node)
  );
}

function hasAwait(node: ts.Node): boolean {
  let found = false;
  const visit = (n: ts.Node): void => {
    if (n !== node && isLoop(n)) return;
    if (n.kind === ts.SyntaxKind.AwaitKeyword || ts.isAwaitExpression(n)) found = true;
    ts.forEachChild(n, visit);
  };
  visit(node);
  return found;
}

function hasYieldStar(node: ts.Node): boolean {
  let found = false;
  const visit = (n: ts.Node): void => {
    if (ts.isYieldExpression(n) && n.asteriskToken) found = true;
    ts.forEachChild(n, visit);
  };
  visit(node);
  return found;
}

function isTagAccess(expr: ts.Expression): boolean {
  return ts.isPropertyAccessExpression(expr) && expr.name.text === "_tag";
}

function isObjectOrArrayLiteral(expr: ts.Expression): boolean {
  return ts.isObjectLiteralExpression(expr) || ts.isArrayLiteralExpression(expr);
}

function callbackHasRunPromise(fn: ts.Expression): boolean {
  let found = false;
  const visit = (n: ts.Node): void => {
    const call = matchCall(n);
    if (call && isRunMethod(call.method)) found = true;
    ts.forEachChild(n, visit);
  };
  visit(fn);
  return found;
}
