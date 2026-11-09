import { getRequest } from '@tanstack/react-start/server';
import { toast } from 'sonner';

import { server } from './msw';

// Tests run without Start's compiler, which is what turns a server function
// into an RPC, and Start ships no runtime for one outside its server. Here the
// handler runs in-process, as it does during SSR.
// oxlint-disable-next-line anti-slop/no-module-mocking
vi.mock('@tanstack/react-start', async (importOriginal) => ({
	...(await importOriginal<typeof import('@tanstack/react-start')>()),
	createServerFn: () => ({ handler: <T>(fn: () => T) => fn }),
}));

// The request a server function sees is the browser's: jsdom's address and
// cookie jar. A `vi.fn`, so a test can answer as the server did before the
// browser held the cookie.
// oxlint-disable-next-line anti-slop/no-module-mocking
vi.mock('@tanstack/react-start/server', async (importOriginal) => ({
	...(await importOriginal<typeof import('@tanstack/react-start/server')>()),
	getRequest: vi.fn(
		() => new Request(location.href, { headers: { cookie: document.cookie } }),
	),
}));

// jsdom lays nothing out and leaves `scrollTo` unimplemented; the router calls
// it after every navigation. Guarded for suites that run under `node`.
if (typeof window !== 'undefined') {
	window.scrollTo = () => undefined;
}

beforeAll(() => {
	server.listen({ onUnhandledFrame: 'error' });
});

afterEach(() => {
	server.resetHandlers();
	vi.mocked(getRequest).mockReset();
	// sonner holds its toasts at module scope, past the Toaster that drew them.
	toast.dismiss();

	if (typeof document !== 'undefined')
		for (const cookie of document.cookie.split('; ').filter(Boolean))
			document.cookie = `${cookie.split('=')[0]}=; Path=/; Secure; Max-Age=0`;
});

afterAll(() => {
	server.close();
});
