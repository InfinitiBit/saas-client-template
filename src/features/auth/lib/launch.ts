// Hands a Launch's credentials to this origin's server, which keeps them in
// cookies no script can read. See ADR 0005. True once this origin holds them.
export async function adoptLaunch() {
	const fragment = new URLSearchParams(location.hash.slice(1));
	const token = fragment.get('token');
	const refresh = fragment.get('refresh_token');

	if (!token && !refresh) return false;

	// Before the round trip, so the credentials leave the address bar and history
	// at once. `replaceState`, or Back would bring them back.
	history.replaceState(
		history.state,
		'',
		`${location.pathname}${location.search}`,
	);

	if (!token) return false;

	// Hydration waits on this. A failed adoption still boots the Application,
	// as a visitor with no Session.
	const response = await fetch('/session', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(
			refresh ? { token, refresh_token: refresh } : { token },
		),
		signal: AbortSignal.timeout(10_000),
	}).catch(() => undefined);

	return response?.ok ?? false;
}
