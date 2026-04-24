import { once } from 'node:events';
import type { FullConfig } from '@playwright/test';
import { createMockBraveServer } from './mock-brave-server';

const MOCK_PORT = 3099;

async function globalSetup(_config: FullConfig) {
  const server = createMockBraveServer();
  server.listen(MOCK_PORT);
  await once(server, 'listening');
  // Store server reference for teardown
  (globalThis as Record<string, unknown>)['__mockBraveServer__'] = server;
}

export default globalSetup;
