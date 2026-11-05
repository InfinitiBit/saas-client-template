import { faker } from '@faker-js/faker';
import { http, HttpResponse, type RequestHandler } from 'msw';
import { setupWorker } from 'msw/browser';

import {
	getCreateNoteMockHandler,
	getCreateNoteResponseMock,
	getListNotesMockHandler,
	getListNotesResponseMock,
} from '@/features/api/generated/service.msw';
import { IDENTITY_PATH, type Identity } from '@/features/api/lib/api';
import {
	createdNotes,
	pagedNotes,
	sampleNotes,
} from '@/features/notes/lib/notes-mock';

// Relative dates count back from now, which moves between runs.
faker.setDefaultRefDate('2026-01-01T00:00:00Z');

const devIdentity: Identity = {
	email: 'dev@example.com',
	workspace: 'dev',
	roles: [],
	permissions: [],
};

/** A faker seed from a request's method, path and query (FNV-1a), never its host or port. */
export function requestSeed(method: string, url: string) {
	const { pathname, search } = new URL(url);
	let hash = 0x811c9dc5;

	for (const char of `${method} ${pathname}${search}`)
		hash = Math.imul(hash ^ char.charCodeAt(0), 0x01000193);

	return hash >>> 0;
}

// Seeded and drawn with nothing awaited between: faker is shared by every request in flight.
function seeded<T>(draw: () => T) {
	return ({ request }: { request: Request }) => {
		faker.seed(requestSeed(request.method, request.url));

		return draw();
	};
}

export function generatedHandlers() {
	return [
		getListNotesMockHandler(seeded(getListNotesResponseMock)),
		getCreateNoteMockHandler(seeded(getCreateNoteResponseMock)),
	];
}

// A glob, not an import: the scenario is git-ignored and usually absent.
const scenarios = import.meta.glob<RequestHandler[]>('./dev-scenario.ts', {
	eager: true,
	import: 'devScenario',
});

/** The dev Service's handlers, in the order MSW tries them: the first match answers. */
export function devHandlers(handWritten: RequestHandler[]) {
	return [
		...(scenarios['./dev-scenario.ts'] ?? []),
		http.get(IDENTITY_PATH, () => HttpResponse.json(devIdentity)),
		...handWritten,
		...generatedHandlers(),
	];
}

export async function startDevService() {
	const notes = sampleNotes();

	await setupWorker(
		...devHandlers([pagedNotes(notes), createdNotes(notes)]),
	).start({
		onUnhandledFrame: 'bypass',
		quiet: true,
	});
}
