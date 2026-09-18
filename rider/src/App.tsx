import { useEffect, useRef, useState } from 'react';
import { usePrivy, useWallets, useSignMessage } from '@privy-io/react-auth';
import jsQR from 'jsqr';
import QRCode from 'qrcode';

const API = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:4000';

// Wire formats — must match backend/src/lib/holderKey.ts byte for byte.
const qrPayload = (a: { sessionId: string; ticketId: string; commitment: string }) =>
  ['GigVault qr v1', `session=${a.sessionId}`, `ticket=${a.ticketId}`, `commitment=${a.commitment}`].join('\n');

declare global {
  interface Window { AadhaarQR?: { decodeAadhaarQr: (t: string, o?: { nullifierSeed?: string }) => Promise<any> } }
}

async function api(path: string, body?: unknown) {
  const r = await fetch(API + path, { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${j.error ?? r.status} — ${j.message ?? 'request failed'}`);
  return j;
}

type Derived = { tenureMonths: number; weeksPaid: number; monthlyIncome: number };
const TIERS = {
  tenure: [0, 6, 12, 24, 36], weeks: [0, 26, 52, 100, 150], income: [0, 10000, 15000, 18000, 25000],
};
const maxIdx = (v: number, list: number[]) => list.reduce((acc, b, i) => (v >= b ? i : acc), 0);

export function App() {
  const { ready, authenticated, login, logout, user } = usePrivy();
  const { wallets } = useWallets();
  const { signMessage } = useSignMessage();
  const wallet = wallets.find((w) => w.walletClientType === 'privy') ?? wallets[0];

  const [log, setLog] = useState<string[]>([]);
  const say = (m: string) => setLog((l) => [...l, `${new Date().toLocaleTimeString()} ${m}`]);
  const [busy, setBusy] = useState(false);
  const [session, setSession] = useState<{ sessionId: string; consentId: string } | null>(null);
  const [holder, setHolder] = useState<string>('');
  const [derived, setDerived] = useState<Derived | null>(null);
  const [payers, setPayers] = useState<any[] | null>(null);
  const [confirmedPayers, setConfirmedPayers] = useState<string[]>([]);
  const [tiers, setTiers] = useState({ tenure: 0, weeks: 0, income: 0 });
  const [aadhaar, setAadhaar] = useState<{ name: string; nullifier: string; note: string } | null>(null);
  const [issued, setIssued] = useState<any>(null);
  const [qr, setQr] = useState<{ text: string; left: number } | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scanning, setScanning] = useState(false);

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); } catch (e: any) { say(`✗ ${label}: ${e.message}`); }
    finally { setBusy(false); }
  };

  // ---- steps ----
  const consent = () => run('consent', async () => {
    const r = await api('/consent', { customerIdentifier: user?.phone?.number ?? user?.email?.address ?? 'rider' });
    setSession({ sessionId: r.sessionId, consentId: r.consent?.consentId ?? r.consent?.id });
    say(`Consent recorded. Session ${r.sessionId.slice(0, 8)}…`);
  });
  const fetchRecord = () => run('fetch', async () => {
    const r = await api('/fetch', { sessionId: session!.sessionId, consentId: session!.consentId });
    setHolder(r.accountHolderName ?? 'RAMESH KUMAR');
    say(`Bank record received over AA, signature verified. Account holder: ${r.accountHolderName}`);
  });
  
  const derive = (selectedPayers?: string[]) => run('derive', async () => {
    const r = await api('/derive', { sessionId: session!.sessionId, confirmedPayers: selectedPayers });
    const d: Derived = r.derived ?? r;
    setDerived(d);
    
    // First time deriving, populate payers
    if (!payers && r.payers) {
      setPayers(r.payers);
      const highMed = r.payers.filter((p: any) => p.confidenceTier !== 'low').map((p: any) => p.displayName);
      setConfirmedPayers(highMed);
      // Immediately re-derive with the default selection if it filters out any payers
      if (highMed.length < r.payers.length) {
        say(`Derived raw data. Filtering to high/medium confidence payers...`);
        const r2 = await api('/derive', { sessionId: session!.sessionId, confirmedPayers: highMed });
        const d2: Derived = r2.derived ?? r2;
        setDerived(d2);
        setTiers({ tenure: maxIdx(d2.tenureMonths, TIERS.tenure), weeks: maxIdx(d2.weeksPaid, TIERS.weeks), income: maxIdx(d2.monthlyIncome, TIERS.income) });
        say(`Read (Filtered): ${d2.weeksPaid} weeks, ${d2.tenureMonths} months, ₹${d2.monthlyIncome}/month.`);
        return;
      }
    }
    
    setTiers({ tenure: maxIdx(d.tenureMonths, TIERS.tenure), weeks: maxIdx(d.weeksPaid, TIERS.weeks), income: maxIdx(d.monthlyIncome, TIERS.income) });
    say(`Read: ${d.weeksPaid} weeks, ${d.tenureMonths} months, ₹${d.monthlyIncome}/month (shown to you only).`);
  });

  const updateConfirmedPayers = (selected: string[]) => {
    setConfirmedPayers(selected);
    derive(selected); // Re-derive automatically
  };

  // ---- Aadhaar camera (Entry 2) ----
  useEffect(() => {
    if (!scanning) return;
    let alive = true; let stream: MediaStream | null = null;
    (async () => {
      try {
        if (!window.isSecureContext) throw new Error('camera needs http://localhost or trusted https');
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } });
        const v = videoRef.current!; v.srcObject = stream; await v.play();
        const det = 'BarcodeDetector' in window ? new (window as any).BarcodeDetector({ formats: ['qr_code'] }) : null;
        const c = canvasRef.current!; const ctx = c.getContext('2d', { willReadFrequently: true })!;
        const tick = async () => {
          if (!alive) return;
          let text: string | null = null;
          if (v.readyState >= 2) {
            if (det) { const codes = await det.detect(v); if (codes.length) text = codes[0].rawValue; }
            else { c.width = v.videoWidth; c.height = v.videoHeight; ctx.drawImage(v, 0, 0); const img = ctx.getImageData(0, 0, c.width, c.height); text = jsQR(img.data, img.width, img.height)?.data ?? null; }
          }
          if (text) {
            alive = false; stream?.getTracks().forEach((t) => t.stop()); setScanning(false);
            try {
              const a = await window.AadhaarQR!.decodeAadhaarQr(text, { nullifierSeed: 'gigvault-devhack' });
              setAadhaar({ name: a.name, nullifier: a.nullifier, note: `${a.name} · ${a.state} ${a.pincode} · ref …${a.referenceLast4} · decoded on this phone; only the name and a one-way identifier leave it.` });
              say(`Aadhaar decoded on device: ${a.name}`);
            } catch (e: any) { say(`✗ Aadhaar QR: ${e.message}`); }
            return;
          }
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      } catch (e: any) { say(`✗ camera: ${e.message}`); setScanning(false); }
    })();
    return () => { alive = false; stream?.getTracks().forEach((t) => t.stop()); };
  }, [scanning]);

  // ---- issue (Entry 3): minted to the Privy embedded wallet ----
  const issue = () => run('issue', async () => {
    if (!wallet) throw new Error('no Privy wallet yet — finish login (the wallet is created on login)');
    const maximal = derived && tiers.tenure === maxIdx(derived.tenureMonths, TIERS.tenure) && tiers.weeks === maxIdx(derived.weeksPaid, TIERS.weeks) && tiers.income === maxIdx(derived.monthlyIncome, TIERS.income);
    const r = await api('/issue', {
      sessionId: session!.sessionId,
      holderPublicKey: wallet.address,
      holderKeyScheme: 'eip191-secp256k1',
      anonAadhaar: aadhaar
        ? { nullifier: aadhaar.nullifier || 'demo-nullifier-' + session!.sessionId, proof: {}, publicSignals: [], decodedName: aadhaar.name }
        : { nullifier: 'demo-nullifier-' + session!.sessionId, proof: {}, publicSignals: [], decodedName: holder },
      confirmedPayers: confirmedPayers.length > 0 ? confirmedPayers : undefined,
      ...(maximal ? {} : { tierClaims: { tenureTierIdx: tiers.tenure, weeksTierIdx: tiers.weeks, incomeTierIdx: tiers.income } }),
    });
    setIssued(r);
    say(`Passport issued.${r.chain ? ` On chain: token #${r.chain.tokenId} minted to ${wallet.address.slice(0, 6)}…${wallet.address.slice(-4)} (${r.chain.custodial ? 'custodial' : 'your wallet'}).` : ' (chain off)'}`);
  });

  // ---- present (Entry 4): sign with the Privy wallet, show as QR ----
  const showQr = () => run('present', async () => {
    const t = await api('/present/ticket', { sessionId: session!.sessionId });
    const message = qrPayload({ sessionId: session!.sessionId, ticketId: t.ticketId, commitment: t.commitment });
    const { signature } = await signMessage({ message }, { address: wallet!.address, uiOptions: { title: 'Show your work passport', description: 'Signs a single-use presentation. Nothing about your income is in it.', buttonText: 'Sign' } });
    setQr({ text: `GV1|${session!.sessionId}|${t.ticketId}|${signature}`, left: t.expiresInSeconds });
    say(`QR ready, signed by your wallet, good for one scan.`);
  });
  useEffect(() => {
    if (!qr) return;
    const cv = document.getElementById('qr') as HTMLCanvasElement | null;
    if (cv) QRCode.toCanvas(cv, qr.text, { errorCorrectionLevel: 'M', scale: 6, margin: 1 });
    const id = setInterval(() => setQr((q) => (q && q.left > 0 ? { ...q, left: q.left - 1 } : q)), 1000);
    return () => clearInterval(id);
  }, [qr?.text]);

  // ---- render ----
  if (!ready) return <main className="wrap"><p>Loading…</p></main>;
  if (!authenticated) return (
    <main className="wrap">
      <h1>GigVault</h1>
      <p>Your work passport. Log in with your phone number — no seed phrase, no gas.</p>
      <button className="act" onClick={login}>Log in</button>
    </main>
  );

  return (
    <main className="wrap">
      <header>
        <h1>GigVault</h1>
        <div className="who">
          {user?.phone?.number ?? user?.email?.address} · wallet {wallet ? `${wallet.address.slice(0, 6)}…${wallet.address.slice(-4)}` : 'creating…'}
          <button className="ghost" onClick={logout}>Log out</button>
        </div>
      </header>

      <ol className="steps">
        <li><b>Give consent at your bank</b><p>Your bank sends the record over the Account Aggregator rail. Your platform is never asked.</p>
          <button className="act" disabled={busy || !!session} onClick={consent}>Give consent</button></li>
        <li><b>Your bank sends the record</b>
          <button className="act" disabled={busy || !session || !!holder} onClick={fetchRecord}>Fetch record</button></li>
        <li><b>Work out what it proves</b>
          <button className="act" disabled={busy || !holder || !!derived} onClick={() => derive()}>Read the record</button>
        </li>
        <li><b>Select income sources</b><p>Select which payers to include as verified gig income.</p>
          {payers && (
            <div className="payers-list">
              {payers.map((p) => (
                <label key={p.payerId} className={`payer-card tier-${p.confidenceTier}`}>
                  <input
                    type="checkbox"
                    checked={confirmedPayers.includes(p.displayName)}
                    onChange={(e) => {
                      if (e.target.checked) updateConfirmedPayers([...confirmedPayers, p.displayName]);
                      else updateConfirmedPayers(confirmedPayers.filter((n) => n !== p.displayName));
                    }}
                  />
                  <div>
                    <strong>{p.displayName}</strong> ({p.handle}) - {p.confidenceTier} confidence
                    <ul className="evidence">
                      {p.evidence.map((ev: string, i: number) => <li key={i}>{ev}</li>)}
                    </ul>
                  </div>
                </label>
              ))}
            </div>
          )}
        </li>
        <li><b>Scan your Aadhaar</b><p>Decoded on this device. Only your name and a one-way identifier are sent.</p>
          <div className="row">
            <button className="act" disabled={busy || !derived || scanning || !!aadhaar} onClick={() => setScanning(true)}>Scan Aadhaar QR</button>
            <button className="ghost" disabled={busy || !derived || !!aadhaar} onClick={() => setAadhaar({ name: holder, nullifier: '', note: 'Using the demo identity.' })}>Skip (demo identity)</button>
          </div>
          {scanning && <div className="cam"><video ref={videoRef} playsInline muted /><canvas ref={canvasRef} hidden /><button className="ghost" onClick={() => setScanning(false)}>Stop</button></div>}
          {aadhaar && <p className="hint">{aadhaar.note}</p>}</li>
        <li><b>Choose what to show</b><p>You can always show less than you have earned. Never more.</p>
          {derived && (
            <div className="bands">
              {(['tenure', 'weeks', 'income'] as const).map((k) => (
                <label key={k}>{k}
                  <select value={tiers[k]} onChange={(e) => setTiers({ ...tiers, [k]: +e.target.value })}>
                    {TIERS[k].map((b, i) => i <= maxIdx(k === 'tenure' ? derived.tenureMonths : k === 'weeks' ? derived.weeksPaid : derived.monthlyIncome, TIERS[k]) && (
                      <option key={i} value={i}>{k === 'income' ? `at least ₹${b.toLocaleString('en-IN')}` : `at least ${b} ${k === 'tenure' ? 'months' : 'weeks'}`}</option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          )}
          <button className="act" disabled={busy || !derived || !aadhaar || !!issued || !wallet} onClick={issue}>Issue passport</button></li>
      </ol>

      {issued && (
        <section className="passport">
          <div className="stamp">ISSUED</div>
          <h2>Work Passport</h2>
          <dl>
            <div><dt>Holder</dt><dd>{holder}</dd></div>
            <div><dt>Passport no.</dt><dd>{issued.chain ? `#${issued.chain.tokenId} · ${wallet?.address.slice(0, 6)}…${wallet?.address.slice(-4)}` : issued.commitment.slice(0, 10) + '…'}</dd></div>
            <div><dt>Tenure proved</dt><dd>{issued.card.tenure}</dd></div>
            <div><dt>Monthly income</dt><dd>{issued.card.monthlyIncome}</dd></div>
            <div><dt>Weeks paid</dt><dd>{issued.card.weeksPaid}</dd></div>
          </dl>
          <button className="act" disabled={busy} onClick={showQr}>Show QR to verifier</button>
          {qr && <div className="qrbox"><canvas id="qr" /><p>{qr.left > 0 ? `Good for one scan · expires in ${qr.left}s` : 'Expired — tap again.'}</p></div>}
        </section>
      )}

      <pre className="log">{log.join('\n')}</pre>
    </main>
  );
}
