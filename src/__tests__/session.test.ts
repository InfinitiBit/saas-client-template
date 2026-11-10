// @vitest-environment node

import { http, HttpResponse } from 'msw';

import { APPLICATION_NAME } from '@/application';
import { Route } from '@/routes/session';
import { server } from '@/testing/msw';
import { respond } from '@/testing/respond';

const TOKEN = 'header.payload.signature';

const REFRESH = 'a-refresh-token';

const PLATFORM_AUTH_URL = 'https://auth.platform.example.com';

const ENDED = [
	`__Host-${APPLICATION_NAME}-session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`,
	`__Host-${APPLICATION_NAME}-refresh=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`,
];

afterEach(() => {
	vi.unstubAllEnvs();
});

function adopt(
	body: { token?: string; refresh_token?: string },
	headers: Record<string, string> = {},
) {
	return respond(
		Route,
		new Request('http://localhost/session', {
			method: 'POST',
			headers: { 'content-type': 'application/json', ...headers },
			body: JSON.stringify(body),
		}),
	);
}

describe('adopting a SaaS Launch', () => {
	beforeEach(() => {
		vi.stubEnv('APP_MODE', 'saas');
	});

	// Catches: a Launch's tokens landing in cookies page scripts can read, or that are sent cross-site or over plain HTTP.
	it('holds both tokens in HttpOnly session cookies', async () => {
		const response = await adopt({ token: TOKEN, refresh_token: REFRESH });

		expect(response.status).toBe(204);
		expect(response.headers.getSetCookie()).toEqual([
			`__Host-${APPLICATION_NAME}-session=${TOKEN}; HttpOnly; Secure; SameSite=Lax; Path=/`,
			`__Host-${APPLICATION_NAME}-refresh=${REFRESH}; HttpOnly; Secure; SameSite=Lax; Path=/`,
		]);
	});

	// Catches: a new Launch keeping the previous user's refresh token, so a later renewal signs in as them.
	it('starts a Session from a Launch without a refresh token, dropping any previous one', async () => {
		const response = await adopt({ token: TOKEN });

		expect(response.status).toBe(204);
		expect(response.headers.getSetCookie()).toEqual([
			`__Host-${APPLICATION_NAME}-session=${TOKEN}; HttpOnly; Secure; SameSite=Lax; Path=/`,
			`__Host-${APPLICATION_NAME}-refresh=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`,
		]);
	});
});

describe('adopting a Standalone arrival from gt', () => {
	const ARRIVAL = `__Host-${APPLICATION_NAME}-arrival=1`;

	beforeEach(() => {
		vi.stubEnv('APP_MODE', 'standalone');
	});

	// Catches: a Standalone arrival cookie surviving the sign-in, so it can be replayed to adopt another token later.
	it('holds the pair and spends the arrival cookie /signin left', async () => {
		const response = await adopt(
			{ token: TOKEN, refresh_token: REFRESH },
			{ cookie: ARRIVAL },
		);

		expect(response.status).toBe(204);
		expect(response.headers.getSetCookie()).toEqual([
			`__Host-${APPLICATION_NAME}-session=${TOKEN}; HttpOnly; Secure; SameSite=Lax; Path=/`,
			`__Host-${APPLICATION_NAME}-refresh=${REFRESH}; HttpOnly; Secure; SameSite=Lax; Path=/`,
			`__Host-${APPLICATION_NAME}-arrival=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`,
		]);
	});

	// Catches: a crafted link signing the user into an attacker's gt account (login CSRF).
	it('refuses an arrival this browser never started, which a crafted link can deliver', async () => {
		const response = await adopt({ token: TOKEN, refresh_token: REFRESH });

		expect(response.status).toBe(400);
		expect(response.headers.getSetCookie()).toEqual([]);
	});
});

describe('refusing an adoption', () => {
	beforeEach(() => {
		vi.stubEnv('APP_MODE', 'saas');
	});

	// Catches: a missing, malformed or cookie-injecting token being stored, planting extra cookies in the user's browser.
	it.for([
		['no token', {}],
		['a token that is not a JWT', { token: 'not-a-jwt' }],
		// Would become a second cookie, or a second header, on the way out.
		['a token that breaks out of the cookie', { token: `${TOKEN}; Domain=x` }],
		[
			'a refresh token that breaks out of the cookie',
			{ token: TOKEN, refresh_token: 'r; Path=/x' },
		],
	] as const)('refuses %s', async ([, body]) => {
		const response = await adopt(body);

		expect(response.status).toBe(400);
		expect(response.headers.getSetCookie()).toEqual([]);
	});

	// Catches: a cross-site form posting a token as plain text and signing the user into someone else's Session.
	it('refuses a body that is not JSON, which a cross-site form can send', async () => {
		const response = await adopt(
			{ token: TOKEN },
			{ 'content-type': 'text/plain' },
		);

		expect(response.status).toBe(400);
		expect(response.headers.getSetCookie()).toEqual([]);
	});
});

function signOut() {
	return respond(
		Route,
		new Request('http://localhost/session', {
			method: 'DELETE',
			headers: {
				cookie: `__Host-${APPLICATION_NAME}-session=${TOKEN}; __Host-${APPLICATION_NAME}-refresh=${REFRESH}`,
			},
		}),
	);
}

describe('signing out', () => {
	// Catches: signing out leaving the Session alive at Platform Auth, where a stolen refresh token still works.
	it('ends a SaaS Session at Platform Auth, not only here', async () => {
		vi.stubEnv('APP_MODE', 'saas');
		vi.stubEnv('PLATFORM_AUTH_URL', PLATFORM_AUTH_URL);
		const revoked: (string | null)[] = [];

		server.use(
			http.post(`${PLATFORM_AUTH_URL}/api/v1/auth/logout`, ({ request }) => {
				revoked.push(request.headers.get('authorization'));

				return new HttpResponse(null, { status: 204 });
			}),
		);

		const response = await signOut();

		expect(revoked).toEqual([`Bearer ${TOKEN}`]);
		expect(response.status).toBe(204);
		expect(response.headers.getSetCookie()).toEqual(ENDED);
	});

	// Catches: a Platform Auth outage leaving the user unable to sign out.
	it('still signs out here when Platform Auth cannot be reached', async () => {
		vi.stubEnv('APP_MODE', 'saas');
		vi.stubEnv('PLATFORM_AUTH_URL', PLATFORM_AUTH_URL);
		server.use(
			http.post(`${PLATFORM_AUTH_URL}/api/v1/auth/logout`, () =>
				HttpResponse.error(),
			),
		);

		const response = await signOut();

		expect(response.status).toBe(204);
		expect(response.headers.getSetCookie()).toEqual(ENDED);
	});

	// Catches: a deployment without PLATFORM_AUTH_URL leaving the user unable to sign out.
	it('still signs out here when Platform Auth was never configured', async () => {
		vi.stubEnv('APP_MODE', 'saas');
		vi.stubEnv('PLATFORM_AUTH_URL', undefined);

		const response = await signOut();

		expect(response.status).toBe(204);
		expect(response.headers.getSetCookie()).toEqual(ENDED);
	});

	// Catches: Standalone sign-out failing or calling gt for a revoke it does not offer.
	it('ends a Standalone Session by dropping it, since gt has nothing to revoke', async () => {
		// An undeclared request fails the test, so this also asserts gt is not called.
		vi.stubEnv('APP_MODE', 'standalone');

		const response = await signOut();

		expect(response.status).toBe(204);
		expect(response.headers.getSetCookie()).toEqual(ENDED);
	});
});
