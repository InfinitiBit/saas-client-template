import { join, relative, sep } from 'node:path';

import { defineRule, definePlugin, type ESTree } from '@oxlint/plugins';
import { z } from 'zod';

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

// Every feature not listed is an Application feature. Rules that tell the two apart share this option.
const templateFeaturesOption = z.object({
	templateFeatures: z.array(z.string()),
});

export const templateFeaturesSchema = [z.toJSONSchema(templateFeaturesOption)];

export function templateFeatures(options: readonly unknown[]) {
	return templateFeaturesOption.parse(options[0]).templateFeatures;
}

const root = join(import.meta.dirname, '..');

const featureFolders = new Set(['components', 'hooks', 'lib']);

function featureLayoutHolds(
	feature: string,
	rest: readonly string[],
	templateFeatures: readonly string[],
) {
	const [child, ...below] = rest;

	if (below.length === 0)
		return child === 'index.ts' && !templateFeatures.includes(feature);

	if (featureFolders.has(child) || (child === 'generated' && feature === 'api'))
		return true;

	return below.length > 1 && featureFolders.has(below[0]);
}

// `file` is relative to the repo root, with `/` separators.
export function layoutViolation(
	file: string,
	templateFeatures: readonly string[],
) {
	const [top, area, feature, ...rest] = file.split('/');

	if (top !== 'src') return null;

	if (area === 'server' && feature !== undefined) return 'serverFolder';

	if (area === 'features')
		return featureLayoutHolds(feature, rest, templateFeatures)
			? null
			: 'featureFolder';

	if (file.includes('.server.') && feature !== undefined) return 'serverModule';

	return null;
}

export const layout = defineRule({
	meta: {
		type: 'problem',
		docs: {
			description:
				'Each file has one place: AGENTS.md → Layout, checked on the file’s own path.',
		},
		messages: {
			serverFolder:
				'{{file}}: there is no `src/server/` folder. A server-only module lives in the feature it belongs to (AGENTS.md → Layout).',
			serverModule:
				'{{file}}: a `.server.ts` module lives inside a feature, or at the `src/` root as an app-wide entry (AGENTS.md → Layout).',
			featureFolder:
				'{{file}}: a feature holds only `components/`, `hooks/`, `lib/`, `generated/` (`api` only), subfeature folders of `components/`, `hooks/` and `lib/`, and, in an Application feature, `index.ts` (AGENTS.md → Layout).',
		},
		schema: templateFeaturesSchema,
	},
	create(context) {
		const file = relative(root, context.filename).split(sep).join('/');
		const messageId = layoutViolation(file, templateFeatures(context.options));

		return {
			Program(node) {
				if (messageId !== null)
					context.report({ node, messageId, data: { file } });
			},
		};
	},
});

export default definePlugin({
	meta: { name: 'local' },
	rules: { 'no-jsx-and': noJsxAnd, layout },
});
