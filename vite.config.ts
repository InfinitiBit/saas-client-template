import { paraglideVitePlugin } from '@inlang/paraglide-js';
import babel from '@rolldown/plugin-babel';
import tailwindcss from '@tailwindcss/vite';
import { devtools } from '@tanstack/devtools-vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact, { reactCompilerPreset } from '@vitejs/plugin-react';
import { nitro } from 'nitro/vite';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import { defaultExclude } from 'vitest/config';

// The tests render the router and call server routes directly, so they need
// neither the Start server build nor nitro.
const isVitest = process.env.VITEST === 'true';

export default defineConfig(({ mode: viteMode }) => {
	const mock = viteMode === 'mock';

	// The dev Launch is a SaaS one: Standalone refuses it without the arrival cookie only `/signin` sets.
	if (mock) process.env.APP_MODE = 'saas';

	return {
		plugins: [
			paraglideVitePlugin({ project: './project.inlang' }),
			tailwindcss(),
			!isVitest && devtools(),
			!isVitest && tanstackStart(),
			!isVitest && nitro({ plugins: ['./src/nitro/require-mode.ts'] }),
			viteReact(),
			babel({ presets: [reactCompilerPreset()] }),
			mock && printLaunchUrl(),
		],
		resolve: { tsconfigPaths: true },
		// The built server's `PORT` and default, so plain `pnpm dev` keeps the registered Launch URL.
		server: {
			port: Number(loadEnv(viteMode, process.cwd(), '').PORT) || 3000,
			strictPort: !mock,
		},
		test: {
			environment: 'jsdom',
			globals: true,
			env: { TZ: 'UTC' },
			globalSetup: ['./src/testing/require-hooks.ts'],
			setupFiles: ['./src/testing/setup.ts'],
			exclude: [...defaultExclude, '.claude/**'],
			// Agents otherwise get Vitest's minimal reporter, which hides the slow tests the pre-push budget points to.
			reporters: ['default'],
		},
	};
});

const DEV_TOKEN = [
	{ alg: 'none', typ: 'JWT' },
	{
		sub: 'usr_00000000-0000-4000-8000-000000000001',
		aud: 'dev',
		tenant_slug: 'dev',
		session_id: '00000000-0000-4000-8000-000000000002',
		iat: 1_767_225_600,
		exp: 4_102_444_800,
		jti: '00000000-0000-4000-8000-000000000003',
	},
]
	.map((part) => Buffer.from(JSON.stringify(part)).toString('base64url'))
	.concat('unsigned')
	.join('.');

function printLaunchUrl(): Plugin {
	return {
		name: 'print-launch-url',
		configureServer(server) {
			const printUrls = server.printUrls.bind(server);

			server.printUrls = () => {
				printUrls();

				for (const url of server.resolvedUrls?.local ?? [])
					server.config.logger.info(
						`  ➜  Launch:  ${new URL(`/dev#token=${DEV_TOKEN}`, url)}`,
					);
			};
		},
	};
}
