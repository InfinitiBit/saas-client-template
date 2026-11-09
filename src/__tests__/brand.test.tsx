import { readdirSync } from 'node:fs';

import { screen } from '@testing-library/react';

import { brands } from '@/features/brand/lib/brand';
import { renderRouter } from '@/testing/render-router';

beforeEach(() => {
	vi.stubEnv('APP_MODE', 'saas');
});

afterEach(() => {
	vi.unstubAllEnvs();
});

// Catches: a Brand's deployment rendering in another Brand's colours because the theme was not set on the document.
it.for(['default', 'gt'])('dresses the document as %s', async (brand) => {
	vi.stubEnv('APP_BRAND', brand);

	await renderRouter('/');

	expect(document.documentElement.dataset.theme).toBe(brand);
});

// Catches: a GT deployment showing the InfinitiBit logo or favicon, or the other way round.
it.for([
	['default', 'InfinitiBit'],
	['gt', 'Grant Thornton'],
])('wears the %s favicon and logo', async ([brand, name]) => {
	vi.stubEnv('APP_BRAND', brand);

	await renderRouter('/');

	expect(document.querySelector('link[rel="icon"]')?.getAttribute('href')).toBe(
		`/brand/${brand}/favicon.ico`,
	);
	expect(screen.getByRole('img', { name }).getAttribute('src')).toBe(
		`/brand/${brand}/logo.svg`,
	);
});

// Catches: a Brand shipping with a missing favicon, logo or mark, so the browser shows a broken image.
it.for(brands)('ships every %s asset', (brand) => {
	expect(readdirSync(`public/brand/${brand}`).sort()).toEqual([
		'favicon.ico',
		'logo.svg',
		'mark.svg',
	]);
});

// Catches: an unset, empty or unknown APP_BRAND leaving the app unthemed instead of on the default Brand.
it.for([undefined, '', 'GT', 'acme'])(
	'falls back to the default Brand when APP_BRAND is %j',
	async (value) => {
		vi.stubEnv('APP_BRAND', value);

		await renderRouter('/');

		expect(document.documentElement.dataset.theme).toBe('default');
	},
);
