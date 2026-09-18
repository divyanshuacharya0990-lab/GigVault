import type { AAProvider } from './accountAggregator.js';
import { MockFIP } from './mockFip.js';

/**
 * The one place that decides mock vs. real sandbox. Route code imports `aaProvider`
 * from here and never touches MockFIP directly, so wiring a real AA sandbox is a
 * one-file change: implement AAProvider in a new adapter (e.g. sandboxFip.ts) against
 * your real credentials, and swap the branch below.
 */
function buildProvider(): AAProvider {
  const mode = process.env.AA_PROVIDER ?? 'mock';
  if (mode === 'sandbox') {
    throw new Error(
      'AA_PROVIDER=sandbox but no sandbox adapter is implemented yet. ' +
        'Implement AAProvider against your real AA sandbox credentials in a new file ' +
        '(e.g. src/adapters/sandboxFip.ts) and bind it here. Falling back is ' +
        'intentionally not automatic — silently demoing on mock data while believing ' +
        "you're on the sandbox is worse than a clear startup error.",
    );
  }
  return new MockFIP();
}

export const aaProvider: AAProvider = buildProvider();