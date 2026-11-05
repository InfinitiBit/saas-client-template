import { devHandlers, requestSeed } from '@/features/api/lib/dev-service';
import { server } from '@/testing/msw';

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
