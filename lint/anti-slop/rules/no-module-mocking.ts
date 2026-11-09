import { defineRule } from "@oxlint/plugins";

import { resolveVariable } from "../shared/scope.ts";

import type { ESTree, SourceCode } from "@oxlint/plugins";

const moduleMockMethods = new Set(["doMock", "mock", "unstable_mockModule"]);

function importedName(node: ESTree.Node): string | null {
  if (node.type !== "ImportSpecifier") return null;
  return node.imported.type === "Identifier" ? node.imported.name : node.imported.value;
}

function isTestFrameworkObject(
  sourceCode: SourceCode,
  expression: ESTree.Expression,
): expression is ESTree.IdentifierReference {
  if (expression.type !== "Identifier") return false;
  if (
    (expression.name === "vi" || expression.name === "jest") &&
    sourceCode.isGlobalReference(expression)
  ) {
    return true;
  }

  const variable = resolveVariable(sourceCode, expression);
  if (variable === null || variable.defs.length === 0) {
    return expression.name === "vi" || expression.name === "jest";
  }
  return variable.defs.some((definition) => {
    if (definition.type !== "ImportBinding" || definition.parent?.type !== "ImportDeclaration") {
      return false;
    }
    const source = definition.parent.source.value;
    const name = importedName(definition.node);
    return (source === "vitest" && name === "vi") || (source === "@jest/globals" && name === "jest");
  });
}

function frameworkMethod(sourceCode: SourceCode, callee: ESTree.Expression): string | null {
  if (callee.type !== "MemberExpression") return null;
  if (!isTestFrameworkObject(sourceCode, callee.object)) return null;
  const property = callee.property;
  if (callee.computed) {
    return property.type === "Literal" && typeof property.value === "string" ? property.value : null;
  }
  return property.type === "Identifier" ? property.name : null;
}

function isAppImport(sourceCode: SourceCode, expression: ESTree.Argument): boolean {
  let root: ESTree.Argument | ESTree.Super = expression;
  while (root.type === "MemberExpression") root = root.object;
  if (root.type !== "Identifier") return false;
  const variable = resolveVariable(sourceCode, root);
  if (variable === null) return false;
  return variable.defs.some((definition) => {
    if (definition.type !== "ImportBinding" || definition.parent?.type !== "ImportDeclaration") {
      return false;
    }
    const source = definition.parent.source.value;
    return source.startsWith("@/") || source.startsWith(".");
  });
}

function isTestFile(filename: string): boolean {
  return /\.test\.|(^|[\\/])__tests__[\\/]/.test(filename);
}

/** Ban test framework module mocking in favor of real dependency seams. */
export const noModuleMockingRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow Vitest and Jest module mocking, and spying on or assigning onto this app's imports; tests must replace dependencies through real interfaces.",
    },
    messages: {
      moduleMock:
        "Replace module mocking with dependency injection through a real interface, service layer, or faithful test implementation.",
      appFake:
        "Do not fake this app's own code; stub the other system at its HTTP edge with MSW instead.",
    },
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        if (node.callee.type === "Super" || node.callee.type === "V8IntrinsicExpression") return;
        const method = frameworkMethod(context.sourceCode, node.callee);
        if (method !== null && moduleMockMethods.has(method)) {
          context.report({ node, messageId: "moduleMock" });
        } else if (
          method === "spyOn" &&
          isTestFile(context.filename) &&
          node.arguments[0] !== undefined &&
          isAppImport(context.sourceCode, node.arguments[0])
        ) {
          context.report({ node, messageId: "appFake" });
        }
      },
      AssignmentExpression(node) {
        if (
          node.left.type === "MemberExpression" &&
          isTestFile(context.filename) &&
          isAppImport(context.sourceCode, node.left)
        ) {
          context.report({ node, messageId: "appFake" });
        }
      },
    };
  },
});
