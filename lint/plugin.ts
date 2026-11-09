import { posix } from 'node:path';

import {
	defineRule,
	definePlugin,
	type ESTree,
	type Settings,
} from '@oxlint/plugins';
import { z } from 'zod';

import { repoPath } from './repo.ts';

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

// Every feature not listed is an Application feature. Shared settings, so the rules that tell the two apart read one list.
const localSettings = z.object({
	local: z.object({ templateFeatures: z.array(z.string()) }),
});

function templateFeatures(settings: Readonly<Settings>) {
	return localSettings.parse(settings).local.templateFeatures;
}

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
	},
	create(context) {
		const file = repoPath(context.filename);
		const messageId = layoutViolation(file, templateFeatures(context.settings));

		return {
			Program(node) {
				if (messageId !== null)
					context.report({ node, messageId, data: { file } });
			},
		};
	},
});

function resolveSpecifier(file: string, specifier: string) {
	if (specifier.startsWith('@/')) return `src/${specifier.slice(2)}`;

	if (specifier.startsWith('.'))
		return posix.join(posix.dirname(file), specifier);

	return null;
}

// `file` is relative to the repo root, with `/` separators.
export function importViolation(
	file: string,
	specifier: string,
	templateFeatures: readonly string[],
) {
	const target = resolveSpecifier(file, specifier);
	const [top, area, from] = file.split('/');

	if (
		target === null ||
		!target.startsWith('src/features/') ||
		top !== 'src' ||
		file.includes('.test.')
	)
		return null;

	const [, , to, ...rest] = target.split('/');

	if (area === 'components' || area === 'lib')
		return {
			messageId: 'sharedImportsFeature',
			data: { from: `src/${area}`, to },
		};

	if (area !== 'features' || from === to || templateFeatures.includes(to))
		return null;

	if (templateFeatures.includes(from))
		return { messageId: 'templateImportsApplication', data: { from, to } };

	const throughBarrel =
		rest.length === 0 || (rest.length === 1 && /^index(\.ts)?$/.test(rest[0]));

	return throughBarrel ? null : { messageId: 'pastBarrel', data: { from, to } };
}

// One statement of an Application feature's `index.ts`.
export function barrelViolation(type: string, source: string | null) {
	if (type === 'ExportAllDeclaration') return 'exportAll';

	if (type !== 'ExportNamedDeclaration' || source === null)
		return 'notReExport';

	return /\.server(\.[cm]?[jt]sx?)?$/.test(source) ? 'serverReExport' : null;
}

export const featureBoundaries = defineRule({
	meta: {
		type: 'problem',
		docs: {
			description:
				'Which feature may import which: AGENTS.md → Layout, ADR 0011.',
		},
		messages: {
			templateImportsApplication:
				'Template feature `{{from}}` imports Application feature `{{to}}`. A derived repo deletes `{{to}}`; pass it in from a route or `router.tsx` instead (AGENTS.md → Layout).',
			pastBarrel:
				'Application feature `{{from}}` imports Application feature `{{to}}` past its `index.ts`. Import from `@/features/{{to}}`, and re-export what you need there (AGENTS.md → Layout).',
			sharedImportsFeature:
				'`{{from}}` imports feature `{{to}}`. Shared folders import no feature (AGENTS.md → Layout).',
			exportAll:
				'{{file}}: a barrel names what it re-exports; no `export *` (AGENTS.md → Layout).',
			notReExport:
				'{{file}}: a barrel holds only named re-exports, `export { x } from …` (AGENTS.md → Layout).',
			serverReExport:
				'{{file}}: a barrel never re-exports a `.server.ts` module; it would reach the client (AGENTS.md → Layout).',
		},
	},
	create(context) {
		const file = repoPath(context.filename);
		const features = templateFeatures(context.settings);

		const check = (source: ESTree.Expression) => {
			if (source.type !== 'Literal') return;

			const violation = importViolation(file, String(source.value), features);

			if (violation !== null) context.report({ node: source, ...violation });
		};

		return {
			ImportDeclaration: (node) => check(node.source),
			ExportNamedDeclaration(node) {
				if (node.source !== null) check(node.source);
			},
			ExportAllDeclaration: (node) => check(node.source),
			ImportExpression: (node) => check(node.source),
			TSImportType: (node) => check(node.source),
			Program(node) {
				if (!/^src\/features\/[^/]+\/index\.ts$/.test(file)) return;

				for (const statement of node.body) {
					const source =
						statement.type === 'ExportNamedDeclaration'
							? (statement.source?.value ?? null)
							: null;

					const messageId = barrelViolation(statement.type, source);

					if (messageId !== null)
						context.report({ node: statement, messageId, data: { file } });
				}
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
		layout,
		'feature-boundaries': featureBoundaries,
		'require-catches-comment': requireCatchesComment,
	},
});
