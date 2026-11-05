import { faker } from '@faker-js/faker';
import type { OpenApiDocument } from 'orval';

import { edgeProperties, edgeText } from '@/features/api/lib/edge-text';

test('draws two letters, a 200-character sentence, a 60-character token, a long company name and ordinary text', () => {
	faker.seed(1);
	const draws = Array.from({ length: 200 }, edgeText);

	expect(draws.some((text) => text.length === 2)).toBe(true);
	expect(draws.some((text) => text.length === 200 && text.includes(' '))).toBe(
		true,
	);
	expect(draws.some((text) => text.length === 60 && !text.includes(' '))).toBe(
		true,
	);
	expect(draws).toContain('Müller-Lüdenscheidt GmbH & Co. KG');
	expect(draws.some((text) => text.length > 2 && text.length < 60)).toBe(true);
});

test('gives edge text to plain human-text strings only', () => {
	const spec: OpenApiDocument = {
		openapi: '3.1.0',
		info: { title: 'Spec', version: '1' },
		paths: {},
		components: {
			schemas: {
				Kind: { type: 'string', enum: ['open', 'closed'] },
				Company: { type: 'object', properties: { id: { type: 'string' } } },
				Thing: {
					type: 'object',
					properties: {
						title: { type: 'string' },
						display_name: { anyOf: [{ type: 'string' }, { type: 'null' }] },
						description: { type: ['string', 'null'] },
						body: { type: 'string' },
						company_kind: { type: 'string', enum: ['gmbh', 'ag'] },
						status_name: { $ref: '#/components/schemas/Kind' },
						company: { $ref: '#/components/schemas/Company' },
						title_url: { type: 'string', format: 'uri' },
					},
				},
			},
		},
	};

	expect(Object.keys(edgeProperties(spec)).sort()).toEqual([
		'description',
		'display_name',
		'title',
	]);
});

test('keeps a name that is an enum anywhere in the spec', () => {
	const spec: OpenApiDocument = {
		openapi: '3.1.0',
		info: { title: 'Spec', version: '1' },
		paths: {},
		components: {
			schemas: {
				A: { type: 'object', properties: { name: { type: 'string' } } },
				B: {
					type: 'object',
					properties: { name: { type: 'string', enum: ['x'] } },
				},
			},
		},
	};

	expect(edgeProperties(spec)).toEqual({});
});
