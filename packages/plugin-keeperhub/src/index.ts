import type { Plugin } from "@elizaos/core";
import { KeeperHubService, KEEPERHUB_SERVICE_TYPE } from "./service.js";
import { payWorkflowAction } from "./actions/payWorkflow.js";
import { executeWorkflowAction } from "./actions/executeWorkflow.js";
import { receiptProvider } from "./providers/receiptProvider.js";

export const keeperHubPlugin: Plugin = {
  name: "@elizaos/plugin-keeperhub",
  description:
    "KeeperHub blockchain workflow execution — pay tolls and execute settlement workflows for agent-to-agent payments.",
  services: [KeeperHubService as any],
  actions: [payWorkflowAction, executeWorkflowAction],
  providers: [receiptProvider],
};

export default keeperHubPlugin;

export { KeeperHubService, KEEPERHUB_SERVICE_TYPE } from "./service.js";
export { cacheReceipt, LAST_RECEIPT_CACHE_KEY } from "./providers/receiptProvider.js";
export type {
  WorkflowReceipt,
  PayWorkflowParams,
  ExecuteWorkflowParams,
  KeeperHubConfig,
  KeeperHubApiResponse,
} from "./types.js";
