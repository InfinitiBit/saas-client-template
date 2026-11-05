import { http, HttpResponse } from 'msw';
import { setupWorker } from 'msw/browser';

import { IDENTITY_PATH, type Identity } from '@/features/api/lib/api';
import {
	createdNotes,
	pagedNotes,
	sampleNotes,
} from '@/features/notes/lib/notes-mock';

const devIdentity: Identity = {
	email: 'dev@example.com',
	workspace: 'dev',
	roles: [],
	permissions: [],
};

export async function startDevService() {
	const notes = sampleNotes();

	await setupWorker(
		http.get(IDENTITY_PATH, () => HttpResponse.json(devIdentity)),
		pagedNotes(notes),
		createdNotes(notes),
	).start({
		onUnhandledFrame: 'bypass',
		quiet: true,
	});
}
