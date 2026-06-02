import { test, expect } from '@playwright/test';

test.describe('BLEP App E2E Tests', () => {

	test('Initial Load & UI State', async ({ page }) => {
		await page.goto('/app');
		// Add a longer timeout or wait for load state
		await page.waitForLoadState('networkidle');

		// Check hero heading
		await expect(page.locator('h1.idle-heading')).toBeVisible({ timeout: 10000 });

		// Check sidebar and new scan button
		const newScanBtn = page.locator('.sidebar-new');
		await expect(newScanBtn).toBeVisible();

		// Check mode chips are visible
		const chips = page.locator('.mode-chip');
		await expect(chips).toHaveCount(3);
		await expect(chips.nth(0)).toHaveText('Listing');
		await expect(chips.nth(1)).toHaveText('Recommend');
		await expect(chips.nth(2)).toHaveText('Compare');

		// Check Brain Juice badge
		const brainBadge = page.locator('.brain-badge');
		await expect(brainBadge).toContainText('BRAIN JUICE');
	});

	test('Basic Scan Flow (Verdict Mode)', async ({ page }) => {
		await page.goto('/app');
		await page.waitForLoadState('networkidle');

		// Type a mock listing query
		const input = page.locator('#blep-input');
		await input.fill('Acer Swift Go 14 Ultra 7, 19 juta. Worth it?');

		// Click "Ask BLEP"
		const askBtn = page.locator('.composer-primary');
		await askBtn.click();

		// Check input is disabled and button says Asking...
		await expect(input).toBeDisabled();
		await expect(askBtn).toContainText('Asking...');

		// Wait for the result card to render
		const resultCard = page.locator('.result-card');
		await expect(resultCard).toBeVisible({ timeout: 20000 });
		await expect(page.locator('.result-title')).toBeVisible();
	});

	test('Recommendation Flow', async ({ page }) => {
		await page.goto('/app');
		await page.waitForLoadState('networkidle');

		// Click the Recommend chip
		const recommendChip = page.locator('.mode-chip', { hasText: 'Recommend' });
		await recommendChip.click();

		// Verify placeholder changed
		const input = page.locator('#blep-input');
		await expect(input).toHaveValue(/recommendation/i);

		// Click Ask BLEP
		const askBtn = page.locator('.composer-primary');
		await askBtn.click();

		// Wait for results
		const resultCard = page.locator('.result-card');
		await expect(resultCard).toBeVisible({ timeout: 20000 });
		
		// Wait for recommendation result
		await expect(page.locator('.result-badge')).toContainText('RECOMMENDATION');
	});

	test('Doubt Mode (Phase 2)', async ({ page }) => {
		await page.goto('/app');
		await page.waitForLoadState('networkidle');

		// Run a basic scan first
		const input = page.locator('#blep-input');
		await input.fill('Gaming laptop 15 juta');
		await page.locator('.composer-primary').click();

		// Wait for results
		await expect(page.locator('.result-card')).toBeVisible({ timeout: 20000 });

		// Trigger Doubt mode by pressing 'x'
		await page.keyboard.press('x');

		// Verify doubt mode pill appears
		const doubtPill = page.locator('.doubt-mode-pill');
		await expect(doubtPill).toBeVisible({ timeout: 5000 });

		// Use a doubt chip if available, or just type a question
		const doubtChips = page.locator('.doubt-chip');
		if (await doubtChips.count() > 0) {
			await doubtChips.first().click();
		} else {
			await input.fill('Why?');
			await page.locator('.composer-primary').click();
		}

		// Wait for BLEP to respond in chat
		const doubtThread = page.locator('.doubt-thread');
		await expect(doubtThread.locator('.doubt-msg')).toHaveCount(2, { timeout: 15000 });
	});

	test('Sidebar History Management', async ({ page }) => {
		await page.goto('/app');
		await page.waitForLoadState('networkidle');

		// Run a basic scan with a valid tech query to pass input gate
		await page.locator('#blep-input').fill('Lenovo Legion Pro 5i RTX 4070 30 juta');
		await page.locator('.composer-primary').click();

		// Wait for results
		await expect(page.locator('.result-card')).toBeVisible({ timeout: 20000 });

		// Verify it appears in the sidebar history list
		const historyItem = page.locator('.sidebar-history-item').first();
		await expect(historyItem).toBeVisible();
		await expect(historyItem).toContainText('Lenovo Legion');

		// Click "New scan" and verify main composer resets
		await page.locator('.sidebar-new').click();
		await expect(page.locator('h1.idle-heading')).toBeVisible({ timeout: 10000 });

		// Click the history item again and verify results load back
		await historyItem.click();
		await expect(page.locator('.result-card')).toBeVisible();
	});
});
