import { browser } from '$app/environment';

export type Theme = 'light' | 'dark' | 'system';

class ThemeState {
	preference = $state<Theme>('system');
	resolved = $state<'light' | 'dark'>('light');

	constructor() {
		if (browser) {
			const stored = localStorage.getItem('theme-preference') as Theme;
			if (stored === 'light' || stored === 'dark' || stored === 'system') {
				this.preference = stored;
			}
			this.updateResolved();

			window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
				if (this.preference === 'system') this.updateResolved();
			});
		}
	}

	updateResolved() {
		if (!browser) return;
		if (this.preference === 'system') {
			this.resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
		} else {
			this.resolved = this.preference;
		}

		if (this.resolved === 'dark') {
			document.documentElement.classList.add('dark');
		} else {
			document.documentElement.classList.remove('dark');
		}
	}

	setTheme(t: Theme) {
		this.preference = t;
		if (browser) localStorage.setItem('theme-preference', t);
		this.updateResolved();
	}
}

export const theme = new ThemeState();
