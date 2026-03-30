import { createRequire } from "module";
import { readFileSync } from "fs";

const require = createRequire(import.meta.url);

const { ethers, ContractFactory } = require("ethers");
const RPC_URL = "http://127.0.0.1:8545";
const PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

async function main() {
  console.log("Connecting to local Hardhat node...");
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

  const artifactPath = "/Users/pizza/texas-project/apps/backend/artifacts/contracts/TestUSDT.sol/TestUSDT.json";
  const artifact = JSON.parse(readFileSync(artifactPath, "utf-8"));

  console.log("Deploying TestUSDT...");
  const factory = new ContractFactory(artifact.abi, artifact.bytecode, wallet);
  const usdt = await factory.deploy(6);
  await usdt.waitForDeployment();

  const address = await usdt.getAddress();
  console.log(`TestUSDT deployed to: ${address}`);

  const deployerAddr = wallet.address;
  const mintAmount = BigInt(1000000) * BigInt(10 ** 6);
  // Increment nonce after deployment
  const nonce = await provider.getTransactionCount(wallet.address);
  const tx = await (usdt as any).mint(deployerAddr, mintAmount, { nonce });
  await tx.wait();
  console.log(`Minted ${mintAmount.toString()} to ${deployerAddr}`);

  const balance = await (usdt as any).balanceOf(deployerAddr);
  console.log(`Deployer USDT balance: ${ethers.formatUnits(balance, 6)}`);

  console.log("\n========================================");
  console.log("  LOCAL TEST CHAIN READY!");
  console.log("========================================");
  console.log(`ETH_RPC_URL=http://127.0.0.1:8545`);
  console.log(`USDT_CONTRACT_ADDRESS=${address}`);
  console.log(`HD_WALLET_MNEMONIC="test test test test test test test test test test test junk"`);
  console.log("========================================\n");

  process.exit(0);
}

main().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
