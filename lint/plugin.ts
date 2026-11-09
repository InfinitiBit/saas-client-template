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

export default definePlugin({
	meta: { name: 'local' },
	rules: { 'no-jsx-and': noJsxAnd },
});
