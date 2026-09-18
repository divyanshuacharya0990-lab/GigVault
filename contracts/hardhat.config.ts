import type { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import * as dotenv from 'dotenv';

dotenv.config();

const AMOY_RPC_URL = process.env.AMOY_RPC_URL ?? '';
const PRIVATE_KEY = process.env.PRIVATE_KEY ?? '';

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.24',
    settings: {
      optimizer: { enabled: true, runs: 200 },
      // OZ >= 5.2 uses mcopy (Strings -> Bytes.sol); needs Cancun. Amoy supports it.
      evmVersion: 'cancun',
    },
  },
  networks: {
    hardhat: {
      // Local dev chain. Per hackathon-runbook.md: "Local chains reset. Restarting a
      // dev node wipes deployed contracts; anything holding an old address must be
      // regenerated." Re-run deploy.ts after every `hardhat node` restart.
    },
    localhost: {
      url: 'http://127.0.0.1:8545',
    },
    amoy: {
      url: AMOY_RPC_URL || 'https://rpc-amoy.polygon.technology',
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      chainId: 80002,
    },
  },
};

export default config;
