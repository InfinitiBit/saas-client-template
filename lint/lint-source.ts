import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { z } from 'zod';

import { root } from './repo';

const resolvePlugin = createRequire(join(root, 'package.json')).resolve;

function absolute(specifier: string) {
	return specifier.startsWith('.')
		? join(root, specifier)
		: resolvePlugin(specifier);
}

const oxlintrcSchema = z.object({
	ignorePatterns: z.array(z.string()),
	rules: z.record(z.string(), z.unknown()),
	jsPlugins: z.array(
		z.union([
			z.string().transform(absolute),
			z
				.object({ name: z.string(), specifier: z.string() })
				.transform((plugin) => ({
					...plugin,
					specifier: absolute(plugin.specifier),
				})),
		]),
	),
	settings: z.record(z.string(), z.unknown()),
});

export function lintSource(rules: readonly string[]) {
	const config = oxlintrcSchema.parse(
		JSON.parse(readFileSync(join(root, '.oxlintrc.json'), 'utf8')),
	);

	const missing = rules.filter((rule) => config.rules[rule] === undefined);

	if (missing.length > 0)
		throw new Error(`${missing.join(', ')} not configured in .oxlintrc.json`);

	const dir = mkdtempSync(join(tmpdir(), 'oxlint-'));
	const file = join(dir, 'oxlintrc.json');

	writeFileSync(
		file,
		JSON.stringify({
			categories: { correctness: 'off' },
			jsPlugins: config.jsPlugins,
			rules: Object.fromEntries(
				rules.map((rule) => [rule, config.rules[rule]]),
			),
			settings: config.settings,
		}),
	);

	try {
		return spawnSync(
			join(root, 'node_modules/.bin/oxlint'),
			[
				'-c',
				file,
				...config.ignorePatterns.flatMap((pattern) => [
					'--ignore-pattern',
					pattern,
				]),
				'.',
			],
			{ cwd: root, encoding: 'utf8' },
		);
	} finally {
		rmSync(dir, { recursive: true });
	}
}
