/**
 * OFFLINE fallback config. `hardhat compile` normally downloads a native solc from
 * binaries.soliditylang.org; on venue wifi that download is the single point of
 * failure for the whole contracts build. This config compiles with the solc-js that is
 * already inside node_modules (pulled in by hardhat-toolbox), so no network is needed.
 *
 * Use:  npx hardhat --config hardhat.offline.config.ts compile
 *       npx hardhat --config hardhat.offline.config.ts node
 *       npx hardhat --config hardhat.offline.config.ts run scripts/deploy.ts --network localhost
 *
 * Trade-off: solc-js is slower than native solc, and its version is whatever is in
 * node_modules (0.8.26 at time of writing) rather than the pinned 0.8.24. The pragmas
 * are ^0.8.24 so both compile; bytecode differs trivially between the two. Do not mix
 * artifacts from the two configs in one deploy.
 */
import type { HardhatUserConfig } from 'hardhat/config';
import { subtask } from 'hardhat/config';
import { TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD } from 'hardhat/builtin-tasks/task-names';
import '@nomicfoundation/hardhat-toolbox';
import * as dotenv from 'dotenv';
import path from 'node:path';

dotenv.config();

// eslint-disable-next-line @typescript-eslint/no-var-requires
const solcVersion: string = require('solc/package.json').version;

subtask(TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD, async (args: { solcVersion: string }, _hre, runSuper) => {
  if (args.solcVersion === solcVersion) {
    return {
      compilerPath: path.resolve(__dirname, 'node_modules/solc/soljson.js'),
      isSolcJs: true,
      version: solcVersion,
      longVersion: solcVersion,
    };
  }
  return runSuper();
});

const config: HardhatUserConfig = {
  solidity: { version: solcVersion, settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: 'cancun' } },
  networks: {
    localhost: { url: 'http://127.0.0.1:8545' },
    amoy: {
      url: process.env.AMOY_RPC_URL || 'https://rpc-amoy.polygon.technology',
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 80002,
    },
  },
};
export default config;
