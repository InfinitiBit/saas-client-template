import {
	REFRESH_COOKIE,
	SESSION_COOKIE,
} from '@/features/auth/lib/session.server';

/** A token carrying `claims`, signed by no one: the gate never verifies it. */
export function tokenWith(claims: { exp?: number }) {
	return `header.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.signature`;
}

/** Puts a Session in the browser's cookie jar, where adopting a Launch leaves it. */
export function holdSession(
	access = tokenWith({ exp: Date.now() / 1000 + 3600 }),
	refresh?: string,
) {
	document.cookie = `${SESSION_COOKIE}=${access}; Path=/; Secure`;

	if (refresh !== undefined)
		document.cookie = `${REFRESH_COOKIE}=${refresh}; Path=/; Secure`;
}
