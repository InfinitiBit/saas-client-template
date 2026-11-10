import { getRequest } from '@tanstack/react-start/server';
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';

import { pagedNotes } from '@/features/notes/lib/notes-mock';
import { server } from '@/testing/msw';
import { renderRouter } from '@/testing/render-router';
import { holdSession } from '@/testing/session';

const TOKEN = 'header.payload.signature';

let adopted: { body: unknown; addressBar: string }[] = [];

beforeEach(() => {
	vi.stubEnv('APP_MODE', 'saas');
	adopted = [];
	server.use(
		http.post(`${location.origin}/session`, async ({ request }) => {
			adopted.push({ body: await request.json(), addressBar: location.href });
			// Where the real route's Set-Cookie would land.
			holdSession();

			return new HttpResponse(null, { status: 204 });
		}),
	);
});

afterEach(() => {
	vi.unstubAllEnvs();
});

async function launchAt(address: string) {
	history.replaceState(null, '', address);
	await renderRouter(location.pathname);
}

// Catches: a Launch leaving its tokens in the address bar where history and screenshots keep them, or a user landing signed out after a Launch.
it.for([
	['a SaaS Launch onto a tenant slug', '/acme'],
	["gt's Standalone sign-in callback", '/auth/callback'],
])(
	'adopts %s, with the credentials out of the address bar first',
	async ([, arrival]) => {
		await launchAt(`${arrival}#token=${TOKEN}&refresh_token=r1`);

		expect(adopted).toEqual([
			{
				body: { token: TOKEN, refresh_token: 'r1' },
				addressBar: `${location.origin}${arrival}`,
			},
		]);
		expect(location.hash).toBe('');
		expect((await screen.findByRole('status')).textContent).toBe(
			'The template is running.',
		);
	},
);

// Catches: a Launch checking the Session more than once, adding a round trip before the first screen.
it('checks the Session once after a Launch onto a tenant slug', async () => {
	await launchAt(`/acme#token=${TOKEN}`);

	expect(await screen.findByRole('link', { name: 'Notes' })).toBeTruthy();
	expect(getRequest).toHaveBeenCalledTimes(1);
});

// Catches: a Launch from a platform that sends no refresh token being refused, leaving the user on the sign-in card.
it('adopts a Launch without a refresh token', async () => {
	await launchAt(`/acme#token=${TOKEN}`);

	expect(adopted.map(({ body }) => body)).toEqual([{ token: TOKEN }]);
});

// Catches: a stray refresh token lingering in the address bar, or adopted without the token it belongs to.
it('strips a refresh token that arrived without a token, adopting nothing', async () => {
	await launchAt('/acme#refresh_token=r1');

	expect(adopted).toEqual([]);
	expect(location.hash).toBe('');
});

// Catches: an ordinary visit posting an empty Launch and wiping the Session the user already holds.
it('adopts nothing when the address carries no Launch', async () => {
	await launchAt('/');

	expect(adopted).toEqual([]);
});

// The server draws the layout before the browser adopts the Launch: a fragment
// never reaches it, so its Session check comes without the cookie.
function checkSessionAsTheServerDid() {
	vi.mocked(getRequest).mockImplementationOnce(
		() => new Request(location.href),
	);
}

// Catches: a user Launched onto `/` or `/notes` seeing the sign-in card because the server drew the page before the Session was adopted.
it.for(['/', '/notes'])(
	'lands a Launch adopted at %s inside the Application',
	async (arrival) => {
		server.use(pagedNotes([]));
		checkSessionAsTheServerDid();

		await launchAt(`${arrival}#token=${TOKEN}`);

		expect(await screen.findByRole('link', { name: 'Notes' })).toBeTruthy();
		expect(screen.queryByText('Sign in to continue')).toBeNull();
	},
);

// Catches: a refused Launch dropping the user on a blank screen or looping on Session checks instead of showing the sign-in card.
it('keeps a refused Launch on the sign-in card, checking the Session once', async () => {
	server.use(
		http.post(`${location.origin}/session`, async ({ request }) => {
			adopted.push({ body: await request.json(), addressBar: location.href });

			return new HttpResponse(null, { status: 400 });
		}),
	);
	checkSessionAsTheServerDid();

	await launchAt(`/#token=${TOKEN}`);

	expect((await screen.findByRole('heading', { level: 1 })).textContent).toBe(
		'Sign in to continue',
	);
	expect(adopted).toHaveLength(1);
	expect(getRequest).toHaveBeenCalledTimes(1);
});

// Catches: every page load checking the Session twice, adding a round trip before the first screen.
it('checks the Session once on a document with no Launch', async () => {
	holdSession();

	await launchAt('/');

	expect(await screen.findByRole('link', { name: 'Notes' })).toBeTruthy();
	expect(getRequest).toHaveBeenCalledTimes(1);
});
