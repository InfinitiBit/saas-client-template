import type { AnyRoute } from '@tanstack/react-router';

type Handler = (ctx: {
	context: object;
	next: () => never;
	params: Record<string, string>;
	pathname: string;
	request: Request;
}) => Response | undefined | Promise<Response | undefined>;

type Handlers = Partial<Record<string, Handler | { handler?: Handler }>>;

/**
 * Calls a server route's handler for `request.method` the way Start would, and
 * hands back its Response. Route middleware does not run.
 */
export async function respond(route: AnyRoute, request: Request) {
	// SAFETY: Start keeps a server route's handlers under `options.server`,
	// which `AnyRoute` leaves untyped.
	const handlers = (route.options as { server?: { handlers?: Handlers } })
		.server?.handlers;

	const method = handlers?.[request.method] ?? handlers?.ANY;
	const handler = method instanceof Function ? method : method?.handler;

	if (!handler)
		throw new Error(`${route.id} does not answer ${request.method}`);

	const response = await handler({
		context: {},
		next: () => {
			throw new Error('respond() does not run middleware');
		},
		params: {},
		pathname: new URL(request.url).pathname,
		request,
	});

	if (!response) throw new Error(`${route.id} returned no Response`);

	return response;
}
