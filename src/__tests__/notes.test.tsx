import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';

import type { Note } from '@/features/api/generated/service.schemas';
import { IDENTITY_PATH } from '@/features/api/lib/api';
import {
	createdNotes,
	pagedNotes,
	sampleNotes,
} from '@/features/notes/lib/notes-mock';
import { cookieName } from '@/paraglide/runtime';
import { server } from '@/testing/msw';
import { renderRouter } from '@/testing/render-router';
import { holdSession } from '@/testing/session';

const notes: Note[] = Array.from({ length: 25 }, (_, index) => ({
	id: `note-${index + 1}`,
	title: `Note ${index + 1}`,
	body: `Body of note ${index + 1}`,
	created_at: '2026-09-01T09:30:00Z',
}));

beforeEach(() => {
	vi.stubEnv('APP_MODE', 'saas');
	holdSession();
	server.use(
		http.get(`${location.origin}${IDENTITY_PATH}`, () =>
			HttpResponse.json({
				email: 'ada@example.com',
				workspace: 'acme',
				roles: [],
				permissions: [],
			}),
		),
	);
});

afterEach(() => {
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
	vi.useRealTimers();
});

const titles = () =>
	within(screen.getAllByRole('rowgroup')[1])
		.getAllByRole('row')
		.map((row) => within(row).getAllByRole('cell')[0].textContent);

const goToPage = (page: number) =>
	fireEvent.click(
		within(screen.getByRole('navigation', { name: 'Pages' })).getByRole(
			'button',
			{ name: new RegExp(`${page}`) },
		),
	);

it('lists the first page of Notes from the Service', async () => {
	server.use(pagedNotes(notes));

	await renderRouter('/notes');

	expect(await screen.findByRole('cell', { name: 'Note 1' })).toBeTruthy();
	expect(titles()).toHaveLength(20);
	expect(titles().at(-1)).toBe('Note 20');
});

it('pages through the Notes on the Service', async () => {
	server.use(pagedNotes(notes));

	await renderRouter('/notes');
	await screen.findByRole('cell', { name: 'Note 1' });
	goToPage(2);

	expect(await screen.findByRole('cell', { name: 'Note 21' })).toBeTruthy();
	expect(titles()).toEqual([
		'Note 21',
		'Note 22',
		'Note 23',
		'Note 24',
		'Note 25',
	]);
});

it('opens the page a link names', async () => {
	server.use(pagedNotes(notes));

	const router = await renderRouter('/notes?page=2');

	expect(await screen.findByRole('cell', { name: 'Note 21' })).toBeTruthy();
	expect(router.state.location.searchStr).toBe('?page=2');
});

it('opens a malformed link at the first page, and cleans the address', async () => {
	server.use(pagedNotes(notes));

	const router = await renderRouter('/notes?page=abc&size=0&search=[1]');

	expect(await screen.findByRole('cell', { name: 'Note 1' })).toBeTruthy();
	expect(titles()).toHaveLength(20);
	expect(router.state.location.href).toBe('/notes');
});

it('leaves the defaults out of the address', async () => {
	server.use(pagedNotes(notes));

	const router = await renderRouter('/notes?page=1&size=20');

	await screen.findByRole('cell', { name: 'Note 1' });
	expect(router.state.location.href).toBe('/notes');
});

it('keeps the page in the address, where Back returns to it', async () => {
	server.use(pagedNotes(notes));

	const router = await renderRouter('/notes');
	await screen.findByRole('cell', { name: 'Note 1' });
	goToPage(2);

	await screen.findByRole('cell', { name: 'Note 21' });
	expect(router.state.location.searchStr).toBe('?page=2');

	router.history.back();

	expect(await screen.findByRole('cell', { name: 'Note 1' })).toBeTruthy();
});

it('searches once typing stops, from the first page, in the same history entry', async () => {
	const searched: string[] = [];
	server.use(
		http.get(`${location.origin}/api/notes`, ({ request }) => {
			const search = new URL(request.url).searchParams.get('search');

			if (search !== null) searched.push(search);
		}),
		pagedNotes(notes),
	);

	const router = await renderRouter('/notes?page=2');
	await screen.findByRole('cell', { name: 'Note 21' });
	const entries = router.history.length;

	const field = screen.getByRole<HTMLInputElement>('searchbox', {
		name: 'Search notes',
	});

	for (const typed of ['n', 'no', 'not', 'note', 'note ', 'note 2'])
		fireEvent.change(field, { target: { value: typed } });

	expect(field.value).toBe('note 2');
	expect(router.state.location.searchStr).toBe('?page=2');

	await waitFor(() => expect(titles()[0]).toBe('Note 2'));
	expect(titles()).toEqual([
		'Note 2',
		'Note 20',
		'Note 21',
		'Note 22',
		'Note 23',
		'Note 24',
		'Note 25',
	]);
	expect(
		new URLSearchParams(router.state.location.searchStr).get('search'),
	).toBe('note 2');
	expect(router.state.location.search).not.toHaveProperty('page');
	expect(router.history.length).toBe(entries);
	expect(searched).toEqual(['note 2']);
});

it('says so when nothing matches the search', async () => {
	server.use(pagedNotes(notes));

	await renderRouter('/notes?search=zebra');

	expect(await screen.findByText('No notes match “zebra”.')).toBeTruthy();
});

it('keeps the current page on screen while the next one loads', async () => {
	let answer: () => void = () => undefined;

	const answered = new Promise<void>((resolve) => {
		answer = resolve;
	});

	let asked = false;
	server.use(
		// Holds the second page back, then falls through to the paged handler.
		http.get(`${location.origin}/api/notes`, async ({ request }) => {
			if (new URL(request.url).searchParams.get('page') !== '2') return;
			asked = true;
			await answered;
		}),
		pagedNotes(notes),
	);

	await renderRouter('/notes');
	await screen.findByRole('cell', { name: 'Note 1' });
	goToPage(2);

	await waitFor(() => expect(asked).toBe(true));
	expect(screen.getByRole('cell', { name: 'Note 1' })).toBeTruthy();
	expect(screen.queryByText('Loading notes')).toBeNull();

	answer();

	expect(await screen.findByRole('cell', { name: 'Note 21' })).toBeTruthy();
});

it('reopens the search and page an address holds', async () => {
	server.use(pagedNotes(notes));

	await renderRouter('/notes?page=2&search=note');

	expect(await screen.findByRole('cell', { name: 'Note 21' })).toBeTruthy();
	expect(
		screen.getByRole<HTMLInputElement>('searchbox', { name: 'Search notes' })
			.value,
	).toBe('note');
});

it('follows the address when Back changes the search', async () => {
	server.use(pagedNotes(notes));

	const router = await renderRouter('/notes');
	await screen.findByRole('cell', { name: 'Note 1' });
	await router.navigate({ to: '/notes', search: { search: 'note 2' } });

	const field = screen.getByRole<HTMLInputElement>('searchbox', {
		name: 'Search notes',
	});

	await waitFor(() => expect(field.value).toBe('note 2'));

	router.history.back();

	await waitFor(() => expect(field.value).toBe(''));
	expect(await screen.findByRole('cell', { name: 'Note 1' })).toBeTruthy();
});

it('drops a search still being typed when Back moves away from it', async () => {
	server.use(pagedNotes(notes));

	const router = await renderRouter('/notes');
	await screen.findByRole('cell', { name: 'Note 1' });
	await router.navigate({ to: '/notes', search: { search: 'note 1' } });

	const field = screen.getByRole<HTMLInputElement>('searchbox', {
		name: 'Search notes',
	});

	await waitFor(() => expect(field.value).toBe('note 1'));
	fireEvent.change(field, { target: { value: 'note 2' } });

	router.history.back();
	await waitFor(() => expect(field.value).toBe(''));
	await new Promise((settle) => setTimeout(settle, 500));

	expect(router.state.location.href).toBe('/notes');
});

it("copies a Note's text from its row", async () => {
	const writeText = vi.fn(() => Promise.resolve());

	vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
	server.use(pagedNotes(notes));

	await renderRouter('/notes');
	fireEvent.click(
		await screen.findByRole('button', { name: 'Copy text of Note 2' }),
	);

	expect(writeText).toHaveBeenCalledWith('Body of note 2');
});

it('says so when there are no Notes', async () => {
	server.use(pagedNotes([]));

	await renderRouter('/notes');

	expect(await screen.findByText('No notes yet.')).toBeTruthy();
});

it('draws the Session gate when the Service refuses the Session', async () => {
	server.use(
		http.get(`${location.origin}/api/notes`, () =>
			HttpResponse.json(
				{ detail: 'Not authenticated', error_code: 'NOT_AUTHENTICATED' },
				{ status: 401 },
			),
		),
	);

	await renderRouter('/notes');

	expect(
		await screen.findByRole('heading', { name: 'Sign in to continue' }),
	).toBeTruthy();
});

it('keeps any other failure on the Screen, once the retries are spent', async () => {
	vi.useFakeTimers({ shouldAdvanceTime: true });
	server.use(
		http.get(`${location.origin}/api/notes`, () =>
			HttpResponse.json({ detail: 'Boom' }, { status: 500 }),
		),
	);

	await renderRouter('/notes');
	await vi.advanceTimersByTimeAsync(10_000);

	expect(
		await screen.findByText('The notes could not be loaded.'),
	).toBeTruthy();
});

it('reaches the Notes from the top bar', async () => {
	server.use(pagedNotes(notes));

	await renderRouter('/');
	fireEvent.click(
		within(screen.getByRole('navigation', { name: 'Application' })).getByRole(
			'link',
			{ name: 'Notes' },
		),
	);

	expect(await screen.findByRole('cell', { name: 'Note 1' })).toBeTruthy();
});

describe('creating a Note', () => {
	const openNewNote = async () => {
		fireEvent.click(await screen.findByRole('button', { name: 'New note' }));

		return screen.findByRole('dialog', { name: 'New note' });
	};

	it('opens ready to type the title', async () => {
		server.use(pagedNotes(notes));

		await renderRouter('/notes');
		const dialog = await openNewNote();

		await vi.waitFor(() =>
			expect(document.activeElement).toBe(
				within(dialog).getByRole('textbox', { name: 'Title' }),
			),
		);
	});

	it('says nothing is wrong until the first submit, then what is', async () => {
		server.use(pagedNotes(notes));

		await renderRouter('/notes');
		const dialog = await openNewNote();
		const title = within(dialog).getByRole('textbox', { name: 'Title' });

		fireEvent.change(title, { target: { value: 'x' } });
		fireEvent.change(title, { target: { value: '' } });
		expect(title.getAttribute('aria-invalid')).not.toBe('true');
		expect(within(dialog).queryByRole('alert')).toBeNull();

		fireEvent.click(within(dialog).getByRole('button', { name: 'Create' }));

		expect(await within(dialog).findByText('Enter a title.')).toBeTruthy();
		expect(title.getAttribute('aria-invalid')).toBe('true');
	});

	it('announces the error on an empty submit, on a title marked required', async () => {
		server.use(pagedNotes(notes));

		await renderRouter('/notes');
		const dialog = await openNewNote();
		const title = within(dialog).getByRole('textbox', { name: 'Title' });

		expect(title.getAttribute('aria-required')).toBe('true');

		fireEvent.click(within(dialog).getByRole('button', { name: 'Create' }));

		expect((await within(dialog).findByRole('alert')).textContent).toBe(
			'Enter a title.',
		);
		expect(title.getAttribute('aria-invalid')).toBe('true');
	});

	it('clears an error as soon as the field is corrected', async () => {
		server.use(pagedNotes(notes));

		await renderRouter('/notes');
		const dialog = await openNewNote();
		const title = within(dialog).getByRole('textbox', { name: 'Title' });

		fireEvent.click(within(dialog).getByRole('button', { name: 'Create' }));
		await within(dialog).findByText('Enter a title.');
		fireEvent.change(title, { target: { value: 'Groceries' } });

		await vi.waitFor(() =>
			expect(within(dialog).queryByText('Enter a title.')).toBeNull(),
		);
		expect(title.getAttribute('aria-invalid')).not.toBe('true');

		fireEvent.change(title, { target: { value: 'x'.repeat(201) } });

		expect(
			await within(dialog).findByText(
				'Keep the title to 200 characters or fewer.',
			),
		).toBeTruthy();
	});

	it('creates the Note, says so and shows it in the list', async () => {
		const stored = [...notes];
		server.use(pagedNotes(stored), createdNotes(stored));

		await renderRouter('/notes');
		const dialog = await openNewNote();
		fireEvent.change(within(dialog).getByRole('textbox', { name: 'Title' }), {
			target: { value: 'Groceries' },
		});
		fireEvent.change(within(dialog).getByRole('textbox', { name: 'Text' }), {
			target: { value: 'Milk, eggs' },
		});
		fireEvent.click(within(dialog).getByRole('button', { name: 'Create' }));

		expect(await screen.findByText('Note created.')).toBeTruthy();
		expect(await screen.findByRole('cell', { name: 'Groceries' })).toBeTruthy();
		expect(titles()[0]).toBe('Groceries');
		expect(screen.queryByRole('dialog')).toBeNull();
	});

	it('keeps the dialog and what was typed when the Service fails', async () => {
		server.use(
			pagedNotes(notes),
			http.post(`${location.origin}/api/notes`, () =>
				HttpResponse.json({ detail: 'Boom' }, { status: 500 }),
			),
		);

		await renderRouter('/notes');
		const dialog = await openNewNote();
		const title = within(dialog).getByRole('textbox', { name: 'Title' });
		fireEvent.change(title, { target: { value: 'Groceries' } });
		fireEvent.click(within(dialog).getByRole('button', { name: 'Create' }));

		expect(
			await within(dialog).findByText('The note could not be created.'),
		).toBeTruthy();
		expect(title).toHaveProperty('value', 'Groceries');
	});

	it('draws the Session gate when the Service refuses the create', async () => {
		server.use(
			pagedNotes(notes),
			http.post(`${location.origin}/api/notes`, () =>
				HttpResponse.json(
					{ detail: 'Not authenticated', error_code: 'NOT_AUTHENTICATED' },
					{ status: 401 },
				),
			),
		);

		await renderRouter('/notes');
		const dialog = await openNewNote();
		fireEvent.change(within(dialog).getByRole('textbox', { name: 'Title' }), {
			target: { value: 'Groceries' },
		});
		fireEvent.click(within(dialog).getByRole('button', { name: 'Create' }));

		expect(
			await screen.findByRole('heading', { name: 'Sign in to continue' }),
		).toBeTruthy();
	});

	it('says what is wrong in German under de', async () => {
		document.cookie = `${cookieName}=de`;
		server.use(pagedNotes(notes));

		await renderRouter('/notes');
		fireEvent.click(await screen.findByRole('button', { name: 'Neue Notiz' }));
		const dialog = await screen.findByRole('dialog', { name: 'Neue Notiz' });
		fireEvent.click(within(dialog).getByRole('button', { name: 'Erstellen' }));

		expect(
			await within(dialog).findByText('Geben Sie einen Titel ein.'),
		).toBeTruthy();
	});
});

test('gives the Notes sample short and long titles from the edge pool', () => {
	const lengths = sampleNotes().map((note) => note.title.length);

	expect(lengths).toContain(2);
	expect(lengths).toContain(200);
});
