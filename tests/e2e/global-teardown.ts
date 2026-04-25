import type { ChildProcess } from 'node:child_process';
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

function isChildProcess(value: unknown): value is ChildProcess {
  return (
    typeof value === 'object' &&
    value !== null &&
    'kill' in value &&
    'killed' in value &&
    typeof (value as { kill: unknown }).kill === 'function'
  );
}

async function globalTeardown() {
  // Stop mock Brave server
  const braveServer = (globalThis as Record<string, unknown>)[
    '__mockBraveServer__'
  ];
  if (isServer(braveServer)) {
    braveServer.close();
    await once(braveServer, 'close');
  }

  // Kill PGlite process
  const pgliteProc = (globalThis as Record<string, unknown>)['__pgliteProc__'];
  if (isChildProcess(pgliteProc) && !pgliteProc.killed) {
    pgliteProc.kill('SIGTERM');
  }
}

export default globalTeardown;
