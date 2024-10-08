import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)

/** @type {import("prettier").Config} */
export default {
	endOfLine: 'lf',
	plugins: [require.resolve('prettier-plugin-packagejson')],
	semi: false,
	singleQuote: true,
	trailingComma: 'all',
	useTabs: false,
}
