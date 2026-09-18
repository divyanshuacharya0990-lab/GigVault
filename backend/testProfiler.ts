
import { MockFIP } from './src/adapters/mockFip.js';
import { profilePayers } from './src/lib/payerProfiler.js';

(async () => {
  const mock = new MockFIP();
  const consent = await mock.requestConsent({ sessionId: 's1', customerIdentifier: 'ramesh@demo', purpose: 'test' });
  const envelope = await mock.fetchStatement(consent.consentId);
  const profiles = profilePayers(envelope.statement.transactions);
  console.log('--- RAW PROFILER OUTPUT ---');
  console.dir(profiles, { depth: null });
})();

