import { defineConfig } from 'orval';

import { FORWARDED_TAGS } from './src/features/api/lib/api';
import { edgeProperties } from './src/features/api/lib/edge-text';

// "List Notes" → `listNotes`, so the hook reads `useListNotes` rather than
// FastAPI's generated operationId.
function nameFromSummary(summary: unknown) {
	if (typeof summary !== 'string' || !summary.trim())
		throw new Error('An operation has no summary to be named after.');

	return summary
		.trim()
		.split(/[^a-z0-9]+/i)
		.map((word, index) =>
			index === 0
				? word.toLowerCase()
				: word.charAt(0).toUpperCase() + word.slice(1),
		)
		.join('');
}

const client = './src/features/api/lib/client.ts';

export default defineConfig({
	service: {
		input: {
			target: process.env.API_SPEC ?? './openapi.yaml',
			// Only what the proxy forwards: a hook for any other path always fails.
			filters: { tags: [...FORWARDED_TAGS] },
		},
		output: {
			mode: 'split',
			target: './src/features/api/generated/service.ts',
			client: 'react-query',
			httpClient: 'axios',
			clean: true,
			mock: true,
			formatter: 'oxfmt',
			override: {
				operationName: (operation) => nameFromSummary(operation.summary),
				mock: { properties: edgeProperties, arrayMin: 0, arrayMax: 100 },
				mutator: { path: client, name: 'apiRequest' },
				query: {
					// Every call goes through Query, and so through the cache and the gate.
					shouldExportHttpClient: false,
					queryKey: { path: client, name: 'apiQueryKey' },
				},
			},
		},
	},
});
