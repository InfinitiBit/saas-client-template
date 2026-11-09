import { lintSource } from './lint-source';

// Catches: `pnpm lint` silently skipping a local or vendored rule, or dropping the options and settings it reads, or app code that already breaks one, with the rule's own table test still green.
it('the local and vendored rules pass over the real source', () => {
	const { status, stdout, stderr } = lintSource([
		'local/no-jsx-and',
		'local/layout',
		'local/feature-boundaries',
		'local/require-catches-comment',
		'anti-slop/no-module-mocking',
	]);

	expect(status, stdout + stderr).toBe(0);
});
