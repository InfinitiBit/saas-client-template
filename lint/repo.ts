import { join, relative, sep } from 'node:path';

export const root = join(import.meta.dirname, '..');

export function repoPath(filename: string) {
	return relative(root, filename).split(sep).join('/');
}
