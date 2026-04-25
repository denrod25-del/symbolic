import { expect, test } from '@playwright/test';

test('ad card appears on results page when keywords match', async ({
  page,
}) => {
  await page.goto('/search?q=running+shoes');
  await expect(page.getByTestId('ad-card')).toBeVisible();
});

test('ad card shows SPONSORED label, display URL, title, and CTA', async ({
  page,
}) => {
  await page.goto('/search?q=running+shoes');
  const card = page.getByTestId('ad-card');
  await expect(card.getByText('SPONSORED')).toBeVisible();
  await expect(card.getByText('runningshoes.example.com/sale')).toBeVisible();
  await expect(
    card.getByText('Best Running Shoes 2025 — Up to 40% Off')
  ).toBeVisible();
  await expect(card.getByText('Shop Now →')).toBeVisible();
});

test('ad card does not appear when no keywords match', async ({ page }) => {
  await page.goto('/search?q=hello+world');
  await expect(page.getByTestId('ad-card')).not.toBeVisible();
});

test('ad card click link goes through the click route', async ({ page }) => {
  await page.goto('/search?q=running+shoes');
  const card = page.getByTestId('ad-card');
  const titleLink = card.locator('a').first();
  const href = await titleLink.getAttribute('href');
  expect(href).toContain('/api/ads/click');
  expect(href).toContain('id=');
  expect(href).toContain('q=running');
});

test('no ad card on error page', async ({ page }) => {
  await page.goto('/search?q=error');
  await expect(page.getByTestId('ad-card')).not.toBeVisible();
});
