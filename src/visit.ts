import { basename } from "node:path";
import * as ts from "typescript";
import { RULE_BY_ID } from "./catalog.js";
import {
  collectImports,
  isAlchemyCall,
  isAlchemyEntryFile,
  matchCall,
} from "./imports.js";
import {
  inspectFile,
  inspectNode,
  isEffectGenCallback,
  isUnnecessaryGen,
  type Push,
} from "./inspect.js";
import type { Diagnostic } from "./types.js";

/**
 * Analisa um SourceFile e devolve diagnósticos AST (Effect RC + nits + Alchemy).
 */
export function analyzeSourceFile(relPath: string, sourceFile: ts.SourceFile): Diagnostic[] {
  const names = collectImports(sourceFile);
  const diags: Diagnostic[] = [];
  let genDepth = 0;
  let nesting = 0;
  let stackCalls = 0;
  let defaultStack = false;

  const push: Push = (ruleId, node) => {
    const rule = RULE_BY_ID.get(ruleId);
    if (!rule) return;
    const pos = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    diags.push({
      rule: rule.id,
      severity: rule.severity,
      category: rule.category,
      message: rule.message,
      hint: rule.hint,
      bad: rule.bad,
      good: rule.good,
      file: relPath,
      line: pos.line + 1,
      column: pos.character + 1,
    });
  };

  const visit = (node: ts.Node): void => {
    const enteringGen = isEffectGenCallback(node, names);
    const nestEnter = isNest(node);
    if (enteringGen) {
      genDepth += 1;
      const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line;
      const end = sourceFile.getLineAndCharacterOfPosition(node.end).line;
      if (end - start + 1 >= 80) push("effect-doctor/giant-gen", node);
      if (isUnnecessaryGen(node)) push("effect-doctor/unnecessary-gen", node);
    }
    if (nestEnter) nesting += 1;

    inspectNode({ node, names, genDepth, nesting, relPath, sourceFile, push });

    if (ts.isExportAssignment(node) && !node.isExportEquals) {
      const inner = matchCall(node.expression);
      if (inner && isAlchemyCall(names, inner.receiver, inner.method) && inner.method === "Stack") {
        defaultStack = true;
      }
    }

    const stackCall = matchCall(node);
    if (
      stackCall &&
      isAlchemyCall(names, stackCall.receiver, stackCall.method) &&
      stackCall.method === "Stack"
    ) {
      stackCalls += 1;
      const config = stackCall.call.arguments[1];
      if (config && ts.isObjectLiteralExpression(config)) {
        const hasProviders = config.properties.some(
          (prop) =>
            (ts.isPropertyAssignment(prop) ||
              ts.isShorthandPropertyAssignment(prop) ||
              ts.isMethodDeclaration(prop)) &&
            prop.name !== undefined &&
            ts.isIdentifier(prop.name) &&
            prop.name.text === "providers",
        );
        if (!hasProviders) push("effect-doctor/alchemy-missing-providers", config);
      }
    }

    ts.forEachChild(node, visit);
    if (nestEnter) nesting -= 1;
    if (enteringGen) genDepth -= 1;
  };

  visit(sourceFile);
  inspectFile({ sourceFile, push });

  if (isAlchemyEntryFile(relPath) && (stackCalls === 0 || !defaultStack)) {
    push("effect-doctor/alchemy-missing-stack", sourceFile);
  }

  return diags;
}

function isNest(node: ts.Node): boolean {
  return (
    ts.isIfStatement(node) ||
    ts.isForStatement(node) ||
    ts.isForOfStatement(node) ||
    ts.isForInStatement(node) ||
    ts.isWhileStatement(node) ||
    ts.isDoStatement(node) ||
    ts.isSwitchStatement(node)
  );
}

export function sourceKindFor(path: string): ts.ScriptKind {
  const name = basename(path);
  if (name.endsWith(".tsx")) return ts.ScriptKind.TSX;
  return ts.ScriptKind.TS;
}
