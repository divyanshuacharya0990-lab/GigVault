import { mockFip } from './src/lib/mockFip'; import { profilePayers } from './src/lib/payerProfiler'; console.dir(profilePayers(mockFip('MOCK-FIP-001').transactions), { depth: null });
