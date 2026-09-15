import * as ts from "typescript";
import {
  isAlchemyEntryFile,
  isEffectCall,
  isGenMethod,
  isRunMethod,
  isSchemaCall,
  isSchemaSyncMethod,
  matchCall,
  type ImportNames,
} from "./imports.js";
import { inspectInstanceOf, inspectNits } from "./nits.js";
import type { Push } from "./types.js";

export type { Push };

const SECRET_NAME = /secret|token|password|apikey|api_key|credential|private_key|auth/i;
const SECRET_VALUE =
  /^(sk_live_|sk_test_|ghp_|github_pat_|cf_|AKIA)[A-Za-z0-9_\-]{8,}$/i;
const CONFIG_SECRET = /token|secret|password|key|credential|auth/i;
const V3_PLATFORM = /^@effect\/(platform|rpc|cluster)(?:\/|$)/;

export function inspectNode(args: {
  node: ts.Node;
  names: ImportNames;
  genDepth: number;
  nesting: number;
  relPath: string;
  sourceFile: ts.SourceFile;
  push: Push;
}): void {
  const { node, names, genDepth, nesting, relPath, sourceFile, push } = args;
  const effectFile = names.importsEffect || genDepth > 0;

  if (genDepth > 0 && ts.isTryStatement(node)) {
    if (node.catchClause) push("effect-doctor/try-catch-in-gen", node);
    if (node.finallyBlock) push("effect-doctor/try-finally-in-gen", node);
  }
  if (genDepth > 0 && ts.isThrowStatement(node)) push("effect-doctor/throw-in-effect", node);
  if (genDepth > 0 && ts.isYieldExpression(node) && !node.asteriskToken && node.expression) {
    push("effect-doctor/missing-yield-star", node);
  }
  if (genDepth > 0 && ts.isYieldExpression(node) && node.asteriskToken && node.expression) {
    const inner = matchCall(node.expression);
    if (inner && isEffectCall(names, inner.receiver, inner.method) && inner.method === "gen") {
      push("effect-doctor/nested-gen-yield", node);
    }
  }
  if (genDepth > 0 && ts.isReturnStatement(node) && node.expression) {
    const inner = matchCall(node.expression);
    if (inner && isEffectCall(names, inner.receiver, inner.method) && !isRunMethod(inner.method)) {
      push("effect-doctor/return-effect-in-gen", node);
    }
  }

  inspectCalls(node, names, genDepth, effectFile, push);
  inspectGlobals(node, genDepth, effectFile, push);
  inspectSecrets(node, isAlchemyEntryFile(relPath) || names.importsAlchemy, push);
  inspectTypes(node, push);
  inspectAgent(node, effectFile, relPath, nesting, push);
  inspectV4(node, names, push);
  inspectNits({ node, names, genDepth, effectFile, push });
  inspectInstanceOf(node, names, push);
  inspectComments(node, sourceFile, push);
}

export function inspectFile(args: { sourceFile: ts.SourceFile; push: Push }): void {
  const lines = args.sourceFile.getLineAndCharacterOfPosition(args.sourceFile.end).line + 1;
  if (lines >= 650) args.push("effect-doctor/file-too-long", args.sourceFile);
  const head = args.sourceFile.getFullText().slice(0, 400);
  if (/@ts-nocheck/.test(head)) args.push("effect-doctor/ts-nocheck", args.sourceFile);
}

function inspectCalls(
  node: ts.Node,
  names: ImportNames,
  genDepth: number,
  effectFile: boolean,
  push: Push,
): void {
  const call = matchCall(node);
  if (call && isEffectCall(names, call.receiver, call.method)) {
    if (isRunMethod(call.method) && genDepth > 0) push("effect-doctor/run-inside-effect", node);
    if (
      !isRunMethod(call.method) &&
      ts.isExpressionStatement(node.parent) &&
      node.parent.expression === node
    ) {
      push("effect-doctor/floating-effect", node);
    }
    if (call.method === "sync" && call.call.arguments[0]) {
      const fn = call.call.arguments[0];
      if (isAsyncFn(fn)) push("effect-doctor/lazy-promise-in-sync", fn);
      if (containsThen(fn)) push("effect-doctor/then-in-sync", fn);
    }
    if (call.method === "fail" && call.call.arguments[0] && ts.isStringLiteral(call.call.arguments[0])) {
      push("effect-doctor/string-fail", call.call.arguments[0]);
    }
    if (call.method === "map" && callbackReturnsEffect(call.call.arguments[0], names)) {
      push("effect-doctor/map-returning-effect", node);
    }
    if (call.method === "orDie" || call.method === "orDieWith") push("effect-doctor/or-die", node);
    if (
      call.method === "succeed" &&
      call.call.arguments[0] &&
      (call.call.arguments[0].kind === ts.SyntaxKind.UndefinedKeyword ||
        (ts.isIdentifier(call.call.arguments[0]) && call.call.arguments[0].text === "undefined") ||
        (ts.isVoidExpression(call.call.arguments[0]) &&
          call.call.arguments[0].expression.kind === ts.SyntaxKind.NumericLiteral))
    ) {
      push("effect-doctor/succeed-undefined", node);
    }
    if (call.method === "map" && mapsToUndefined(call.call.arguments[0])) {
      push("effect-doctor/map-as-void", node);
    }
    if (call.method === "Do" || call.method === "bind") push("effect-doctor/effect-do", node);
    if (call.method === "fnUntraced") push("effect-doctor/fn-untraced", node);
    if (call.method === "catchAll") push("effect-doctor/v4-catch-all", node);
    if (call.method === "catchAllCause") push("effect-doctor/v4-catch-all-cause", node);
    if (call.method === "catchSome" || call.method === "catchSomeCause") {
      push("effect-doctor/v4-catch-some", node);
    }
    if (call.method === "fork") push("effect-doctor/v4-fork", node);
    if (call.method === "forkDaemon") push("effect-doctor/v4-fork-daemon", node);
    if (call.method === "forkAll") push("effect-doctor/v4-fork-all", node);
    if (call.method === "runtime") push("effect-doctor/v4-effect-runtime", node);
    if (call.method === "Service") push("effect-doctor/v4-effect-service", node);
    if (call.method === "sleep" && call.call.arguments[0] && ts.isNumericLiteral(call.call.arguments[0])) {
      push("effect-doctor/sleep-raw-millis", call.call.arguments[0]);
    }
    if (call.method === "all" && call.call.arguments.length === 1) {
      push("effect-doctor/all-missing-concurrency", node);
    }
    if ((call.method === "catch" || call.method === "catchAll") && catchLooksNull(call.call.arguments[0])) {
      push("effect-doctor/catch-to-null", node);
    }
    if ((call.method === "catch" || call.method === "catchAll") && catchLooksTagSwitch(call.call.arguments[0])) {
      push("effect-doctor/prefer-catch-tag", node);
    }
    if (
      call.method === "fn" &&
      ts.isCallExpression(node.parent) &&
      node.parent.expression === node &&
      ts.isCallExpression(node.parent.parent) &&
      node.parent.parent.expression === node.parent
    ) {
      push("effect-doctor/effect-fn-iife", node.parent.parent);
    }
  }

  if (call && isSchemaCall(names, call.receiver, call.method)) {
    if (isSchemaSyncMethod(call.method) && genDepth > 0) {
      push("effect-doctor/schema-sync-in-effect", node);
    }
    if (call.method === "decodeUnknown") push("effect-doctor/schema-decode-v3", node);
    if (call.method === "TaggedError") push("effect-doctor/v4-schema-tagged-error", node);
    if (
      (call.method === "decodeUnknownEffect" ||
        call.method === "decodeUnknown" ||
        call.method === "decodeUnknownSync") &&
      !isModuleInitializer(node)
    ) {
      push("effect-doctor/hoist-schema-codec", node);
    }
  }

  if (call && names.config.has(call.receiver ?? "") && call.method === "string") {
    const arg = call.call.arguments[0];
    if (arg && ts.isStringLiteral(arg) && CONFIG_SECRET.test(arg.text)) {
      push("effect-doctor/config-redacted", arg);
    }
  }
  if (call && call.method === "string" && !call.receiver && names.effectFns.has("string")) {
    const arg = call.call.arguments[0];
    if (arg && ts.isStringLiteral(arg) && CONFIG_SECRET.test(arg.text)) {
      push("effect-doctor/config-redacted", arg);
    }
  }

  if (!ts.isCallExpression(node)) return;

  const provideHits = countProvideArgs(node, names);
  if (provideHits >= 2) push("effect-doctor/multiple-provide", node);

  if (call?.method === "all" && call.receiver === "Promise" && effectFile) {
    push("effect-doctor/promise-all", node);
  }

  if (ts.isIdentifier(node.expression) && node.expression.text === "pipe" && node.arguments.length === 0) {
    push("effect-doctor/unnecessary-pipe", node);
  }
  if (
    ts.isPropertyAccessExpression(node.expression) &&
    node.expression.name.text === "pipe" &&
    node.arguments.length === 0
  ) {
    push("effect-doctor/unnecessary-pipe", node);
  }
  if (
    ts.isPropertyAccessExpression(node.expression) &&
    node.expression.name.text === "pipe" &&
    ts.isCallExpression(node.expression.expression) &&
    ts.isPropertyAccessExpression(node.expression.expression.expression) &&
    node.expression.expression.expression.name.text === "pipe"
  ) {
    push("effect-doctor/unnecessary-pipe-chain", node);
  }

  if (call && isEffectCall(names, call.receiver, call.method) && call.method === "gen") {
    const parent = node.parent;
    if (
      (ts.isArrowFunction(parent) || ts.isFunctionExpression(parent)) &&
      parent.body === node
    ) {
      push("effect-doctor/prefer-effect-fn", parent);
    }
  }
}

function inspectGlobals(
  node: ts.Node,
  genDepth: number,
  effectFile: boolean,
  push: Push,
): void {
  if (!effectFile && genDepth === 0) return;

  if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "Promise") {
    push("effect-doctor/new-promise", node);
  }
  if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "Date") {
    push("effect-doctor/global-date", node);
  }
  if (
    ts.isPropertyAccessExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === "process" &&
    node.name.text === "env"
  ) {
    push("effect-doctor/process-env", node);
  }

  if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
    const spec = node.moduleSpecifier.text;
    if (spec === "fs" || spec === "node:fs" || spec === "node:fs/promises") {
      push("effect-doctor/node-fs-import", node);
    }
  }

  const call = matchCall(node);
  if (!call) return;
  if (call.receiver === "JSON" && call.method === "parse") push("effect-doctor/json-parse", node);
  if (
    call.receiver === "console" &&
    ["log", "error", "warn", "info", "debug", "trace"].includes(call.method)
  ) {
    push("effect-doctor/global-console", node);
  }
  if (call.receiver === "Date" && call.method === "now") push("effect-doctor/global-date", node);
  if (call.receiver === "Math" && call.method === "random") push("effect-doctor/global-random", node);
  if (call.receiver === "crypto" && call.method === "randomUUID") {
    push("effect-doctor/crypto-random-uuid", node);
  }
  if (!call.receiver && call.method === "fetch") push("effect-doctor/global-fetch", node);
  if (!call.receiver && (call.method === "setTimeout" || call.method === "setInterval")) {
    push("effect-doctor/global-timers", node);
  }
}

function inspectSecrets(node: ts.Node, alchemyFile: boolean, push: Push): void {
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
    flagSecret(node.name.text, node.initializer, alchemyFile, push);
  }
  if (ts.isPropertyAssignment(node) && ts.isIdentifier(node.name)) {
    flagSecret(node.name.text, node.initializer, alchemyFile, push);
  }
  if (
    ts.isBinaryExpression(node) &&
    node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
    ts.isIdentifier(node.left)
  ) {
    flagSecret(node.left.text, node.right, alchemyFile, push);
  }
}

function flagSecret(name: string, value: ts.Expression, alchemyFile: boolean, push: Push): void {
  if (!ts.isStringLiteral(value) && !ts.isNoSubstitutionTemplateLiteral(value)) return;
  if (value.text.length < 12) return;
  const hit = SECRET_VALUE.test(value.text) || (SECRET_NAME.test(name) && value.text.length >= 16 && !value.text.includes(" "));
  if (!hit) return;
  push(alchemyFile ? "effect-doctor/alchemy-secret-in-source" : "effect-doctor/hardcoded-secret", value);
}

function inspectTypes(node: ts.Node, push: Push): void {
  if (node.kind === ts.SyntaxKind.AnyKeyword) push("effect-doctor/explicit-any", node);
  if (ts.isNonNullExpression(node)) push("effect-doctor/non-null-assertion", node);
  if (ts.isAsExpression(node) && ts.isAsExpression(node.expression)) {
    if (node.expression.type.kind === ts.SyntaxKind.UnknownKeyword) {
      push("effect-doctor/unsafe-assertion", node);
    }
  }
  if (
    ts.isFunctionLike(node) &&
    "parameters" in node &&
    node.parameters.length > 4 &&
    !ts.isIndexSignatureDeclaration(node)
  ) {
    push("effect-doctor/max-params", node);
  }
}

function inspectAgent(
  node: ts.Node,
  effectFile: boolean,
  relPath: string,
  nesting: number,
  push: Push,
): void {
  if (nesting > 4 && (ts.isIfStatement(node) || ts.isForStatement(node) || ts.isWhileStatement(node))) {
    push("effect-doctor/max-nesting", node);
  }
  if (effectFile && ts.isIfStatement(node) && ifChainLength(node) >= 3 && !isElseIf(node)) {
    push("effect-doctor/if-else-chain", node);
  }
  if (effectFile && isRawLoop(node)) push("effect-doctor/raw-loop", node);
  if (
    effectFile &&
    ts.isVariableDeclarationList(node) &&
    (node.flags & ts.NodeFlags.Let) !== 0
  ) {
    push("effect-doctor/let-mutation", node);
  }
  if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
    push("effect-doctor/inline-dynamic-import", node);
  }
  if (
    !isAlchemyEntryFile(relPath) &&
    ts.isExportAssignment(node) &&
    !node.isExportEquals
  ) {
    push("effect-doctor/default-export", node);
  }
  if (ts.isCatchClause(node) && node.block.statements.length === 0) {
    push("effect-doctor/empty-catch", node);
  }
  if (
    effectFile &&
    ts.isConditionalExpression(node) &&
    (ts.isConditionalExpression(node.whenTrue) || ts.isConditionalExpression(node.whenFalse)) &&
    !ts.isConditionalExpression(node.parent)
  ) {
    push("effect-doctor/prefer-match", node);
  }
  if (effectFile && ts.isClassDeclaration(node) && extendsError(node)) {
    push("effect-doctor/prefer-tagged-error", node);
  }
  if (effectFile && ts.isPropertyAccessExpression(node) && node.name.text === "_tag") {
    const parent = node.parent;
    if (
      ts.isBinaryExpression(parent) &&
      (parent.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken ||
        parent.operatorToken.kind === ts.SyntaxKind.EqualsEqualsToken)
    ) {
      push("effect-doctor/tag-string-comparison", parent);
    }
  }
  if (effectFile && ts.isObjectLiteralExpression(node) && hasTagLiteral(node)) {
    push("effect-doctor/manual-tagged-construction", node);
  }
}

function inspectV4(node: ts.Node, names: ImportNames, push: Push): void {
  const call = matchCall(node);
  if (call && names.context.has(call.receiver ?? "") && (call.method === "Tag" || call.method === "GenericTag")) {
    push("effect-doctor/v4-context-tag", node);
  }
  if (call && names.layer.has(call.receiver ?? "") && call.method === "scoped") {
    push("effect-doctor/v4-layer-scoped", node);
  }
  if (call && names.option.has(call.receiver ?? "") && call.method === "fromNullable") {
    push("effect-doctor/v4-option-from-nullable", node);
  }
  if (call && names.effect.has(call.receiver ?? "") && call.method === "Tag") {
    push("effect-doctor/v4-context-tag", node);
  }

  if (ts.isPropertyAccessExpression(node) && (node.name.text === "Default" || node.name.text === "Live")) {
    if (names.importsEffect) push("effect-doctor/legacy-default-layer", node);
  }
  if (ts.isIdentifier(node) && node.text === "FiberRef" && names.importsEffect) {
    if (ts.isPropertyAccessExpression(node.parent) || ts.isCallExpression(node.parent)) {
      push("effect-doctor/v4-fiber-ref", node);
    }
  }

  if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
    if (V3_PLATFORM.test(node.moduleSpecifier.text)) push("effect-doctor/v4-platform-import", node);
  }
}

function inspectComments(node: ts.Node, sourceFile: ts.SourceFile, push: Push): void {
  const text = sourceFile.getFullText();
  const ranges = ts.getLeadingCommentRanges(text, node.getFullStart());
  if (!ranges) return;
  for (const range of ranges) {
    const comment = text.slice(range.pos, range.end);
    if (/@ts-ignore|@ts-expect-error/.test(comment)) push("effect-doctor/ts-ignore", node);
    if (/@ts-nocheck/.test(comment)) push("effect-doctor/ts-nocheck", node);
    if (/eslint-disable/.test(comment)) push("effect-doctor/eslint-disable", node);
  }
}

export function isEffectGenCallback(node: ts.Node, names: ImportNames): boolean {
  if (
    !(ts.isFunctionExpression(node) || ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node))
  ) {
    return false;
  }
  if (!node.asteriskToken) return false;
  const parent = node.parent;
  if (!parent || !ts.isCallExpression(parent)) return false;
  if (!parent.arguments.some((arg) => arg === node)) return false;
  const direct = matchCall(parent);
  if (direct && isEffectCall(names, direct.receiver, direct.method) && isGenMethod(direct.method)) {
    return true;
  }
  if (ts.isCallExpression(parent.expression)) {
    const curried = matchCall(parent.expression);
    if (
      curried &&
      isEffectCall(names, curried.receiver, curried.method) &&
      (curried.method === "fn" || curried.method === "fnUntraced")
    ) {
      return true;
    }
  }
  return false;
}

export function isUnnecessaryGen(node: ts.Node): boolean {
  if (!ts.isFunctionExpression(node) || !node.body || !ts.isBlock(node.body)) return false;
  const stmts = node.body.statements.filter((s) => !ts.isEmptyStatement(s));
  if (stmts.length !== 1 || !ts.isReturnStatement(stmts[0]!) || !stmts[0].expression) return false;
  const expr = stmts[0].expression;
  return ts.isYieldExpression(expr) && Boolean(expr.asteriskToken);
}

export function countProvideArgs(node: ts.CallExpression, names: ImportNames): number {
  const isPipeFn = ts.isIdentifier(node.expression) && node.expression.text === "pipe";
  const isPipeMethod =
    ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === "pipe";
  if (!isPipeFn && !isPipeMethod) return 0;
  let count = 0;
  for (const arg of node.arguments) {
    const inner = matchCall(arg);
    if (inner && inner.method === "provide" && isEffectCall(names, inner.receiver, inner.method)) {
      count += 1;
    }
  }
  return count;
}

function isAsyncFn(fn: ts.Expression): boolean {
  return (
    (ts.isFunctionExpression(fn) || ts.isArrowFunction(fn)) &&
    Boolean(fn.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword))
  );
}

function containsThen(fn: ts.Expression): boolean {
  if (!(ts.isFunctionExpression(fn) || ts.isArrowFunction(fn))) return false;
  let found = false;
  const visit = (n: ts.Node): void => {
    if (ts.isPropertyAccessExpression(n) && n.name.text === "then") found = true;
    ts.forEachChild(n, visit);
  };
  visit(fn);
  return found;
}

function callbackReturnsEffect(fn: ts.Expression | undefined, names: ImportNames): boolean {
  if (!fn || !(ts.isArrowFunction(fn) || ts.isFunctionExpression(fn))) return false;
  const body = fn.body;
  const expr = ts.isBlock(body)
    ? body.statements.length === 1 && ts.isReturnStatement(body.statements[0]!)
      ? body.statements[0].expression
      : undefined
    : body;
  if (!expr) return false;
  const call = matchCall(expr);
  return Boolean(call && isEffectCall(names, call.receiver, call.method) && !isRunMethod(call.method));
}

function mapsToUndefined(fn: ts.Expression | undefined): boolean {
  if (!fn || !(ts.isArrowFunction(fn) || ts.isFunctionExpression(fn))) return false;
  const body = fn.body;
  if (ts.isBlock(body) && body.statements.length === 0) return true;
  const expr = ts.isBlock(body)
    ? body.statements.length === 1 && ts.isReturnStatement(body.statements[0]!)
      ? body.statements[0].expression
      : undefined
    : body;
  if (!expr) return false;
  return (
    expr.kind === ts.SyntaxKind.UndefinedKeyword ||
    (ts.isIdentifier(expr) && expr.text === "undefined") ||
    (ts.isVoidExpression(expr) && expr.expression.kind === ts.SyntaxKind.NumericLiteral)
  );
}

function catchLooksNull(fn: ts.Expression | undefined): boolean {
  if (!fn || !(ts.isArrowFunction(fn) || ts.isFunctionExpression(fn))) return false;
  const body = fn.body;
  const expr = ts.isBlock(body)
    ? body.statements.length === 1 && ts.isReturnStatement(body.statements[0]!)
      ? body.statements[0].expression
      : undefined
    : body;
  return Boolean(expr && (expr.kind === ts.SyntaxKind.NullKeyword || (ts.isIdentifier(expr) && expr.text === "undefined")));
}

function catchLooksTagSwitch(fn: ts.Expression | undefined): boolean {
  if (!fn) return false;
  let found = false;
  const visit = (n: ts.Node): void => {
    if (ts.isPropertyAccessExpression(n) && n.name.text === "_tag") found = true;
    ts.forEachChild(n, visit);
  };
  visit(fn);
  return found;
}

function isModuleInitializer(node: ts.Node): boolean {
  let cur: ts.Node | undefined = node.parent;
  while (cur && !ts.isSourceFile(cur)) {
    if (ts.isFunctionLike(cur) || ts.isMethodDeclaration(cur)) return false;
    cur = cur.parent;
  }
  return true;
}

function ifChainLength(node: ts.IfStatement): number {
  let n = 1;
  let cur: ts.IfStatement | undefined = node;
  while (cur?.elseStatement && ts.isIfStatement(cur.elseStatement)) {
    n += 1;
    cur = cur.elseStatement;
  }
  if (cur?.elseStatement) n += 1;
  return n;
}

function isElseIf(node: ts.IfStatement): boolean {
  return ts.isIfStatement(node.parent) && node.parent.elseStatement === node;
}

function isRawLoop(node: ts.Node): boolean {
  return (
    ts.isForStatement(node) ||
    ts.isForOfStatement(node) ||
    ts.isForInStatement(node) ||
    ts.isWhileStatement(node) ||
    ts.isDoStatement(node)
  );
}

function extendsError(node: ts.ClassDeclaration): boolean {
  return Boolean(
    node.heritageClauses?.some((h) =>
      h.types.some((t) => ts.isIdentifier(t.expression) && t.expression.text === "Error"),
    ),
  );
}

function hasTagLiteral(node: ts.ObjectLiteralExpression): boolean {
  return node.properties.some(
    (p) =>
      ts.isPropertyAssignment(p) &&
      ts.isIdentifier(p.name) &&
      p.name.text === "_tag" &&
      ts.isStringLiteral(p.initializer),
  );
}
