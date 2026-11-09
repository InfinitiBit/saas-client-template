import { RuleTester } from 'oxlint/plugins-dev';

import { requireCatchesComment } from './plugin';

const catches = '// Catches: a renamed Note showing its old title\n';

function missing(name: string) {
	return {
		message: `'${name}' has no \`// Catches: <the bug a user would hit>\` comment directly above it. If you cannot name the bug, delete the test.`,
	};
}

// Catches: a test that names no bug reaching main, a test hidden behind `.each` or `.skip` slipping through, or a false alarm on `describe` or a regex `.test()`.
new RuleTester().run('require-catches-comment', requireCatchesComment, {
	valid: [
		`${catches}it('renames', () => {});`,
		`${catches}test('renames', () => {});`,
		`${catches}it.each([1])('renames %s', () => {});`,
		`${catches}it.for([1])('renames %s', () => {});`,
		`${catches}it.skip('renames', () => {});`,
		`${catches}it.each\`a\n\${1}\`('renames', () => {});`,
		`describe('notes', () => {\n\t${catches}\tit('renames', () => {});\n});`,
		`// Why the table holds two rows.\n${catches}it('renames', () => {});`,
		`${catches}// The Service answers out of order.\nit('renames', () => {});`,
		"describe('notes', () => {});",
		'/a/.test(title);',
		'expect.it;',
	],
	invalid: [
		{ code: "it('renames', () => {});", errors: [missing('renames')] },
		{ code: "test('renames', () => {});", errors: [missing('renames')] },
		{
			code: "it.each([1])('renames %s', () => {});",
			errors: [missing('renames %s')],
		},
		{
			code: "it.for([1])('renames %s', () => {});",
			errors: [missing('renames %s')],
		},
		{
			code: "it.only('renames', () => {});",
			errors: [missing('renames')],
		},
		{
			code: "// Renames the Note.\nit('renames', () => {});",
			errors: [missing('renames')],
		},
		{
			code: "/* Catches: a renamed Note showing its old title */\nit('renames', () => {});",
			errors: [missing('renames')],
		},
		{
			code: `${catches}it('renames', () => {});\nit('deletes', () => {});`,
			errors: [missing('deletes')],
		},
		{
			code: "describe('notes', () => {\n\tit('renames', () => {});\n});",
			errors: [missing('renames')],
		},
	],
});
