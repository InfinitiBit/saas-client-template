import { devHandlers } from '@/features/api/lib/dev-service';
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
