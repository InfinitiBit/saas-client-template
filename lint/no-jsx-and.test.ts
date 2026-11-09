import { RuleTester } from 'oxlint/plugins-dev';

import { noJsxAnd } from './plugin';

// Catches: a falsy count rendering as a stray 0 because `&&` in JSX slipped past the rule, or a false alarm on a ternary or on `&&` outside JSX.
new RuleTester({
	languageOptions: { parserOptions: { lang: 'tsx' } },
}).run('no-jsx-and', noJsxAnd, {
	valid: [
		'<p>{count ? <Badge /> : null}</p>',
		'const show = count && visible;',
		'<p>{count || fallback}</p>',
	],
	invalid: [
		{ code: '<p>{count && <Badge />}</p>', errors: 1 },
		{ code: '<input disabled={busy && locked} />', errors: 1 },
	],
});
