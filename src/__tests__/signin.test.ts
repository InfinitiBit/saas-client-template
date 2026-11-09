// @vitest-environment node

import { APPLICATION_NAME } from '@/application';
import { Route } from '@/routes/signin';
import { respond } from '@/testing/respond';

const PORTAL_URL = 'https://portal.example.com/';

const GT_URL = 'https://gt.example.com';

afterEach(() => {
	vi.unstubAllEnvs();
});

function signIn() {
	return respond(Route, new Request('http://localhost/signin'));
}

// Catches: SaaS sign-in sending the user somewhere other than the Tenant portal, or the browser caching a redirect to an old portal.
it('sends a SaaS visitor to the Tenant portal', async () => {
	vi.stubEnv('APP_MODE', 'saas');
	vi.stubEnv('TENANT_PORTAL_URL', PORTAL_URL);

	const response = await signIn();

	expect(response.status).toBe(302);
	expect(response.headers.get('location')).toBe(PORTAL_URL);
	expect(response.headers.getSetCookie()).toEqual([]);
	// A deployment repointed at another portal must not be shadowed by a
	// redirect the browser cached from the old one.
	expect(response.headers.get('cache-control')).toBe('no-store');
});

// Catches: Standalone sign-in silently reusing the wrong Microsoft account, or the callback being refused because no arrival cookie was set.
it('sends a Standalone visitor to gt Entra sign-in, forcing the account prompt', async () => {
	vi.stubEnv('APP_MODE', 'standalone');
	vi.stubEnv('GT_SERVER_URL', GT_URL);

	const response = await signIn();

	expect(response.status).toBe(302);
	expect(response.headers.get('location')).toBe(
		`${GT_URL}/api/auth/sso/login?app=${APPLICATION_NAME}&prompt=select_account`,
	);
	expect(response.headers.get('cache-control')).toBe('no-store');
	// What gt's callback is adopted against: a link to `/auth/callback#token=…`
	// cannot make someone else's browser hold a `__Host-` cookie set here.
	expect(response.headers.getSetCookie()).toEqual([
		`__Host-${APPLICATION_NAME}-arrival=1; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`,
	]);
});

// Catches: a missing or mistyped APP_MODE sending users to the wrong sign-in instead of failing with the variable to fix.
it.for([undefined, '', 'SAAS', 'gt'])(
	'refuses a Mode of %o, naming APP_MODE',
	async (appMode) => {
		vi.stubEnv('APP_MODE', appMode);
		vi.stubEnv('TENANT_PORTAL_URL', PORTAL_URL);
		vi.stubEnv('GT_SERVER_URL', GT_URL);

		await expect(signIn()).rejects.toThrow(/APP_MODE/);
	},
);

// Catches: a missing or scheme-less TENANT_PORTAL_URL redirecting SaaS users to a broken address.
it.for([undefined, 'portal.example.com'])(
	'refuses SaaS with a Tenant portal of %o, naming TENANT_PORTAL_URL',
	async (portalUrl) => {
		vi.stubEnv('APP_MODE', 'saas');
		vi.stubEnv('TENANT_PORTAL_URL', portalUrl);
		vi.stubEnv('GT_SERVER_URL', GT_URL);

		await expect(signIn()).rejects.toThrow(/TENANT_PORTAL_URL/);
	},
);

// Catches: a missing or scheme-less GT_SERVER_URL redirecting Standalone users to a broken address.
it.for([undefined, 'gt.example.com'])(
	'refuses Standalone with a gt of %o, naming GT_SERVER_URL',
	async (gtUrl) => {
		vi.stubEnv('APP_MODE', 'standalone');
		vi.stubEnv('GT_SERVER_URL', gtUrl);
		vi.stubEnv('TENANT_PORTAL_URL', PORTAL_URL);

		await expect(signIn()).rejects.toThrow(/GT_SERVER_URL/);
	},
);

// Catches: a deployment failing to sign anyone in because it lacks a variable only the other Mode needs.
it('needs nothing of the other Mode', async () => {
	vi.stubEnv('APP_MODE', 'saas');
	vi.stubEnv('TENANT_PORTAL_URL', PORTAL_URL);
	vi.stubEnv('GT_SERVER_URL', undefined);

	expect((await signIn()).status).toBe(302);

	vi.stubEnv('APP_MODE', 'standalone');
	vi.stubEnv('GT_SERVER_URL', GT_URL);
	vi.stubEnv('TENANT_PORTAL_URL', undefined);

	expect((await signIn()).status).toBe(302);
});
