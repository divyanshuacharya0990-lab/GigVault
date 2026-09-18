// circomlibjs and snarkjs ship without TypeScript declarations. Minimal ambient
// declarations here rather than pulling in a nonexistent @types package — kept
// intentionally loose (any-typed) since this app only touches a handful of their
// functions, all used through the wrapper modules in src/zk/.
declare module 'circomlibjs' {
  export function buildPoseidon(): Promise<any>;
}

declare module 'snarkjs' {
  export const groth16: {
    fullProve: (
      input: Record<string, string>,
      wasmPath: string,
      zkeyPath: string,
    ) => Promise<{ proof: unknown; publicSignals: string[] }>;
    verify: (vkey: unknown, publicSignals: string[], proof: unknown) => Promise<boolean>;
    exportSolidityCallData: (proof: unknown, publicSignals: string[]) => Promise<string>;
  };
}
