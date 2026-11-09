import { join, relative, sep } from 'node:path';

export const root = join(import.meta.dirname, '..');

// Relative to the repo root, with `/` separators, as the rules' decision functions take it.
export function repoPath(filename: string) {
	return relative(root, filename).split(sep).join('/');
}
