import { once } from 'node:events';
import type { Server } from 'node:http';

function isServer(value: unknown): value is Server {
  return (
    typeof value === 'object' &&
    value !== null &&
    'close' in value &&
    typeof (value as { close: unknown }).close === 'function'
  );
}

async function globalTeardown() {
  const value = (globalThis as Record<string, unknown>)['__mockBraveServer__'];
  if (isServer(value)) {
    value.close();
    await once(value, 'close');
  }
}

export default globalTeardown;
