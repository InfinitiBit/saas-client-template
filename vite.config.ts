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
		// Same `PORT`, and default, as the built server, so the registered Launch URL
		// holds in dev.
		server: {
			port: Number(loadEnv(viteMode, process.cwd(), '').PORT) || 3000,
			strictPort: !mock,
		},
		test: {
			environment: 'jsdom',
			globals: true,
			env: { TZ: 'UTC' },
			setupFiles: ['./src/testing/setup.ts'],
			exclude: [...defaultExclude, '.claude/**'],
		},
	};
});

function printLaunchUrl(): Plugin {
	return {
		name: 'print-launch-url',
		configureServer(server) {
			const printUrls = server.printUrls.bind(server);

			server.printUrls = () => {
				printUrls();

				for (const url of server.resolvedUrls?.local ?? [])
					server.config.logger.info(
						`  ➜  Launch:  ${new URL('/dev#token=dev.dev.dev', url)}`,
					);
			};
		},
	};
}
