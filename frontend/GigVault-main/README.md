# GigVault

Portable work passport demo — Next.js 14 (App Router), TypeScript, Tailwind CSS, Framer Motion.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Structure

```
app/
  layout.tsx        fonts (Space Grotesk / Inter / JetBrains Mono) + global shell
  page.tsx           tab state + animated panel switch
  globals.css        resets, scrollbar, focus ring, reduced-motion
components/
  Header.tsx          logo + rail status pill
  TabNav.tsx           horizontal workflow nav with sliding underline
  BackgroundGlow.tsx  ambient violet/cyan radial glows
  PassportCard.tsx    reusable passport visual
  QRCode.tsx          deterministic pseudo-QR (demo only, not a real scanner)
  tabs/
    Overview.tsx
    IssuePassport.tsx
    PresentQR.tsx
    Verify.tsx
    ForgedProof.tsx
lib/
  types.ts
  data.ts             mock passport + tab metadata
```

## Notes

- All five tabs are client components (`"use client"`) since they hold
  interactive state (timers, step sequences, toggles).
- Colors, gradients and glows are wired into `tailwind.config.ts` as
  custom tokens (`bg-primary`, `brand-primary`, `bg-main-gradient`, etc.)
  so you reference them the same way anywhere in the app.
- `QRCode.tsx` renders a deterministic pattern from a seed string — it's
  a visual stand-in for a real QR payload, not a scannable code.
