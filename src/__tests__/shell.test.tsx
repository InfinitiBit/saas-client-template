import { Button } from '@infinitibit_gmbh/ui';
import { createRoute } from '@tanstack/react-router';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';

import { IDENTITY_PATH } from '@/features/api/lib/api';
import { ShellActions } from '@/features/shell/components/shell';
import { cookieName } from '@/paraglide/runtime';
import { Route as authenticated } from '@/routes/_authenticated';
import { server } from '@/testing/msw';
import { renderRouter } from '@/testing/render-router';
import { holdSession } from '@/testing/session';

// No template Screen fills the actions slot yet, so this file mounts one
// beside the real ones.
authenticated.addChildren([
	...Object.values(authenticated.children ?? {}),
	createRoute({
		getParentRoute: () => authenticated,
		path: '/with-actions',
		component: () => (
			<ShellActions>
				<Button>Export</Button>
			</ShellActions>
		),
	}),
]);

const identity = {
	email: 'ada@example.com',
	workspace: 'acme',
	roles: [],
	permissions: [],
};

beforeEach(() => {
	vi.stubEnv('APP_MODE', 'saas');
	holdSession();
	server.use(
		http.get(`${location.origin}${IDENTITY_PATH}`, () =>
			HttpResponse.json(identity),
		),
	);
});

afterEach(() => {
	vi.unstubAllEnvs();
});

async function openAccountMenu() {
	await renderRouter('/');
	fireEvent.keyDown(await screen.findByRole('button', { name: 'Account' }), {
		key: 'Enter',
	});

	return screen.findByRole('menu');
}

// Catches: the top bar losing its navigation, or not marking the current Screen for sighted and screen reader users.
it("draws the Application's navigation in the top bar, marking the current Screen", async () => {
	await renderRouter('/');

	const banner = await screen.findByRole('banner');

	const home = within(
		within(banner).getByRole('navigation', { name: 'Application' }),
	).getByRole('link', { name: 'Home' });

	expect(home.getAttribute('href')).toBe('/');
	expect(home.getAttribute('aria-current')).toBe('page');
});

// Catches: Apps or Notifications looking clickable before the platform offers them, so clicks do nothing.
it('shows Apps and Notifications, disabled until the platform has them', async () => {
	await renderRouter('/');

	const banner = await screen.findByRole('banner');

	for (const name of ['Apps', 'Notifications'])
		expect(
			within(banner).getByRole<HTMLButtonElement>('button', { name }).disabled,
		).toBe(true);
});

// Catches: a user unable to tell which account and Workspace they are signed into.
it('names the Identity and its Workspace in the account menu', async () => {
	const menu = await openAccountMenu();

	expect(await within(menu).findByText('ada@example.com')).toBeTruthy();
	expect(within(menu).getByText('acme')).toBeTruthy();
});

// Catches: the language switch doing nothing, or forgetting the choice on the next visit.
it('switches the language from the account menu and keeps it in the cookie', async () => {
	const menu = await openAccountMenu();

	const english = within(menu).getByRole('menuitemcheckbox', {
		name: 'English',
	});

	expect(english.getAttribute('aria-checked')).toBe('true');

	fireEvent.click(
		within(menu).getByRole('menuitemcheckbox', { name: 'Deutsch' }),
	);

	expect(document.cookie).toContain(`${cookieName}=de`);
});

// Catches: Sign out leaving the Session alive because the menu never called the Session route.
it('signs out through the Session route', async () => {
	const ended = vi.fn();

	server.use(
		http.delete(`${location.origin}/session`, () => {
			ended();

			return new HttpResponse(null, { status: 204 });
		}),
	);

	const menu = await openAccountMenu();

	fireEvent.click(within(menu).getByRole('menuitem', { name: 'Sign out' }));

	await waitFor(() => {
		expect(ended).toHaveBeenCalledOnce();
	});
});

// Catches: a Screen's actions rendering in the page body instead of the top bar.
it("puts a Screen's actions in the top bar", async () => {
	await renderRouter('/with-actions');

	const banner = await screen.findByRole('banner');

	expect(within(banner).getByRole('button', { name: 'Export' })).toBeTruthy();
	expect(
		within(screen.getByRole('main')).queryByRole('button', { name: 'Export' }),
	).toBeNull();
});
