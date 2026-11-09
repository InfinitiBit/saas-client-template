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

// Catches: a signed-out visitor seeing the Application, or a crash, instead of the sign-in card.
it('draws the sign-in card instead of the Application to a visitor with no Session', async () => {
	await renderRouter('/');

	await expectSignInCard();
});

// Catches: the sign-in button pointing somewhere other than /signin, or offering Microsoft sign-in to a SaaS user and the portal to a Standalone one.
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

// Catches: a signed-in user being shown the sign-in card.
it('draws the Application for a live Session', async () => {
	holdSession(tokenWith({ exp: now() + 300 }));

	await renderRouter('/');

	expect((await screen.findByRole('status')).textContent).toBe(APPLICATION);
});

// Catches: a long-expired token still drawing the Application, so every call then fails.
it('draws the sign-in card once the token is past its expiry and the leeway', async () => {
	holdSession(tokenWith({ exp: now() - 61 }));

	await renderRouter('/');

	await expectSignInCard();
});

// Catches: a user whose clock is a few seconds ahead being bounced to sign in with a token the Service still accepts.
it('draws the Application for a token inside the leeway', async () => {
	holdSession(tokenWith({ exp: now() - 30 }));

	await renderRouter('/');

	expect((await screen.findByRole('status')).textContent).toBe(APPLICATION);
});

// Catches: a token with no expiry or a malformed token being trusted, or its cookies left behind to fail again on every load.
it.for([
	['a token with no expiry', tokenWith({}), undefined],
	['a token that is not a JWT, next to a refresh token', 'dev.dev.dev', 'r1'],
])(
	'draws the sign-in card and drops the Session for %s',
	async ([, access, refresh]) => {
		holdSession(access, refresh);

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

	// Catches: a user returning with an expired token being sent to sign in although Platform Auth would have renewed it.
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

	// Catches: a Standalone user returning with an expired token being sent to sign in although gt would have renewed it.
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

	// Catches: a refused renewal drawing the Application anyway, or leaving the dead cookies to retry on every load.
	it.for(['saas', 'standalone'])(
		'draws the sign-in card and drops the Session when %s renewal is refused',
		async (mode) => {
			vi.stubEnv('APP_MODE', mode);
			holdSession(tokenWith({ exp: now() - 61 }), `r-refused-${mode}`);

			await renderRouter('/');

			await expectSignInCard();
			expect(getResponseHeaders().getSetCookie()).toEqual(ENDED);
		},
	);

	// Catches: every page load spending the refresh token on a live Session, rotating it needlessly and risking a family revoke.
	it('spends no refresh token on a live Session', async () => {
		holdSession(tokenWith({ exp: now() + 300 }), 'r-good-live');

		await renderRouter('/');

		expect((await screen.findByRole('status')).textContent).toBe(APPLICATION);
		expect(renewals).toEqual([]);
		expect(getResponseHeaders().getSetCookie()).toEqual([]);
	});
});
