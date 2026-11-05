import type { RequestHandler } from 'msw';

import { getListNotesMockHandler } from '@/features/api/generated/service.msw';

// Copy to dev-scenario.ts: its handlers answer ahead of every other dev handler.
export const devScenario: RequestHandler[] = [
	getListNotesMockHandler({
		items: [
			{
				id: '1',
				title: 'Quarterly review',
				body: 'Agenda and figures for the Q3 review.',
				created_at: '2026-10-01T09:00:00Z',
			},
		],
		total: 1,
		page: 1,
		size: 20,
	}),
];
