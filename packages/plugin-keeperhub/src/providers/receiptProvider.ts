import type { IAgentRuntime, Memory, Provider, State } from "@elizaos/core";
import type { WorkflowReceipt } from "../types.js";

export const LAST_RECEIPT_CACHE_KEY = "keeperhub:last_receipt";

export const receiptProvider: Provider = {
  get: async (
    runtime: IAgentRuntime,
    _message: Memory,
    _state?: State
  ): Promise<string | null> => {
    const receipt = await runtime.cacheManager?.get<WorkflowReceipt>(
      LAST_RECEIPT_CACHE_KEY
    );
    if (!receipt) return null;

    return [
      "[KeeperHub Last Receipt]",
      `tx_hash: ${receipt.txHash}`,
      `status: ${receipt.status}`,
      `signed_receipt: ${receipt.signedReceipt ? "present" : "none"}`,
    ].join("\n");
  },
};

/** Called by plugin-tollgate after service.payWorkflow/executeWorkflow to populate the provider. */
export async function cacheReceipt(
  runtime: IAgentRuntime,
  receipt: WorkflowReceipt
): Promise<void> {
  await runtime.cacheManager?.set(LAST_RECEIPT_CACHE_KEY, receipt, {
    expires: Date.now() + 5 * 60 * 1000,
  });
}
