import { getExampleServiceMock } from '@/features/api/generated/service.msw';
import {
	devHandlers,
	generatedHandlers,
	requestSeed,
} from '@/features/api/lib/dev-service';
import { server } from '@/testing/msw';

const notes = (query: string) =>
	fetch(`http://localhost/api/notes${query}`).then((response) =>
		response.json(),
	);

test('answers a path with no hand-written handler from the generated mock', async () => {
	server.use(...devHandlers([]));

	const response = await fetch('http://localhost/api/notes');

	expect(response.status).toBe(200);
	expect(await response.json()).toMatchObject({
		items: expect.any(Array),
		total: expect.any(Number),
	});
});

test('seeds a request from its method, path and query, whatever the port', () => {
	const seed = requestSeed('GET', 'http://localhost:3160/api/notes?page=1');

	expect(requestSeed('GET', 'http://localhost:3161/api/notes?page=1')).toBe(
		seed,
	);
	expect(requestSeed('GET', 'http://localhost:3160/api/notes?page=2')).not.toBe(
		seed,
	);
	expect(
		requestSeed('POST', 'http://localhost:3160/api/notes?page=1'),
	).not.toBe(seed);
	expect(requestSeed('GET', 'http://localhost:3160/api/note?page=1')).not.toBe(
		seed,
	);
});

test('answers the same request with the same data, on any day and in any order', async () => {
	vi.useFakeTimers({ toFake: ['Date'] });
	server.use(...generatedHandlers());

	vi.setSystemTime('2026-01-01');
	const first = await notes('?page=2');
	await notes('?page=1');
	vi.setSystemTime('2027-06-30');
	const again = await notes('?page=2');

	vi.useRealTimers();
	expect(again).toEqual(first);
});

test('answers different queries on one path with different data', async () => {
	server.use(...generatedHandlers());

	expect(await notes('?page=2')).not.toEqual(await notes('?page=1'));
});

test('seeds every generated handler', () => {
	const headers = (handlers: { info: { header: string } }[]) =>
		handlers.map((handler) => handler.info.header).sort();

	expect(headers(generatedHandlers())).toEqual(
		headers(getExampleServiceMock()),
	);
});
