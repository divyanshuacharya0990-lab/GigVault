
import { MockFIP } from './src/adapters/mockFip.js';
import { profilePayers } from './src/lib/payerProfiler.js';

(async () => {
  const mock = new MockFIP();
  const consent = await mock.requestConsent({ sessionId: 's1', customerIdentifier: 'ramesh@demo', purpose: 'test' });
  const envelope = await mock.fetchStatement(consent.consentId);

  const credits = envelope.statement.transactions.filter(t => t.type === 'CREDIT');
  const WEEKS_PER_MONTH = 52 / 12;

  function calculateDerived(payersList) {
    let filtered = credits;
    if (payersList && payersList.length > 0) {
      const allowed = new Set(payersList);
      filtered = filtered.filter(t => {
        const parts = t.narration.split('/');
        if (parts.length >= 5 && ['UPI', 'NEFT', 'IMPS'].includes(parts[0])) {
          return allowed.has(parts[2].trim());
        }
        return false;
      });
    }
    const weeksPaid = filtered.length;
    const tenureMonths = Math.floor(weeksPaid / 4.33);
    const recent = filtered.slice(-4);
    const weeklyMean = recent.reduce((s, t) => s + parseFloat(t.amount), 0) / (recent.length || 1);
    return { tenureMonths, weeksPaid, monthlyIncome: Math.round(weeklyMean * WEEKS_PER_MONTH) };
  }

  const all = calculateDerived(['SWIGGY PAYMENT', 'ZOMATO HYPERPURE', 'MEENA KUMAR', 'RAHUL S']);
  const safe = calculateDerived(['SWIGGY PAYMENT', 'ZOMATO HYPERPURE']);

  console.log('--- PROFILER OUTPUT FOR EVERY PAYER ---');
  console.dir(profilePayers(envelope.statement.transactions), { depth: null });
  console.log('\n--- AGGREGATE WITH ALL PAYERS (Including Family/Friends) ---');
  console.log(all);
  console.log('\n--- AGGREGATE WITH SWIGGY + ZOMATO ---');
  console.log(safe);
})();

