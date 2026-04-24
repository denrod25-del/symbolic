import { expect, test } from '@playwright/test';

test('homepage shows logo and search bar', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Symbolic').first()).toBeVisible();
  await expect(page.getByPlaceholder('Search the web...')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Search', exact: true }).first()
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: "I'm Feeling Lucky" })
  ).toBeVisible();
});

test('submitting a query navigates to results page', async ({ page }) => {
  await page.goto('/');
  await page.getByPlaceholder('Search the web...').fill('hello world');
  await page.getByText('Search', { exact: true }).click();
  await expect(page).toHaveURL(/\/search\?q=hello/);
});

test('pressing Enter on search bar navigates to results', async ({ page }) => {
  await page.goto('/');
  await page.getByPlaceholder('Search the web...').fill('hello world');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/search\?q=hello/);
});

test('results page shows result titles and URLs', async ({ page }) => {
  await page.goto('/search?q=hello+world');
  await expect(page.getByText('Hello World — Wikipedia')).toBeVisible();
  await expect(page.getByText('en.wikipedia.org')).toBeVisible();
});

test('results page has sticky header with pre-filled search bar', async ({
  page,
}) => {
  await page.goto('/search?q=hello+world');
  const input = page.getByPlaceholder('Search the web...');
  await expect(input).toHaveValue('hello world');
});

test('empty results shows empty state message', async ({ page }) => {
  await page.goto('/search?q=xyzzy12345');
  await expect(page.getByText('No results found')).toBeVisible();
  await expect(page.getByText(/Try different keywords/)).toBeVisible();
});

test('API error shows error message', async ({ page }) => {
  await page.goto('/search?q=error');
  await expect(page.getByText('Something went wrong')).toBeVisible();
});

test('empty query redirects to homepage', async ({ page }) => {
  await page.goto('/search?q=');
  await expect(page).toHaveURL('/');
});
