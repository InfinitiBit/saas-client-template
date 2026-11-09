import { RuleTester } from 'oxlint/plugins-dev';

import { noModuleMockingRule } from './anti-slop/rules/no-module-mocking';

const testFile = 'src/features/orders/lib/orders.test.ts';

// Catches: a test faking app code through `vi.mock`, `vi.spyOn` or member assignment instead of stubbing the HTTP edge, a false alarm on a browser global, a plain callback or a third-party import, or app code flagged for writing to its own module state.
new RuleTester({
	languageOptions: { parserOptions: { lang: 'ts' } },
}).run('no-module-mocking', noModuleMockingRule, {
	valid: [
		...[
			"vi.stubGlobal('navigator', { clipboard: { writeText } });",
			'const ended = vi.fn();',
			"import { getRequest } from '@tanstack/react-start/server'; vi.mocked(getRequest).mockReset();",
			"import * as router from '@tanstack/react-router'; vi.spyOn(router, 'useNavigate');",
			"import { store } from 'some-lib'; store.value = 1;",
			"import { notes } from '@/features/notes/lib/notes'; const copy = { ...notes }; copy.value = 1;",
			"const local = { value: 0 }; vi.spyOn(local, 'value');",
		].map((code) => ({ code, filename: testFile })),
		{
			code: "import { store } from '@/lib/store'; store.value = 1;",
			filename: 'src/features/orders/lib/orders.ts',
		},
		{
			code: "import * as session from '@/features/auth/lib/session'; vi.spyOn(session, 'adoptLaunch');",
			filename: 'src/testing/session.ts',
		},
	],
	invalid: [
		{ code: "vi.mock('@/features/auth/lib/session');", errors: 1 },
		{
			code: "vi.mock('@/features/auth/lib/session');",
			filename: 'src/testing/setup.ts',
			errors: 1,
		},
		{
			code: "import * as session from '@/features/auth/lib/session'; vi.spyOn(session, 'adoptLaunch');",
			errors: 1,
		},
		{
			code: "import { brands } from '../features/brand/lib/brands'; vi.spyOn(brands, 'find');",
			filename: 'src/__tests__/brand.tsx',
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
			filename: 'src/features/brand/lib/brands.test.tsx',
			errors: 1,
		},
	].map((test) => ({ filename: testFile, ...test })),
});
