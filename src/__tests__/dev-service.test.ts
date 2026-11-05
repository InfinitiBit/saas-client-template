import { devHandlers } from '@/features/api/lib/dev-service';
import { server } from '@/testing/msw';

// Every path in the spec has a hand-written handler, so they are switched off
// to reach a path only the generated handlers answer.
// oxlint-disable-next-line anti-slop/no-module-mocking
vi.mock('@/features/notes/lib/notes-mock', () => ({ notesHandlers: () => [] }));

test('answers a path with no hand-written handler from the generated mock', async () => {
	server.use(...devHandlers());

	const response = await fetch('http://localhost/api/notes');

	expect(response.status).toBe(200);
	expect(await response.json()).toMatchObject({
		items: expect.any(Array),
		total: expect.any(Number),
	});
});
