import { defineRule, definePlugin, type ESTree } from '@oxlint/plugins';

export function isJsxAnd(node: ESTree.LogicalExpression) {
	return (
		node.operator === '&&' && node.parent.type === 'JSXExpressionContainer'
	);
}

// oxlint has no `no-restricted-syntax`, which is how ESLint forbade this.
export const noJsxAnd = defineRule({
	meta: {
		type: 'problem',
		docs: {
			description:
				'`a && <X />` renders a falsy `a` itself, so a stray 0 reaches the UI.',
		},
	},
	create(context) {
		return {
			LogicalExpression(node) {
				if (isJsxAnd(node))
					context.report({
						node,
						message:
							'Use a ternary (condition ? <Component /> : null) instead of && in JSX.',
					});
			},
		};
	},
});

// The callee's chain, unwrapped through `.each(table)` and `` .each`table` ``, starts at `it` or `test`.
function namesTest(callee: ESTree.Node): boolean {
	if (callee.type === 'Identifier')
		return callee.name === 'it' || callee.name === 'test';

	if (callee.type === 'MemberExpression') return namesTest(callee.object);

	if (callee.type === 'CallExpression') return namesTest(callee.callee);

	if (callee.type === 'TaggedTemplateExpression') return namesTest(callee.tag);

	return false;
}

// `it.each(table)` is only the callee of the test call, so it is not a test itself.
export function isTestCall(node: ESTree.CallExpression) {
	return (
		namesTest(node.callee) &&
		!(node.parent.type === 'CallExpression' && node.parent.callee === node)
	);
}

export function isCatchesComment(comment: ESTree.Comment) {
	return (
		comment.type === 'Line' && comment.value.trimStart().startsWith('Catches: ')
	);
}

export const requireCatchesComment = defineRule({
	meta: {
		type: 'problem',
		docs: {
			description:
				'A test that cannot name the bug it catches is a tautology that only slows change.',
		},
	},
	create(context) {
		return {
			CallExpression(node) {
				if (!isTestCall(node)) return;

				if (context.sourceCode.getCommentsBefore(node).some(isCatchesComment))
					return;

				const [title] = node.arguments;

				context.report({
					node,
					message: `${context.sourceCode.getText(title ?? node)} has no \`// Catches: <the bug a user would hit>\` comment directly above it. If you cannot name the bug, delete the test.`,
				});
			},
		};
	},
});

export default definePlugin({
	meta: { name: 'local' },
	rules: {
		'no-jsx-and': noJsxAnd,
		'require-catches-comment': requireCatchesComment,
	},
});
