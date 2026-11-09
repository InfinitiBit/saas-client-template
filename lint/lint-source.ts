import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { z } from 'zod';

const root = join(import.meta.dirname, '..');

const oxlintrcSchema = z.object({
	ignorePatterns: z.array(z.string()),
	rules: z.record(z.string(), z.unknown()),
	settings: z.record(z.string(), z.unknown()),
});

// Runs oxlint over `src/` with only `rule` on, set as `.oxlintrc.json` sets it.
// The config is written outside the repo, so its plugin path is absolute and its ignores move to the CLI, which resolves them from the root.
export function lintSource(rule: string) {
	const config = oxlintrcSchema.parse(
		JSON.parse(readFileSync(join(root, '.oxlintrc.json'), 'utf8')),
	);

	const setting = config.rules[rule];

	if (setting === undefined)
		throw new Error(`${rule} is not configured in .oxlintrc.json`);

	const dir = mkdtempSync(join(tmpdir(), 'oxlint-'));
	const file = join(dir, 'oxlintrc.json');

	writeFileSync(
		file,
		JSON.stringify({
			categories: { correctness: 'off' },
			jsPlugins: [join(root, 'lint/plugin.ts')],
			rules: { [rule]: setting },
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
				'src',
			],
			{ cwd: root, encoding: 'utf8' },
		);
	} finally {
		rmSync(dir, { recursive: true });
	}
}
