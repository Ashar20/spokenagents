/**
 * Manual smoke test — not run by vitest.
 * Run: KEEPERHUB_API_KEY=kh_test npx tsx tests/smoke.ts
 * Hits the REAL KeeperHub API (no mocks). Expects a 4xx/5xx for the fake workflow ID.
 */
import { KeeperHubService } from "../src/service.js";

const runtime = {
  getSetting: (key: string) => process.env[key] ?? null,
} as any;

async function main() {
  console.log("Initialising KeeperHubService...");
  const svc = await KeeperHubService.start(runtime);
  console.log("Service initialised OK");

  console.log("Calling payWorkflow (expect API error for fake workflow)...");
  try {
    await svc.payWorkflow({
      workflowId: "smoke-test/nonexistent",
      amount: "0.01",
      currency: "USDC",
      fromWallet: "0x0000000000000000000000000000000000000000",
      callerEns: "smoke.eth",
    });
  } catch (err) {
    console.log("Got expected error:", (err as Error).message);
  }

  console.log("Smoke test complete.");
}

main().catch(console.error);
