import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-react';
import { page } from 'vitest/browser';
import { Button } from './Button';

describe('Button', () => {
  it('renders the label as a button', async () => {
    await render(<Button>Search</Button>);

    expect(
      page.getByRole('button', { name: 'Search' }).elements()
    ).toHaveLength(1);
  });

  it('defaults to a non-submitting type', async () => {
    await render(<Button>Search</Button>);

    await expect
      .element(page.getByRole('button', { name: 'Search' }))
      .toHaveAttribute('type', 'button');
  });

  it('forwards an explicit submit type', async () => {
    await render(<Button type="submit">Send</Button>);

    await expect
      .element(page.getByRole('button', { name: 'Send' }))
      .toHaveAttribute('type', 'submit');
  });

  it('applies the disabled state', async () => {
    await render(<Button disabled>Search</Button>);

    await expect
      .element(page.getByRole('button', { name: 'Search' }))
      .toBeDisabled();
  });
});
