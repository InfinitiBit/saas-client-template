import { faker } from '@faker-js/faker';
import type { OpenApiDocument } from 'orval';
import { z } from 'zod';

/** orval copies this function's source into the generated mocks: it may use nothing but `faker`. */
export function edgeText() {
	return faker.helpers.arrayElement([
		() => faker.string.alpha(2),
		() => `${faker.lorem.sentence(100).slice(0, 199)}.`,
		() => `${faker.string.alphanumeric(48)}@example.com`,
		() => 'Müller-Lüdenscheidt GmbH & Co. KG',
		() => faker.lorem.sentence({ min: 2, max: 6 }),
	])();
}

const HUMAN_TEXT = /name|title|description|company/i;

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

const schemaKeywords: z.ZodType<Schema> = z.union([
	z.boolean().transform((): Schema => ({})),
	z.object({
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
	}),
]);

const specSchemas = z.object({
	components: z
		.object({ schemas: z.record(z.string(), schemaKeywords).optional() })
		.optional(),
});

/**
 * orval's `mock.properties` overrides match by bare name and win over a spec's `enum`,
 * so a name that is ever an enum, a format or a non-string keeps its generated value.
 */
export function edgeProperties(spec: OpenApiDocument) {
	const schemas = specSchemas.parse(spec).components?.schemas ?? {};

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

	const plainByName = new Map<string, boolean>();

	const visit = (schema: Schema) => {
		for (const [name, property] of Object.entries(schema.properties ?? {})) {
			if (HUMAN_TEXT.test(name))
				plainByName.set(
					name,
					(plainByName.get(name) ?? true) && isText(property),
				);

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
		[...plainByName].flatMap(([name, plain]) =>
			plain ? [[name, edgeText]] : [],
		),
	);
}
