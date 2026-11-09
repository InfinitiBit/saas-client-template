import { lintSource } from './lint-source';
import { layoutViolation } from './plugin';

const templateFeatures = ['api', 'auth', 'brand', 'shell'];

const rows = [
	['src/server/session.ts', 'serverFolder'],
	['src/server/lib/session.server.ts', 'serverFolder'],
	['src/server.ts', null],
	['src/env.server.ts', null],
	['src/features/orders/lib/orders.server.ts', null],
	['src/features/auth/lib/session.server.ts', null],
	['src/routes/orders.server.ts', 'serverModule'],
	['src/components/table.server.ts', 'serverModule'],
	['src/testing/session.server.ts', 'serverModule'],
	['src/features/orders/components/orders-list.tsx', null],
	['src/features/orders/hooks/orders.ts', null],
	['src/features/orders/lib/orders-mock.ts', null],
	['src/features/orders/lib/deep/folder/anything.ts', null],
	['src/features/orders/index.ts', null],
	['src/features/orders/billing/components/invoice.tsx', null],
	['src/features/orders/billing/lib/totals.ts', null],
	['src/features/api/generated/service.ts', null],
	['src/features/orders/generated/service.ts', 'featureFolder'],
	['src/features/auth/index.ts', 'featureFolder'],
	['src/features/orders/orders.ts', 'featureFolder'],
	['src/features/orders/index.tsx', 'featureFolder'],
	['src/features/orders/utils/format.ts', 'featureFolder'],
	['src/features/orders/billing/index.ts', 'featureFolder'],
	['src/features/orders/billing/utils/format.ts', 'featureFolder'],
	['src/features/orders/billing/refunds/lib/refund.ts', 'featureFolder'],
	['src/routes/_authenticated.orders.tsx', null],
	['src/application.ts', null],
	['lint/plugin.ts', null],
] as const;

// Catches: a file landing in a second home (`src/server/`, a stray `.server.ts`, a loose file or `utils/` in a feature) without lint saying so, or lint refusing a file that sits where AGENTS.md → Layout puts it.
it.each(rows)('%s → %s', (file, expected) => {
	expect(layoutViolation(file, templateFeatures)).toBe(expected);
});

// Catches: `pnpm lint` silently skipping the rule or dropping its template-feature option, or app code that already breaks the layout.
it('local/layout passes over the real source', () => {
	const { status, stdout, stderr } = lintSource('local/layout');

	expect(status, stdout + stderr).toBe(0);
});
