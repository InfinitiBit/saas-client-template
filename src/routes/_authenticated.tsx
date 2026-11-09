import { Outlet, createFileRoute } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { getRequest, getResponseHeaders } from '@tanstack/react-start/server';

import { SessionGate } from '@/features/auth/components/session-gate';
import { settleSession } from '@/features/auth/lib/session.server';
import { Shell } from '@/features/shell/components/shell';
import { m } from '@/paraglide/messages';

const readSettledSession = createServerFn({ method: 'GET' }).handler(() =>
	settleSession(getRequest(), getResponseHeaders()),
);

// Every Application Screen sits below this layout, so the first byte already
// holds the gate or the Application (ADR 0007).
export const Route = createFileRoute('/_authenticated')({
	loader: async () => ({ live: await readSettledSession() }),
	// Settled for the document: a Session that ends later is met as a refusal.
	staleTime: Infinity,
	component: Authenticated,
});

function Authenticated() {
	return Route.useLoaderData().live ? (
		<Shell
			nav={[
				{ to: '/', label: m.shell_nav_home() },
				{ to: '/notes', label: m.shell_nav_notes() },
			]}
		>
			<Outlet />
		</Shell>
	) : (
		<SessionGate state="no-session" />
	);
}
