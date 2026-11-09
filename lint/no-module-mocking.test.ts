import { RuleTester } from 'oxlint/plugins-dev';

import { noModuleMockingRule } from './anti-slop/rules/no-module-mocking';
import { lintSource } from './lint-source';

// Catches: a test faking app code through `vi.mock`, `vi.spyOn` or member assignment instead of stubbing the HTTP edge, or a false alarm on a browser global, a plain callback or a third-party import.
new RuleTester({
	languageOptions: { parserOptions: { lang: 'ts' } },
}).run('no-module-mocking', noModuleMockingRule, {
	valid: [
		"vi.stubGlobal('navigator', { clipboard: { writeText } });",
		'const ended = vi.fn();',
		"import { getRequest } from '@tanstack/react-start/server'; vi.mocked(getRequest).mockReset();",
		"import * as router from '@tanstack/react-router'; vi.spyOn(router, 'useNavigate');",
		"import { store } from 'some-lib'; store.value = 1;",
		"import { notes } from '@/features/notes/lib/notes'; const copy = { ...notes }; copy.value = 1;",
		"const local = { value: 0 }; vi.spyOn(local, 'value');",
	],
	invalid: [
		{ code: "vi.mock('@/features/auth/lib/session');", errors: 1 },
		{
			code: "import * as session from '@/features/auth/lib/session'; vi.spyOn(session, 'adoptLaunch');",
			errors: 1,
		},
		{
			code: "import { brands } from '../features/brand/lib/brands'; vi.spyOn(brands, 'find');",
			errors: 1,
		},
		{
			code: "import { vi } from 'vitest'; import config from './config'; vi.spyOn(config.mode, 'get');",
			errors: 1,
		},
		{
			code: "import * as session from '@/features/auth/lib/session'; session.adoptLaunch = vi.fn();",
			errors: 1,
		},
		{
			code: "import { brands } from './brands'; brands.default.name = 'x';",
			errors: 1,
		},
	],
});

// Catches: `pnpm lint` silently skipping the rule, or a test that already fakes app code.
it('anti-slop/no-module-mocking passes over the real source', () => {
	const { status, stdout, stderr } = lintSource('anti-slop/no-module-mocking');

	expect(status, stdout + stderr).toBe(0);
});
