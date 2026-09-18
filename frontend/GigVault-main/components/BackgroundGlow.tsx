"use client";

export function BackgroundGlow() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* Deep purple base ambient gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#140827] via-[#0b0318] to-[#06020c]" />

      {/* Primary intense violet radial bloom */}
      <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[850px] h-[500px] bg-violet-600/25 blur-[120px] rounded-full" />

      {/* Mid-screen purple glow behind content cards */}
      <div className="absolute top-[28%] left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-fuchsia-700/15 blur-[140px] rounded-full" />

      {/* Subtle bottom-left indigo accent */}
      <div className="absolute bottom-10 left-10 w-[450px] h-[300px] bg-indigo-600/15 blur-[110px] rounded-full" />

      {/* Ambient noise / grid overlay for a tactile fintech surface */}
      <div className="absolute inset-0 bg-[radial-gradient(#ffffff08_1px,transparent_1px)] [background-size:24px_24px] opacity-40" />
    </div>
  );
}

export default BackgroundGlow;