import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import type { FullConfig } from '@playwright/test';
import { createMockBraveServer } from './mock-brave-server';
import { closeTestDb, seedTestAd } from './test-db';

const MOCK_PORT = 3099;
const PGLITE_PORT = 5432;
const TEST_DB_URL = 'postgresql://postgres:postgres@127.0.0.1:5432/postgres';

function startPgliteServer(): ChildProcess {
  return spawn(
    'npx',
    [
      'pglite-server',
      '--port',
      String(PGLITE_PORT),
      '-m',
      '100',
      '--db=test.db',
    ],
    { cwd: process.cwd(), stdio: 'pipe' }
  );
}

async function waitForReady(
  proc: ChildProcess,
  needle: string,
  timeoutMs: number
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(
        new Error(`Process did not emit "${needle}" within ${timeoutMs}ms`)
      );
    }, timeoutMs);

    function check(chunk: Buffer) {
      if (chunk.toString().includes(needle)) {
        clearTimeout(timer);
        resolve();
      }
    }

    proc.stdout?.on('data', check);
    proc.stderr?.on('data', check);
    proc.once('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

async function runMigrations(): Promise<void> {
  const proc = spawn('npm', ['run', 'db:migrate'], {
    cwd: process.cwd(),
    stdio: 'pipe',
    env: { ...process.env, DATABASE_URL: TEST_DB_URL },
  });
  const [code] = await once(proc, 'close');
  if (code !== 0) {
    throw new Error(`db:migrate exited ${String(code)}`);
  }
}

async function globalSetup(_config: FullConfig) {
  // Start mock Brave API server
  const braveServer = createMockBraveServer();
  braveServer.listen(MOCK_PORT);
  await once(braveServer, 'listening');
  (globalThis as Record<string, unknown>)['__mockBraveServer__'] = braveServer;

  // Start PGlite server and wait until it is ready
  const pgliteProc = startPgliteServer();
  (globalThis as Record<string, unknown>)['__pgliteProc__'] = pgliteProc;
  await waitForReady(pgliteProc, 'listening', 10_000);

  // Apply migrations and seed
  await runMigrations();
  await seedTestAd();
  await closeTestDb();
}

export default globalSetup;
