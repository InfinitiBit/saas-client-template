import { faker } from '@faker-js/faker';

import {
	getCreateNoteMockHandler,
	getCreateNoteResponseMock,
	getListNotesMockHandler,
} from '@/features/api/generated/service.msw';
import type {
	Note,
	NoteCreate,
} from '@/features/api/generated/service.schemas';

/** Enough Notes to page through, the same ones on every reload. */
export function sampleNotes() {
	faker.seed(1);

	return Array.from({ length: 45 }, () =>
		getCreateNoteResponseMock({
			title: faker.lorem.sentence({ min: 2, max: 6 }),
			body: faker.lorem.sentences(2),
		}),
	).sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/** `POST /api/notes` stored at the front of `notes`, newest first as the Service lists it. */
export function createdNotes(notes: Note[]) {
	return getCreateNoteMockHandler(async ({ request }) => {
		const note = getCreateNoteResponseMock({
			// SAFETY: only the generated client posts here, and it sends a NoteCreate.
			...((await request.json()) as NoteCreate),
			created_at: new Date().toISOString(),
		});

		notes.unshift(note);

		return note;
	});
}

/** `GET /api/notes` answered from `notes`, searched and paged as the Service does. */
export function pagedNotes(notes: Note[]) {
	return getListNotesMockHandler(({ request }) => {
		const { searchParams } = new URL(request.url);
		const page = Number(searchParams.get('page') ?? 1);
		const size = Number(searchParams.get('size') ?? 20);
		const search = searchParams.get('search')?.toLowerCase() ?? '';

		const matches = notes.filter((note) =>
			`${note.title}\n${note.body}`.toLowerCase().includes(search),
		);

		return {
			items: matches.slice((page - 1) * size, page * size),
			total: matches.length,
			page,
			size,
		};
	});
}
