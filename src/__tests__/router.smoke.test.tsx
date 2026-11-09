import { screen } from '@testing-library/react';

import { renderRouter } from '@/testing/render-router';
import { holdSession } from '@/testing/session';

afterEach(() => {
	vi.unstubAllEnvs();
});

// Catches: a signed-in user opening the app to a blank page.
it('draws the home route from the design system', async () => {
	vi.stubEnv('APP_MODE', 'saas');
	holdSession();

	await renderRouter('/');

	const banner = await screen.findByRole('status');

	expect(banner.textContent).toBe('The template is running.');
});

// Catches: a mistyped address showing a blank page or a crash instead of Page not found.
it('answers an address no route draws with a not-found screen', async () => {
	vi.stubEnv('APP_MODE', 'saas');

	// Two segments: any single one is a tenant slug a Launch lands on.
	await renderRouter('/no/such-page');

	const banner = await screen.findByRole('status');

	expect(banner.textContent).toBe('Page not found');
});

// Catches: a deployment missing APP_MODE booting into a half-working app instead of saying which variable to set.
it('draws no Application for a deployment that never said its Mode', async () => {
	vi.stubEnv('APP_MODE', undefined);

	await renderRouter('/');

	expect(await screen.findByText(/APP_MODE/)).toBeTruthy();
	expect(screen.queryByText('The template is running.')).toBeNull();
});
