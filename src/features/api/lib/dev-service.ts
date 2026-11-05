import { http, HttpResponse, type RequestHandler } from 'msw';
import { setupWorker } from 'msw/browser';

import { getExampleServiceMock } from '@/features/api/generated/service.msw';
import { IDENTITY_PATH, type Identity } from '@/features/api/lib/api';
import { notesHandlers } from '@/features/notes/lib/notes-mock';

const devIdentity: Identity = {
	email: 'dev@example.com',
	workspace: 'dev',
	roles: [],
	permissions: [],
};

// A glob, not an import: the scenario is git-ignored and usually absent.
const scenarios = import.meta.glob<RequestHandler[]>('./dev-scenario.ts', {
	eager: true,
	import: 'devScenario',
});

/** The dev Service's handlers, in the order MSW tries them: the first match answers. */
export function devHandlers() {
	return [
		...(scenarios['./dev-scenario.ts'] ?? []),
		http.get(IDENTITY_PATH, () => HttpResponse.json(devIdentity)),
		...notesHandlers(),
		...getExampleServiceMock(),
	];
}

export async function startDevService() {
	await setupWorker(...devHandlers()).start({
		onUnhandledFrame: 'bypass',
		quiet: true,
	});
}
