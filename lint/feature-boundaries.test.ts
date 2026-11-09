import { barrelViolation, importViolation } from './plugin';

const templateFeatures = ['kernel', 'identity', 'theme'];

const refused = (messageId: string, from: string, to: string) => ({
	messageId,
	data: { from, to },
});

const imports = [
	['src/features/orders/lib/a.ts', '@/features/identity/lib/b', null],
	['src/features/orders/lib/a.ts', '@/features/kernel/generated/c', null],
	['src/features/orders/lib/a.ts', '../../identity/hooks/d', null],
	['src/features/identity/lib/a.ts', '@/features/theme/lib/b', null],
	['src/features/orders/lib/a.ts', './b', null],
	['src/features/orders/billing/lib/a.ts', '@/features/orders/lib/b', null],
	['src/features/orders/lib/a.ts', '@/application', null],
	['src/features/orders/lib/a.ts', '@/components/data-table', null],
	['src/features/orders/lib/a.ts', 'react', null],
	['src/features/orders/lib/a.ts', '@/features/invoices', null],
	['src/features/orders/lib/a.ts', '@/features/invoices/index', null],
	['src/features/orders/lib/a.ts', '../../invoices/index.ts', null],
	[
		'src/features/identity/lib/a.ts',
		'@/features/orders/lib/b',
		refused('templateImportsApplication', 'identity', 'orders'),
	],
	[
		'src/features/kernel/lib/a.ts',
		'@/features/orders',
		refused('templateImportsApplication', 'kernel', 'orders'),
	],
	[
		'src/features/kernel/lib/a.ts',
		'../../orders/lib/b',
		refused('templateImportsApplication', 'kernel', 'orders'),
	],
	[
		'src/features/orders/lib/a.ts',
		'@/features/invoices/lib/b',
		refused('pastBarrel', 'orders', 'invoices'),
	],
	[
		'src/features/orders/billing/lib/a.ts',
		'../../../invoices/components/c',
		refused('pastBarrel', 'orders', 'invoices'),
	],
	[
		'src/features/orders/lib/a.ts',
		'@/features/invoices/index.server',
		refused('pastBarrel', 'orders', 'invoices'),
	],
	[
		'src/components/table.tsx',
		'@/features/identity/hooks/b',
		refused('sharedImportsFeature', 'src/components', 'identity'),
	],
	[
		'src/lib/format.ts',
		'../features/orders',
		refused('sharedImportsFeature', 'src/lib', 'orders'),
	],
	['src/components/table.tsx', '@/lib/format', null],
	['src/routes/orders.tsx', '@/features/orders/lib/b', null],
	['src/router.tsx', '@/features/orders/lib/b', null],
	['src/server.ts', '@/features/orders/lib/b', null],
	['src/testing/render.tsx', '@/features/orders/lib/b', null],
	['src/__tests__/orders.test.tsx', '@/features/orders/lib/b', null],
	['src/features/identity/lib/a.test.ts', '@/features/orders/lib/b', null],
	['src/components/table.test.tsx', '@/features/orders/lib/b', null],
] as const;

// Catches: a template feature reaching into an Application feature (so a derived repo breaks when it deletes that feature), one Application feature reaching past another's `index.ts`, or a shared folder quietly becoming a feature, and lint missing it because the path is relative; or lint refusing an import the boundaries allow.
it.each(imports)('%s imports %s', (file, specifier, expected) => {
	expect(importViolation(file, specifier, templateFeatures)).toEqual(expected);
});

const barrelStatements = [
	['ExportNamedDeclaration', './lib/orders', null],
	['ExportNamedDeclaration', './components/orders-list', null],
	['ExportAllDeclaration', './lib/orders', 'exportAll'],
	['ExportNamedDeclaration', null, 'notReExport'],
	['ImportDeclaration', './lib/orders', 'notReExport'],
	['VariableDeclaration', null, 'notReExport'],
	['ExportDefaultDeclaration', null, 'notReExport'],
	['ExportNamedDeclaration', './lib/orders.server', 'serverReExport'],
	['ExportNamedDeclaration', './lib/orders.server.ts', 'serverReExport'],
	[
		'ExportNamedDeclaration',
		'@/features/orders/lib/orders.server',
		'serverReExport',
	],
	['ExportNamedDeclaration', './lib/server-time', null],
] as const;

// Catches: an Application feature's `index.ts` growing an `export *`, its own code or a `.server.ts` re-export, so its public surface stops being a deliberate list and server code can reach the client through it.
it.each(barrelStatements)('%s from %s', (type, source, expected) => {
	expect(barrelViolation(type, source)).toBe(expected);
});
