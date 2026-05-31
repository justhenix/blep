import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	return {
		initialHeroIndex: Math.floor(Math.random() * 5)
	};
};
