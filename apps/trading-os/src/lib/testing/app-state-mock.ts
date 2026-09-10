/** Test double for `$app/state`. The path is mutable per test. */
let currentPath = '/';

export function setTestPagePath(path: string): void {
	currentPath = path;
}

export const page = {
	get url() {
		return new URL(`http://localhost${currentPath}`);
	},
	get path() {
		return currentPath;
	}
};
