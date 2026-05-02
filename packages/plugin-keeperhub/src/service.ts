import type { IAgentRuntime } from "@elizaos/core";
import type {
  ExecuteWorkflowParams,
  KeeperHubApiResponse,
  KeeperHubConfig,
  PayWorkflowParams,
  WorkflowReceipt,
} from "./types.js";

export const KEEPERHUB_SERVICE_TYPE = "keeperhub";

export class KeeperHubService {
  static serviceType = KEEPERHUB_SERVICE_TYPE;

  private config!: KeeperHubConfig;

  async initialize(runtime: IAgentRuntime): Promise<void> {
    const apiKey = runtime.getSetting("KEEPERHUB_API_KEY");
    if (!apiKey) throw new Error("KEEPERHUB_API_KEY is required");
    this.config = {
      apiKey,
      baseUrl: (
        runtime.getSetting("KEEPERHUB_BASE_URL") ?? "https://api.keeperhub.com"
      ).replace(/\/$/, ""),
    };
  }

  static async start(runtime: IAgentRuntime): Promise<KeeperHubService> {
    const svc = new KeeperHubService();
    await svc.initialize(runtime);
    return svc;
  }

  private get headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.config.apiKey}`,
      "Content-Type": "application/json",
    };
  }

  private async post(path: string, body: unknown): Promise<KeeperHubApiResponse> {
    const url = `${this.config.baseUrl}${path}`;
    const resp = await fetch(url, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`KeeperHub API error ${resp.status}: ${text}`);
    }
    return resp.json() as Promise<KeeperHubApiResponse>;
  }

  async payWorkflow(params: PayWorkflowParams): Promise<WorkflowReceipt> {
    const raw = await this.post("/v1/workflows/pay", {
      workflow_id: params.workflowId,
      amount: params.amount,
      currency: params.currency,
      from: params.fromWallet,
      metadata: { purpose: "inbound_channel", caller_ens: params.callerEns },
    });
    return { txHash: raw.tx_hash, signedReceipt: raw.signed_receipt, status: raw.status };
  }

  async executeWorkflow(params: ExecuteWorkflowParams): Promise<WorkflowReceipt> {
    const raw = await this.post("/v1/workflows/execute", {
      workflow_id: params.workflowId,
      params: params.params,
      audit_tag: params.auditTag,
    });
    return { txHash: raw.tx_hash, signedReceipt: raw.signed_receipt, status: raw.status };
  }
}
