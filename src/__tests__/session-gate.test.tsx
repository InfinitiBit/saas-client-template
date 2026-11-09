import { getResponseHeaders } from '@tanstack/react-start/server';
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { z } from 'zod';

import { APPLICATION_NAME } from '@/application';
import { server } from '@/testing/msw';
import { renderRouter } from '@/testing/render-router';
import { holdSession, tokenWith } from '@/testing/session';

const APPLICATION = 'The template is running.';

const ENDED = [
	`__Host-${APPLICATION_NAME}-session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`,
	`__Host-${APPLICATION_NAME}-refresh=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`,
];

const now = () => Math.floor(Date.now() / 1000);

const PLATFORM_AUTH_URL = 'https://auth.platform.example.com';

const GT_URL = 'https://gt.example.com';

const RENEWED = tokenWith({ exp: now() + 900 });

const held = (name: string, value: string) =>
	`__Host-${APPLICATION_NAME}-${name}=${value}; HttpOnly; Secure; SameSite=Lax; Path=/`;

beforeEach(() => {
	vi.stubEnv('APP_MODE', 'saas');
	vi.stubEnv('PLATFORM_AUTH_URL', PLATFORM_AUTH_URL);
	vi.stubEnv('GT_SERVER_URL', GT_URL);
});

afterEach(() => {
	vi.unstubAllEnvs();
});

async function expectSignInCard() {
	expect((await screen.findByRole('heading', { level: 1 })).textContent).toBe(
		'Sign in to continue',
	);
	expect(screen.queryByText(APPLICATION)).toBeNull();
}

it('draws the sign-in card instead of the Application to a visitor with no Session', async () => {
	await renderRouter('/');

	await expectSignInCard();
});

it.for([
	['saas', 'Open tenant portal'],
	['standalone', 'Sign in with Microsoft'],
])(
	'sends a %s visitor to /signin, worded for the Mode',
	async ([mode, action]) => {
		vi.stubEnv('APP_MODE', mode);

		await renderRouter('/');

		const link = await screen.findByRole('link', { name: action });

		expect(link.getAttribute('href')).toBe('/signin');
	},
);

it('draws the Application for a live Session', async () => {
	holdSession(tokenWith({ exp: now() + 300 }));

	await renderRouter('/');

	expect((await screen.findByRole('status')).textContent).toBe(APPLICATION);
});

it('draws the sign-in card once the token is past its expiry and the leeway', async () => {
	holdSession(tokenWith({ exp: now() - 61 }));

	await renderRouter('/');

	await expectSignInCard();
});

it('draws the Application for a token inside the leeway', async () => {
	holdSession(tokenWith({ exp: now() - 30 }));

	await renderRouter('/');

	expect((await screen.findByRole('status')).textContent).toBe(APPLICATION);
});

it.for([
	['a token with no expiry', tokenWith({})],
	['a token that is not a JWT', 'dev.dev.dev'],
])(
	'draws the sign-in card and drops the Session for %s',
	async ([, access]) => {
		holdSession(access, 'r-unreadable');

		await renderRouter('/');

		await expectSignInCard();
		expect(getResponseHeaders().getSetCookie()).toEqual(ENDED);
	},
);

describe('renewing an expired Session before the first render', () => {
	const renewals: string[] = [];

	beforeEach(() => {
		renewals.length = 0;
		server.use(
			http.post(
				`${PLATFORM_AUTH_URL}/api/v1/auth/token/refresh`,
				async ({ request }) => {
					const { refresh_token } = z
						.object({ refresh_token: z.string() })
						.parse(await request.json());

					renewals.push(refresh_token);

					return refresh_token.startsWith('r-good')
						? HttpResponse.json({
								access_token: RENEWED,
								refresh_token: `${refresh_token}-next`,
							})
						: new HttpResponse(null, { status: 401 });
				},
			),
			http.post(`${GT_URL}/api/auth/sso/refresh`, ({ request }) => {
				const cookie = request.headers.get('cookie') ?? '';

				renewals.push(cookie);

				return cookie === 'sso_refresh_token=r-gt'
					? new HttpResponse(null, {
							status: 204,
							headers: [
								['set-cookie', `sso_access_token=${RENEWED}; HttpOnly; Path=/`],
								['set-cookie', 'sso_refresh_token=r-gt-next; HttpOnly; Path=/'],
							],
						})
					: new HttpResponse(null, { status: 401 });
			}),
		);
	});

	it('draws the Application and holds the pair Platform Auth renewed', async () => {
		holdSession(tokenWith({ exp: now() - 61 }), 'r-good-saas');

		await renderRouter('/');

		expect((await screen.findByRole('status')).textContent).toBe(APPLICATION);
		expect(renewals).toEqual(['r-good-saas']);
		expect(getResponseHeaders().getSetCookie()).toEqual([
			held('session', RENEWED),
			held('refresh', 'r-good-saas-next'),
		]);
	});

	it('draws the Application and holds the pair gt renewed in Standalone', async () => {
		vi.stubEnv('APP_MODE', 'standalone');
		holdSession(tokenWith({ exp: now() - 61 }), 'r-gt');

		await renderRouter('/');

		expect((await screen.findByRole('status')).textContent).toBe(APPLICATION);
		expect(getResponseHeaders().getSetCookie()).toEqual([
			held('session', RENEWED),
			held('refresh', 'r-gt-next'),
		]);
	});

	it('draws the sign-in card and drops the Session when renewal is refused', async () => {
		holdSession(tokenWith({ exp: now() - 61 }), 'r-refused');

		await renderRouter('/');

		await expectSignInCard();
		expect(getResponseHeaders().getSetCookie()).toEqual(ENDED);
	});

	it('spends no refresh token on a live Session', async () => {
		holdSession(tokenWith({ exp: now() + 300 }), 'r-good-live');

		await renderRouter('/');

		expect((await screen.findByRole('status')).textContent).toBe(APPLICATION);
		expect(renewals).toEqual([]);
		expect(getResponseHeaders().getSetCookie()).toEqual([]);
	});
});
