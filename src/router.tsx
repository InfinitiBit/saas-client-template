import { setIconSprite } from '@infinitibit_gmbh/ui/icons';
import iconSprite from '@infinitibit_gmbh/ui/icons.svg?url';
import { QueryClient } from '@tanstack/react-query';
import { createRouter } from '@tanstack/react-router';
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query';

import {
	RouterError,
	sessionGate,
} from '@/features/auth/components/session-gate';
import { adoptLaunch } from '@/features/auth/lib/launch';

import { routeTree } from './routeTree.gen';

// Module scope: the server and the browser both enter through here, and every
// `<Icon>` needs the sprite before the first render.
setIconSprite(iconSprite);

// Thrown to the gate, never retried: an ended Session does not come back.
// Anything else stays on the Screen that asked.
const isSessionError = (error: Error) => sessionGate.parse(error) !== null;

export async function getRouter() {
	// Before the router reads the address bar, so no screen ever sees the
	// credentials. A fragment never reaches the server, so this is browser-only.
	if (!import.meta.env.SSR) await adoptLaunch();

	// `pnpm dev:mock` alone: tests run as `test`, and a build drops the worker and its sample data.
	if (!import.meta.env.SSR && import.meta.env.MODE === 'mock')
		await (await import('@/features/api/lib/dev-service')).startDevService();

	// Per router, so one reader's data never lands in another's SSR.
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: {
				retry: (failures, error) => !isSessionError(error) && failures < 3,
				throwOnError: isSessionError,
			},
			// Left at no retries: a replayed write can land twice.
			mutations: { throwOnError: isSessionError },
		},
	});

	const router = createRouter({
		routeTree,
		defaultPreload: 'intent',
		defaultErrorComponent: RouterError,
	});

	setupRouterSsrQueryIntegration({ router, queryClient });

	return router;
}
