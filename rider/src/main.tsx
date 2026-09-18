import React from 'react';
import ReactDOM from 'react-dom/client';
import { PrivyProvider } from '@privy-io/react-auth';
import { App } from './App';
import './styles.css';

const appId = import.meta.env.VITE_PRIVY_APP_ID as string | undefined;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {appId ? (
      <PrivyProvider
        appId={appId}
        config={{
          // Phone-number login is the deck's claim; email is the fallback if SMS delivery
          // to your number is flaky at the venue. Enable both in the Privy dashboard too.
          loginMethods: ['sms', 'email'],
          // The embedded wallet IS the rider's passport wallet: no seed phrase, no gas.
          embeddedWallets: { ethereum: { createOnLogin: 'all-users' } },
          appearance: { theme: 'light', accentColor: '#1c3f6e' },
        }}
      >
        <App />
      </PrivyProvider>
    ) : (
      <main className="wrap"><h1>GigVault</h1>
        <p className="err">VITE_PRIVY_APP_ID is not set. Copy <code>.env.example</code> to <code>.env</code>, paste the App ID from dashboard.privy.io, restart <code>npm run dev</code>.</p>
      </main>
    )}
  </React.StrictMode>,
);
