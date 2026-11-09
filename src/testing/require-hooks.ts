import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

// husky's hook directory is generated and git-ignored, so a checkout where nobody ran `pnpm install` commits and pushes past every hook.
export function setup() {
	let hook: string;

	try {
		hook = execFileSync(
			'git',
			['rev-parse', '--path-format=absolute', '--git-path', 'hooks/pre-push'],
			{ encoding: 'utf8' },
		).trim();
	} catch {
		return;
	}

	if (!existsSync(hook)) {
		throw new Error(
			`${hook} is missing, so git runs no hooks: run \`pnpm install\` and fix what it reports`,
		);
	}
}
