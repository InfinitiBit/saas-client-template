import { faker } from '@faker-js/faker';
import type { OpenApiDocument } from 'orval';
import { z } from 'zod';

/**
 * Text that breaks layouts, so a mock Screen shows overflow and clipping.
 * orval copies this function's source into the generated mocks: it may use nothing but `faker`.
 */
export function edgeText() {
	return faker.helpers.arrayElement([
		() => faker.string.alpha(2),
		() => faker.lorem.sentence(100).slice(0, 200),
		() => `${faker.string.alphanumeric(48)}@example.com`,
		() => 'Müller-Lüdenscheidt GmbH & Co. KG',
		() => faker.lorem.sentence({ min: 2, max: 6 }),
	])();
}

const HUMAN_TEXT = /name|title|description|company/;

interface Schema {
	$ref?: string;
	type?: string | string[];
	enum?: unknown[];
	const?: unknown;
	format?: string;
	properties?: Record<string, Schema>;
	items?: Schema;
	allOf?: Schema[];
	anyOf?: Schema[];
	oneOf?: Schema[];
}

// Only the keywords that decide what is text. Anything else, a boolean schema included, reads as not text.
const schemaKeywords: z.ZodType<Schema> = z
	.object({
		$ref: z.string().optional(),
		type: z.union([z.string(), z.array(z.string())]).optional(),
		enum: z.array(z.unknown()).optional(),
		const: z.unknown().optional(),
		format: z.string().optional(),
		properties: z
			.record(
				z.string(),
				z.lazy(() => schemaKeywords),
			)
			.optional(),
		items: z.lazy(() => schemaKeywords).optional(),
		allOf: z.array(z.lazy(() => schemaKeywords)).optional(),
		anyOf: z.array(z.lazy(() => schemaKeywords)).optional(),
		oneOf: z.array(z.lazy(() => schemaKeywords)).optional(),
	})
	.catch({});

const specSchemas = z.object({
	components: z
		.object({ schemas: z.record(z.string(), schemaKeywords) })
		.catch({ schemas: {} }),
});

/**
 * `override.mock.properties` for orval: `edgeText` for every human-text property.
 * orval's own overrides win over a spec's `enum`, so a name that is ever an enum,
 * a format or a non-string keeps its generated value.
 */
export function edgeProperties(spec: OpenApiDocument) {
	const { schemas } = specSchemas.parse(spec).components;

	const resolve = (schema: Schema): Schema =>
		schema.$ref ? (schemas[schema.$ref.split('/').at(-1) ?? ''] ?? {}) : schema;

	const isText = (ref: Schema): boolean => {
		const schema = resolve(ref);
		const members = schema.anyOf ?? schema.oneOf;

		if (members)
			return members.every(
				(member) => resolve(member).type === 'null' || isText(member),
			);

		return (
			[schema.type].flat().includes('string') &&
			!schema.enum &&
			!schema.format &&
			schema.const === undefined
		);
	};

	const text = new Map<string, boolean>();

	const visit = (schema: Schema) => {
		for (const [name, property] of Object.entries(schema.properties ?? {})) {
			if (HUMAN_TEXT.test(name))
				text.set(name, (text.get(name) ?? true) && isText(property));

			visit(property);
		}

		for (const member of [
			schema.items ?? [],
			schema.allOf ?? [],
			schema.anyOf ?? [],
			schema.oneOf ?? [],
		].flat())
			visit(member);
	};

	Object.values(schemas).forEach(visit);

	return Object.fromEntries(
		[...text].flatMap(([name, plain]) => (plain ? [[name, edgeText]] : [])),
	);
}
